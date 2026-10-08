import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchScanLock,
  generateNotesScanCode,
  killScanLock,
  replaceScanLock,
} from '@/lib/notesScanLock';

export default function NotesScanLockCard() {
  const [status, setStatus] = React.useState(null);
  const [code, setCode] = React.useState('');
  const [confirmKill, setConfirmKill] = React.useState(false);
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  const codeRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchScanLock()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the notes password.');
      });
    return () => { cancelled = true; };
  }, []);

  const kill = async () => {
    setBusy('kill');
    setError('');
    setSaved(false);
    try {
      const next = await killScanLock();
      setStatus(next);
      setCode('');
      setConfirmKill(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn the code off.');
    } finally {
      setBusy('');
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy('save');
    setError('');
    setSaved(false);
    try {
      const next = await replaceScanLock(code);
      setStatus(next);
      setSaved(true);
      setConfirmKill(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the new code.');
    } finally {
      setBusy('');
    }
  };

  const generate = () => {
    const next = generateNotesScanCode();
    setCode(next);
    setSaved(false);
    setError('');
    window.setTimeout(() => codeRef.current?.select(), 0);
  };

  const active = !!status?.active;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm font-bold tracking-tight">Notes password</p>
      <p className="text-xs text-muted-foreground mt-1">
        {status
          ? (active
            ? 'On. Kill it to stop the current code immediately.'
            : 'Off. The old code no longer works.')
          : 'Checking…'}
      </p>

      {active && !confirmKill && (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 rounded-xl"
          disabled={!!busy}
          onClick={() => setConfirmKill(true)}
        >
          Kill current code
        </Button>
      )}
      {confirmKill && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            The current code stops working immediately, including phones that already unlocked.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              disabled={!!busy}
              onClick={kill}
            >
              {busy === 'kill' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kill it now'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={!!busy}
              onClick={() => setConfirmKill(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <form className="mt-4 flex flex-col gap-2" onSubmit={save}>
        <label htmlFor="notes-scan-code" className="text-xs font-medium text-muted-foreground">
          New code
        </label>
        <Input
          ref={codeRef}
          id="notes-scan-code"
          name="notes-scan-code"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setSaved(false);
          }}
          placeholder="At least 12 characters"
          className="h-11 rounded-xl"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={generate}>
            Generate
          </Button>
          <Button
            type="submit"
            className="h-11 rounded-xl"
            disabled={!!busy || code.trim().length < 12}
          >
            {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save new code'}
          </Button>
        </div>
      </form>
      {saved && (
        <p className="text-xs text-muted-foreground mt-2">
          New code is on. Copy it now. The previous code is dead.
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </section>
  );
}
