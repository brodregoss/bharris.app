import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PLANS } from '@/lib/plans';
import { useAuth } from '@/lib/AuthContext';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  revenueCatConfigured,
} from '@/lib/premiumAccess';
import { refreshUser } from '@/lib/accountStore';
import { cn } from '@/lib/utils';

function packagePrice(pkg, fallback) {
  return pkg?.product?.priceString || fallback;
}

function PlanCard({ plan, current, highlight }) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        highlight ? 'border-foreground bg-card' : 'border-border bg-muted/40',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold tracking-tight">{plan.name}</p>
        {current && (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{plan.blurb}</p>
      <ul className="mt-3 space-y-1.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PaywallSheet({ open, onOpenChange }) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [offering, setOffering] = React.useState(null);
  const isPro = user?.subscriptionTier === 'pro';

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    (async () => {
      try {
        const next = await getOfferings();
        if (!cancelled) setOffering(next.current);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load plans.');
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const monthly = offering?.monthly;
  const yearly = offering?.annual;
  const native = Capacitor.isNativePlatform() && revenueCatConfigured();

  const buy = async (pkg) => {
    if (!pkg) return;
    setLoading(true);
    setError('');
    try {
      await purchasePackage(pkg);
      await refreshUser();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Purchase did not finish.';
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setLoading(false);
    }
  };

  const restore = async () => {
    setLoading(true);
    setError('');
    try {
      await restorePurchases();
      await refreshUser();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore purchases.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="text-left pr-10">
          <SheetTitle>Plans</SheetTitle>
          <SheetDescription>
            Free gets you started. Study Pro is for the nights you need more AI.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 pt-4 pb-6">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <PlanCard plan={PLANS.free} current={!isPro} />
          <PlanCard plan={PLANS.pro} current={isPro} highlight />
          {isPro ? (
            <p className="text-sm text-muted-foreground text-center pt-1">
              You are on Study Pro. Thanks for supporting the cram.
            </p>
          ) : native ? (
            <>
              <Button
                className="w-full h-14 rounded-2xl text-base font-semibold justify-between px-5"
                disabled={loading || !yearly}
                onClick={() => buy(yearly)}
              >
                <span>Yearly</span>
                <span className="text-sm font-medium">
                  {packagePrice(yearly, PLANS.pro.yearlyPrice)}
                  <span className="block text-[11px] font-normal opacity-80">{PLANS.pro.yearlyNote}</span>
                </span>
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-semibold justify-between px-5"
                disabled={loading || !monthly}
                onClick={() => buy(monthly)}
              >
                <span>Monthly</span>
                <span>{packagePrice(monthly, PLANS.pro.monthlyPrice)}</span>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {Capacitor.isNativePlatform()
                ? 'Add the RevenueCat iOS key to buy Study Pro on this phone.'
                : `Study Pro is ${PLANS.pro.monthlyPrice}/month or ${PLANS.pro.yearlyPrice}/year on the iPhone app.`}
            </p>
          )}
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline underline-offset-4 py-2"
            disabled={loading}
            onClick={restore}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Restore purchases'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
