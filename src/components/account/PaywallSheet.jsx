import React from 'react';
import { Capacitor } from '@capacitor/core';
import { Check, Loader2, Lock } from 'lucide-react';
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
import { PLANS } from '@/lib/plans';
import { useAuth } from '@/lib/AuthContext';
import { restorePurchases, revenueCatConfigured } from '@/lib/premiumAccess';
import { refreshUser, unlockStudyPro } from '@/lib/accountStore';
import { cn } from '@/lib/utils';

function PlanCard({ plan, current, highlight, onSelect }) {
  const className = cn(
    'rounded-2xl border p-4 text-left w-full',
    highlight ? 'border-foreground bg-card' : 'border-border bg-muted/40',
    onSelect && 'hover:bg-accent/40 transition',
  );
  const body = (
    <>
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
    </>
  );
  if (!onSelect) return <div className={className}>{body}</div>;
  return (
    <button type="button" onClick={onSelect} className={className}>
      {body}
    </button>
  );
}

export default function PaywallSheet({ open, onOpenChange }) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const isPro = user?.subscriptionTier === 'pro';
  const native = Capacitor.isNativePlatform() && revenueCatConfigured();

  React.useEffect(() => {
    if (open) return;
    setPasswordOpen(false);
    setPassword('');
    setPasswordError('');
    setError('');
  }, [open]);

  const askPassword = () => {
    setPassword('');
    setPasswordError('');
    setPasswordOpen(true);
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    const attempt = password.trim();
    if (!attempt) {
      setPasswordError('Enter the password.');
      return;
    }
    setLoading(true);
    setPasswordError('');
    try {
      await unlockStudyPro(attempt);
      setPasswordOpen(false);
      setPassword('');
      onOpenChange(false);
    } catch (err) {
      setPasswordError(err.message || 'That password is wrong.');
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
        {!passwordOpen && (
          <SheetHeader className="text-left pr-10">
            <SheetTitle>Plans</SheetTitle>
            <SheetDescription>
              Free gets you started. Study Pro is for the nights you need more AI.
            </SheetDescription>
          </SheetHeader>
        )}
        {passwordOpen ? (
          <form onSubmit={submitPassword} className="pt-2 pb-6">
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary text-primary-foreground mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Study Pro</h2>
            <p className="text-sm text-muted-foreground mt-1">Enter the password to unlock Study Pro.</p>
            <div className="space-y-2 mt-4">
              <Label htmlFor="pro-password">Password</Label>
              <Input
                id="pro-password"
                type="password"
                autoComplete="off"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-2xl"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive mt-3">{passwordError}</p>
            )}
            <Button type="submit" className="w-full h-12 rounded-2xl mt-4 font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Unlock'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground mt-3 py-2"
              onClick={() => setPasswordOpen(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </form>
        ) : (
        <div className="space-y-3 pt-4 pb-6">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <PlanCard plan={PLANS.free} current={!isPro} />
          <PlanCard
            plan={PLANS.pro}
            current={isPro}
            highlight
            onSelect={isPro ? undefined : askPassword}
          />
          {isPro ? (
            <p className="text-sm text-muted-foreground text-center pt-1">
              You are on Study Pro. Thanks for supporting the cram.
            </p>
          ) : (
            <Button
              className="w-full h-14 rounded-2xl text-base font-semibold"
              disabled={loading}
              onClick={askPassword}
            >
              Study Pro
            </Button>
          )}
          {native && (
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline underline-offset-4 py-2"
              disabled={loading}
              onClick={restore}
            >
              {loading && !passwordOpen ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Restore purchases'}
            </button>
          )}
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
