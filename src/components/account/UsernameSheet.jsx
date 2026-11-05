import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UsernameAvailability, useUsernameAvailability } from '@/components/account/UsernameAvailability';
import { updateUsername } from '@/lib/accountStore';
import { parseUsername, typedUsername, usernameChangeReadyAt } from '@/lib/username';
import { cn } from '@/lib/utils';

function readyLabel(changedAt) {
  const ready = usernameChangeReadyAt(changedAt);
  if (!ready) return '';
  return new Date(ready).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function UsernameSheet({ open, onOpenChange, username, changedAt, onSaved, className }) {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const wasOpen = React.useRef(false);
  const lockedUntil = readyLabel(changedAt);
  const availability = useUsernameAvailability(value, username);

  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setValue(typedUsername(username));
      setError('');
      setSaving(false);
    }
    wasOpen.current = open;
  }, [open, username]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (lockedUntil || availability.status === 'taken' || availability.status === 'checking') return;
    setError('');
    const parsed = parseUsername(value);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    try {
      const next = await updateUsername(parsed.username);
      if (next?.username !== parsed.username) {
        setError('Could not save that username.');
        return;
      }
      onSaved?.(next);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that username.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className={cn('max-w-sm', className)}>
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{username ? 'Edit username' : 'Choose a username'}</DialogTitle>
          <DialogDescription>
            {lockedUntil
              ? `You can change it again on ${lockedUntil}.`
              : 'This name shows on your home screen. You can change it once a day.'}
          </DialogDescription>
        </DialogHeader>

        {lockedUntil ? (
          <Button type="button" className="h-12 w-full rounded-full" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="rounded-card bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground">
                  @
                </span>
                <Input
                  id="username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  autoFocus
                  placeholder="yourname"
                  value={value}
                  onChange={(event) => {
                    setValue(typedUsername(event.target.value));
                    setError('');
                  }}
                  className="h-12 rounded-full pl-8"
                  maxLength={20}
                  required
                />
              </div>
              <p className="text-sm text-muted-foreground">
                3 to 20 characters. Start with a letter. Letters, numbers, and underscores.
              </p>
              <UsernameAvailability status={availability.status} note={availability.note} />
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-full"
              disabled={saving || availability.status === 'taken' || availability.status === 'checking' || availability.status === 'invalid'}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
