import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  enableScanLock,
  fetchScanLock,
  killScanLock,
} from '@/lib/notesScanLock';

export default function NotesScanLockCard() {
  const [status, setStatus] = React.useState(null);
  const [confirmKill, setConfirmKill] = React.useState(false);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    fetchScanLock()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load photo upload.');
      });
    return () => { cancelled = true; };
  }, []);

  const kill = async () => {
    setBusy('kill');
    setError('');
    try {
      const next = await killScanLock();
      setStatus(next);
      setConfirmKill(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn photo upload off.');
    } finally {
      setBusy('');
    }
  };

  const enable = async () => {
    setBusy('enable');
    setError('');
    try {
      const next = await enableScanLock();
      setStatus(next);
      setConfirmKill(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn photo upload on.');
    } finally {
      setBusy('');
    }
  };

  const active = !!status?.active;

  return (
    <section className="rounded-card border border-border bg-card p-5">
      <p className="text-sm font-bold tracking-tight">Photo upload</p>
      <p className="text-xs text-muted-foreground mt-1">
        {status
          ? (active
            ? 'On. People can scan photos without a password.'
            : 'Off. Photo upload is hidden until you turn it back on.')
          : 'Checking…'}
      </p>

      {active && !confirmKill && (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 rounded-full"
          disabled={!!busy || !status}
          onClick={() => setConfirmKill(true)}
        >
          Kill photo upload
        </Button>
      )}
      {active && confirmKill && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Photo upload stops for everyone until you turn it back on.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-full"
              disabled={!!busy}
              onClick={kill}
            >
              {busy === 'kill' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kill it now'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-full"
              disabled={!!busy}
              onClick={() => setConfirmKill(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {status && !active && (
        <Button
          type="button"
          className="mt-3 h-11 rounded-full"
          disabled={!!busy}
          onClick={enable}
        >
          {busy === 'enable' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Turn photo upload on'}
        </Button>
      )}
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </section>
  );
}
