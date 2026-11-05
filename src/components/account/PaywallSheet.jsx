import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { APP_CONFIG } from '@/lib/appConfig';
import { PLANS, planLabel } from '@/lib/plans';
import { checkoutDestination } from '../../../scripts/plan-marks.js';
import { canCancelWebsitePlan, cancelPlanConfirm, cancelPlanNote } from '../../../scripts/account-plan.js';
import { useAuth } from '@/lib/AuthContext';
import {
  cancelWebsitePlan,
  getUsage,
  openBillingPortal,
  redeemPartnerCode,
  startCheckout,
} from '@/lib/accountStore';
import { openBillingUrl } from '@/lib/billingUrl';
import TermsAgreement from '@/components/account/TermsAgreement';
import { RENEWAL_NOTICE, TERMS_AGREE_ERROR } from '@/lib/legal';
import { cn } from '@/lib/utils';

function formatPlanDate(iso) {
  const date = new Date(iso || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function PlanCard({ plan, current, highlight, action, busy }) {
  return (
    <div className={cn(
      'w-full rounded-card border p-6 text-left',
      highlight ? 'border-foreground bg-card' : 'option-surface',
    )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold tracking-tight">{plan.name}</p>
        {current && !plan.monthlyPrice && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current
          </span>
        )}
      </div>
      {plan.monthlyPrice && (
        <p className="text-lg font-bold tracking-tight mt-1">
          {plan.monthlyPrice}
          <span className="text-sm font-medium text-muted-foreground"> / month</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-1">{plan.blurb}</p>
      <ul className="mt-3 space-y-1.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {action ? (
        <Button
          type="button"
          className="w-full h-11 rounded-full mt-4 font-semibold"
          disabled={busy}
          onClick={action.onClick}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : action.label}
        </Button>
      ) : current && plan.monthlyPrice ? (
        <div className="w-full h-11 rounded-full mt-4 font-semibold bg-primary text-primary-foreground flex items-center justify-center">
          Current
        </div>
      ) : null}
    </div>
  );
}

export default function PaywallSheet({ open, onOpenChange }) {
  const { user } = useAuth();
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [code, setCode] = React.useState('');
  const [redeemCode, setRedeemCode] = React.useState('');
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [checkoutPlan, setCheckoutPlan] = React.useState('');
  const [agreed, setAgreed] = React.useState(false);
  const [redeemAgreed, setRedeemAgreed] = React.useState(false);

  const billingPlan = user?.billingPlan || '';
  const websitePlan = billingPlan === 'solo' || billingPlan === 'partner';
  const canCancel = canCancelWebsitePlan(user);
  const canceledNote = cancelPlanNote(user);
  const accessUntil = formatPlanDate(user?.subscriptionStatus === 'trialing' ? user?.trialEndsAt : user?.periodEndsAt);
  const currentFree = !billingPlan && user?.subscriptionTier !== 'pro';
  const currentStudy = billingPlan === 'solo';
  const currentPartner = billingPlan === 'partner' || billingPlan === 'guest';

  React.useEffect(() => {
    if (!open) {
      setError('');
      setBusy('');
      setCancelOpen(false);
      setCheckoutPlan('');
      setAgreed(false);
      setRedeemAgreed(false);
      return undefined;
    }
    let cancelled = false;
    getUsage().catch(() => {
      if (!cancelled) setError('');
    });
    return () => { cancelled = true; };
  }, [open]);

  const run = async (name, action) => {
    setBusy(name);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy('');
    }
  };

  const subscribe = (plan) => {
    if (!agreed) {
      setError(TERMS_AGREE_ERROR);
      return;
    }
    run(plan, async () => {
      const data = await startCheckout(plan, code);
      if (data.granted) {
        const path = checkoutDestination(plan, data);
        if (Capacitor.isNativePlatform()) {
          const origin = APP_CONFIG.workerUrl;
          if (origin) await openBillingUrl(`${origin}${path}`);
          onOpenChange(false);
          return;
        }
        window.location.assign(path);
        return;
      }
      if (!data.url) throw new Error('Could not start checkout.');
      await openBillingUrl(data.url);
      if (!Capacitor.isNativePlatform()) onOpenChange(false);
    });
  };

  const openCheckout = (planId) => {
    setError('');
    setAgreed(false);
    setCheckoutPlan(planId);
  };

  const subscribeAction = (planId, isCurrent) => {
    if (isCurrent && billingPlan !== 'guest') return null;
    return { label: 'Subscribe', onClick: () => openCheckout(planId) };
  };

  const manageBilling = () => run('portal', async () => {
    const data = await openBillingPortal();
    await openBillingUrl(data.url);
  });

  const redeem = (event) => {
    event.preventDefault();
    const attempt = redeemCode.trim();
    if (!attempt) {
      setError('Enter a code.');
      return;
    }
    if (!redeemAgreed) {
      setError(TERMS_AGREE_ERROR);
      return;
    }
    run('redeem', async () => {
      await redeemPartnerCode(attempt);
      setRedeemCode('');
      onOpenChange(false);
    });
  };

  const studyAction = subscribeAction('solo', currentStudy);
  const partnerAction = subscribeAction('partner', currentPartner);
  const pendingPlan = checkoutPlan === 'partner' ? PLANS.partner : checkoutPlan === 'solo' ? PLANS.study : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85dvh] overflow-y-auto">
          <SheetHeader className="text-left pr-10">
            <SheetTitle>Plans</SheetTitle>
            <SheetDescription>
              Study is $8 a month. Partner study is $12 a month and covers one friend. A plan bought on the website is the same plan here.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 pt-4 pb-6">
            {error && !checkoutPlan && !cancelOpen && <p className="text-sm text-destructive">{error}</p>}
            {user?.billingNotice === 'beta_ended' && !billingPlan && (
              <p className="text-sm text-muted-foreground">Your free week ended.</p>
            )}
            {canceledNote && (
              <p className="text-sm text-muted-foreground">{canceledNote}</p>
            )}
            {websitePlan && !user?.cancelAtPeriodEnd && user?.billingPromo === 'beta' && accessUntil && (
              <p className="text-sm text-muted-foreground">Free trial ends {accessUntil}. You won't be charged.</p>
            )}
            {websitePlan && !user?.cancelAtPeriodEnd && user?.billingPromo !== 'beta' && accessUntil && (
              <p className="text-sm text-muted-foreground">Next billing date {accessUntil}.</p>
            )}
            {billingPlan === 'guest' && (
              <p className="text-sm text-muted-foreground">
                You're on a friend's partner study plan. If they cancel, you both lose access.
                {accessUntil ? ` It runs until ${accessUntil}.` : ''}
              </p>
            )}
            {!websitePlan && billingPlan !== 'guest' && user?.subscriptionTier === 'pro' && (
              <p className="text-sm text-muted-foreground">
                This Study access is billed through the App Store. Cancel it in your Apple ID subscriptions.
              </p>
            )}

            <PlanCard plan={PLANS.free} current={currentFree} />
            <PlanCard
              plan={PLANS.study}
              current={currentStudy}
              highlight
              busy={busy === 'solo'}
              action={studyAction}
            />
            <PlanCard
              plan={PLANS.partner}
              current={currentPartner}
              busy={busy === 'partner'}
              action={partnerAction}
            />

            {canCancel && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-full"
                disabled={!!busy}
                onClick={() => {
                  setError('');
                  setCancelOpen(true);
                }}
              >
                Cancel plan
              </Button>
            )}
            {user?.hasBilling && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-full"
                disabled={!!busy}
                onClick={manageBilling}
              >
                {busy === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Manage billing'}
              </Button>
            )}

            {!billingPlan && (
              <form onSubmit={redeem} className="rounded-card border border-border p-4 space-y-3">
                <p className="text-sm font-bold tracking-tight">Redeem partner code</p>
                <p className="text-xs text-muted-foreground">
                  Get a code from someone on partner study. It works for one friend.
                </p>
                <Input
                  value={redeemCode}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Partner code"
                  aria-label="Partner code"
                  onChange={(event) => setRedeemCode(event.target.value)}
                  className="h-11 rounded-full"
                />
                <TermsAgreement id="paywall-redeem-terms" checked={redeemAgreed} onCheckedChange={setRedeemAgreed} />
                <Button type="submit" className="w-full h-11 rounded-full font-semibold" disabled={!!busy || !redeemAgreed}>
                  {busy === 'redeem' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Redeem'}
                </Button>
              </form>
            )}

            {websitePlan && (
              <p className="text-xs text-muted-foreground">
                {planLabel(user)} is billed through Stripe. Canceling keeps access until the period ends.
                {billingPlan === 'partner' ? ' Your friend loses access then too.' : ''}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!pendingPlan}
        onOpenChange={(next) => {
          if (next || busy === checkoutPlan) return;
          setCheckoutPlan('');
          setAgreed(false);
        }}
      >
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto">
          {pendingPlan && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pendingPlan.name}
                  <span className="block text-base font-semibold mt-1">
                    {pendingPlan.monthlyPrice}
                    <span className="text-sm font-medium text-muted-foreground"> / month</span>
                  </span>
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed">
                  {RENEWAL_NOTICE}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="plan-code">Code</Label>
                <Input
                  id="plan-code"
                  value={code}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Optional"
                  onChange={(event) => setCode(event.target.value)}
                  className="h-11 rounded-full"
                />
              </div>
              <TermsAgreement id="paywall-agree-terms" checked={agreed} onCheckedChange={setAgreed} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy === checkoutPlan}>Not now</AlertDialogCancel>
                <Button
                  className="h-11 rounded-full font-semibold"
                  disabled={!agreed || busy === checkoutPlan}
                  onClick={() => subscribe(checkoutPlan)}
                >
                  {busy === checkoutPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={(next) => { if (busy !== 'cancel') setCancelOpen(next); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {planLabel(user)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelPlanConfirm(user)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && cancelOpen && <p className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'cancel'}>Keep plan</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy === 'cancel'}
              onClick={() => run('cancel', async () => {
                await cancelWebsitePlan();
                setCancelOpen(false);
              })}
            >
              {busy === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel plan'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
