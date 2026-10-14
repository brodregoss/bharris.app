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
import { adsEnabledFor } from '@/lib/adAccess';
import { watchAdForCredit } from '@/lib/adCredit';
import { PLANS, planLabel } from '@/lib/plans';
import { checkoutDestination } from '../../../scripts/plan-marks.js';
import { canCancelWebsitePlan, cancelPlanConfirm, cancelPlanNote } from '../../../scripts/account-plan.js';
import { useAuth } from '@/lib/AuthContext';
import {
  acceptTermsOnAccount,
  cancelWebsitePlan,
  getUsage,
  openBillingPortal,
  redeemPartnerCode,
  startCheckout,
} from '@/lib/accountStore';
import { openBillingUrl } from '@/lib/billingUrl';
import TermsAgreement from '@/components/account/TermsAgreement';
import { RENEWAL_NOTICE, TERMS_AGREE_ERROR } from '@/lib/legal';
import { hasAcceptedTerms, shouldAskForTerms } from '@/lib/termsAgreement';
import { cn } from '@/lib/utils';

function formatPlanDate(iso) {
  const date = new Date(iso || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function PlanCard({ plan, current, highlight, action, busy }) {
  return (
    <div className={cn(
      'rounded-2xl border p-4 text-left w-full',
      highlight ? 'border-foreground bg-card' : 'border-border bg-muted/40',
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
          className="w-full h-11 rounded-2xl mt-4 font-semibold"
          disabled={busy}
          onClick={action.onClick}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : action.label}
        </Button>
      ) : current && plan.monthlyPrice ? (
        <div className="w-full h-11 rounded-2xl mt-4 font-semibold bg-primary text-primary-foreground flex items-center justify-center">
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
  const [agreed, setAgreed] = React.useState(() => hasAcceptedTerms());

  const billingPlan = user?.billingPlan || '';
  const websitePlan = billingPlan === 'solo' || billingPlan === 'partner';
  const canCancel = canCancelWebsitePlan(user);
  const canceledNote = cancelPlanNote(user);
  const accessUntil = formatPlanDate(user?.subscriptionStatus === 'trialing' ? user?.trialEndsAt : user?.periodEndsAt);
  const currentFree = !billingPlan && user?.subscriptionTier !== 'pro';
  const outOfCalls = !!user?.uid && adsEnabledFor(user) && !user.unlimited && !user.hasBudget && (user.remainingQuota ?? 0) <= 0;
  const currentStudy = billingPlan === 'solo';
  const currentPartner = billingPlan === 'partner' || billingPlan === 'guest';

  React.useEffect(() => {
    if (!open) {
      setError('');
      setBusy('');
      setCancelOpen(false);
      setAgreed(hasAcceptedTerms());
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

  const askForTerms = shouldAskForTerms({
    termsAccepted: user?.termsAccepted,
    deviceAccepted: hasAcceptedTerms(),
  });

  const acceptTerms = (value) => {
    setAgreed(value);
    if (!value) return;
    acceptTermsOnAccount().catch(() => {});
  };

  const subscribe = (plan) => {
    if (askForTerms && !agreed) {
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

  const subscribeAction = (planId, isCurrent) => {
    if (isCurrent && billingPlan !== 'guest') return null;
    return { label: 'Subscribe', onClick: () => subscribe(planId) };
  };

  const manageBilling = () => run('portal', async () => {
    const data = await openBillingPortal();
    await openBillingUrl(data.url);
  });

  const watchForCredit = () => run('credit', async () => {
    const data = await watchAdForCredit();
    if (data?.granted) onOpenChange(false);
  });

  const redeem = (event) => {
    event.preventDefault();
    const attempt = redeemCode.trim();
    if (!attempt) {
      setError('Enter a code.');
      return;
    }
    if (askForTerms && !agreed) {
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            {outOfCalls && (
              <div className="rounded-2xl border border-border p-4 space-y-3">
                <p className="text-sm font-bold tracking-tight">This month’s AI limit is used up.</p>
                <p className="text-xs text-muted-foreground">
                  A finished ad adds 10 AI calls. Closing it early adds nothing.
                </p>
                <Button
                  type="button"
                  className="w-full h-11 rounded-2xl font-semibold"
                  disabled={!!busy}
                  onClick={watchForCredit}
                >
                  {busy === 'credit' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Watch an ad for 10 more calls'}
                </Button>
              </div>
            )}
            {(studyAction || partnerAction) && (
              <p className="text-xs text-muted-foreground leading-relaxed">{RENEWAL_NOTICE}</p>
            )}
            {askForTerms && (
              <TermsAgreement id="paywall-agree-terms" checked={agreed} onCheckedChange={acceptTerms} />
            )}
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

            {(studyAction || partnerAction) && (
              <div className="space-y-2">
                <Label htmlFor="plan-code">Code</Label>
                <Input
                  id="plan-code"
                  value={code}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Optional"
                  onChange={(event) => setCode(event.target.value)}
                  className="h-11 rounded-2xl"
                />
              </div>
            )}

            {canCancel && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-2xl"
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
                className="w-full h-11 rounded-2xl"
                disabled={!!busy}
                onClick={manageBilling}
              >
                {busy === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Manage billing'}
              </Button>
            )}

            {!billingPlan && (
              <form onSubmit={redeem} className="rounded-2xl border border-border p-4 space-y-3">
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
                  className="h-11 rounded-2xl"
                />
                <Button type="submit" className="w-full h-11 rounded-2xl font-semibold" disabled={!!busy}>
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
