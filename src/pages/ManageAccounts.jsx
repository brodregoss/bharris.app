import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import LimitPicker from '@/components/account/LimitPicker';
import { useAuth } from '@/lib/AuthContext';
import { formatUsd } from '@/lib/accountStore';
import { isAdminGateOpen } from '@/lib/adminGate';

function spendLabel(account) {
  if (account.unlimited) return 'No monthly cap';
  if (!account.hasBudget) return 'No budget yet';
  return `${formatUsd(account.spentUsd || 0)} of ${formatUsd(account.monthlyLimitUsd)}`;
}

function usedPct(account) {
  if (account.unlimited || !account.monthlyLimitUsd) return 0;
  return Math.min(100, ((account.spentUsd || 0) / account.monthlyLimitUsd) * 100);
}

export default function ManageAccounts() {
  const navigate = useNavigate();
  const { listAccounts, setAccountLimit } = useAuth();
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [amount, setAmount] = React.useState(3);
  const [unlimited, setUnlimited] = React.useState(false);

  const load = React.useCallback(async () => {
    setError('');
    try {
      setAccounts(await listAccounts());
    } catch (err) {
      setError(err.message || 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  }, [listAccounts]);

  React.useEffect(() => {
    if (!isAdminGateOpen()) return;
    load();
  }, [load]);

  if (!isAdminGateOpen()) {
    return <Navigate to="/settings" replace />;
  }

  const openEditor = (account) => {
    setEditing(account);
    setUnlimited(!!account.unlimited);
    setAmount(account.monthlyLimitUsd ?? 3);
  };

  const save = async ({ pause = false } = {}) => {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await setAccountLimit(editing.email, pause
        ? { monthlyLimitUsd: null, unlimited: false }
        : { monthlyLimitUsd: unlimited ? null : amount, unlimited });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not save that cap.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-safe pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold tracking-tight">Accounts</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="max-w-md mx-auto w-full flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            You set each account’s monthly AI cap. People using the app cannot change it.
          </p>
          {error && (
            <div className="p-3 rounded-2xl bg-destructive/10 text-destructive text-sm">{error}</div>
          )}
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts yet.</p>
          ) : (
            accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => openEditor(account)}
                className="w-full text-left rounded-2xl border border-border bg-card p-4 space-y-2 hover:bg-accent/40 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold tracking-tight truncate">{account.email}</p>
                  {account.isAdmin && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{spendLabel(account)}</p>
                {account.hasBudget && !account.unlimited && (
                  <Progress value={usedPct(account)} className="h-1.5" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <Sheet open={!!editing} onOpenChange={(on) => { if (!on) setEditing(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {editing && (
            <>
              <SheetHeader className="text-left pr-10">
                <SheetTitle>Monthly AI cap</SheetTitle>
                <SheetDescription>{editing.email}</SheetDescription>
              </SheetHeader>
              <div className="pt-4 pb-6 space-y-4">
                <LimitPicker
                  value={amount}
                  unlimited={unlimited}
                  onChange={(next) => {
                    setUnlimited(false);
                    setAmount(next);
                  }}
                  onUnlimited={() => setUnlimited(true)}
                />
                <Button
                  onClick={() => save()}
                  className="w-full h-12 rounded-2xl font-semibold"
                  disabled={saving || (!unlimited && !(Number(amount) >= 0.5))}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save cap'}
                </Button>
                <button
                  type="button"
                  onClick={() => save({ pause: true })}
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                  disabled={saving}
                >
                  Remove budget (blocks study AI)
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
