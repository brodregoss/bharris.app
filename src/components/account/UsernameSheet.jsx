import React from 'react';
import { Loader2 } from 'lucide-react';
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
import { updateUsername } from '@/lib/accountStore';
import { parseUsername, typedUsername } from '@/lib/username';
import { cn } from '@/lib/utils';

export default function UsernameSheet({ open, onOpenChange, username, onSaved, className }) {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const wasOpen = React.useRef(false);

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
    <Sheet open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <SheetContent side="bottom" className={cn('rounded-t-3xl max-h-[85dvh] overflow-y-auto', className)}>
        <SheetHeader className="text-left pr-10">
          <SheetTitle>{username ? 'Edit username' : 'Choose a username'}</SheetTitle>
          <SheetDescription>
            This name shows on your home screen. Only your account can have it.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-4 pb-6">
          {error && (
            <div className="p-3 rounded-card bg-destructive/10 text-destructive text-sm">
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
                onChange={(event) => setValue(typedUsername(event.target.value))}
                className="h-12 rounded-full pl-8"
                maxLength={20}
                required
              />
            </div>
            <p className="text-sm text-muted-foreground">
              3 to 20 characters. Start with a letter. Letters, numbers, and underscores.
            </p>
          </div>
          <Button type="submit" className="w-full h-12 rounded-full" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
