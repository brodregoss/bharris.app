import React from 'react';
import { Loader2 } from 'lucide-react';
import { fetchAccountStats } from '@/lib/accountStats';

function Count({ value, label }) {
  return (
    <div className="rounded-xl bg-background px-3 py-3">
      <p className="text-2xl font-bold tracking-tight tabular-nums">
        {value == null ? '—' : value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

export default function AccountStatsCard() {
  const [stats, setStats] = React.useState(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    fetchAccountStats()
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load account counts.');
      });
    return () => { cancelled = true; };
  }, []);

  const days = Number(stats?.activeDays) || 7;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-bold tracking-tight">Accounts</p>
      <p className="text-xs text-muted-foreground mt-1">
        {`Active means the account was used in the last ${days} days.`}
      </p>
      {error ? (
        <p className="text-xs text-destructive mt-3">{error}</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {stats ? (
            <>
              <Count value={stats.active} label="Active" />
              <Count value={stats.total} label="Total" />
            </>
          ) : (
            <div className="col-span-2 flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
