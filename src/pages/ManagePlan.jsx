import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/AuthContext';
import { cancelWebsitePlan, getUsage, openBillingPortal } from '@/lib/accountStore';
import { openBillingUrl } from '@/lib/billingUrl';
import { usePaywall } from '@/lib/PaywallContext';
import { planLabel } from '@/lib/plans';
import {
  canCancelWebsitePlan,
  cancelPlanConfirm,
  managePlanLines,
  ownsWebsitePlan,
  planPriceLabel,
} from '../../scripts/account-plan.js';

export default function ManagePlan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openPaywall } = usePaywall();
  const [person, setPerson] = React.useState(user);
  const [refreshing, setRefreshing] = React.useState(true);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [cancelOpen, setCancelOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getUsage()
      .then((next) => {
        if (!cancelled) setPerson(next?.me || next?.user || user);
      })
      .catch(() => {
        if (!cancelled) setPerson(user);
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  const me = person || user;
  const lines = managePlanLines(me);
  const price = planPriceLabel(me);
  const canCancel = canCancelWebsitePlan(me);
  const showPlans = !ownsWebsitePlan(me) && me?.billingPlan !== 'guest';

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

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-safe pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="min-w-0 truncate text-base font-bold tracking-tight">Manage plan</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="max-w-md mx-auto w-full flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-lg font-bold tracking-tight inline-flex items-center gap-2">
              {planLabel(me)}
              {refreshing && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Loading plan" />}
            </p>
            {price && <p className="text-sm text-muted-foreground mt-1">{price}</p>}
            <div className="mt-3 space-y-2">
              {lines.map((line) => (
                <p key={line} className="text-sm leading-5 text-muted-foreground">{line}</p>
              ))}
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2">
            {me?.hasBilling && (
              <Button
                type="button"
                className="h-11 rounded-2xl"
                disabled={!!busy}
                onClick={() => run('billing', async () => {
                  const data = await openBillingPortal();
                  await openBillingUrl(data.url);
                })}
              >
                {busy === 'billing' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update billing'}
              </Button>
            )}
            {showPlans && (
              <Button type="button" variant="outline" className="h-11 rounded-2xl" onClick={openPaywall}>
                See plans
              </Button>
            )}
            {canCancel && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-2xl text-destructive"
                disabled={!!busy}
                onClick={() => {
                  setError('');
                  setCancelOpen(true);
                }}
              >
                Cancel plan
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={(next) => { if (busy !== 'cancel') setCancelOpen(next); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {planLabel(me)}?</AlertDialogTitle>
            <AlertDialogDescription>{cancelPlanConfirm(me)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'cancel'}>Keep plan</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy === 'cancel'}
              onClick={() => run('cancel', async () => {
                const data = await cancelWebsitePlan();
                if (data?.user) setPerson(data.user);
                setCancelOpen(false);
              })}
            >
              {busy === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel plan'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
