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
import { updateDisplayName } from '@/lib/accountStore';
import { firebaseErrorMessage, firebaseUpdateDisplayName } from '@/lib/firebase';
import { joinPersonName, splitPersonName } from '@/lib/personName';

export default function EditNameSheet({ open, onOpenChange, displayName, onSaved }) {
  const [first, setFirst] = React.useState('');
  const [last, setLast] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const wasOpen = React.useRef(false);

  React.useEffect(() => {
    if (open && !wasOpen.current) {
      const parts = splitPersonName(displayName);
      setFirst(parts.first);
      setLast(parts.last);
      setError('');
      setSaving(false);
    }
    wasOpen.current = open;
  }, [open, displayName]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!first.trim()) {
      setError('Enter your first name.');
      return;
    }
    const name = joinPersonName(first, last);
    if (!name) {
      setError('Enter your first name.');
      return;
    }
    if (name.length > 80) {
      setError('That name is too long.');
      return;
    }
    setSaving(true);
    try {
      const next = await updateDisplayName(name);
      try {
        await firebaseUpdateDisplayName(name);
      } catch {
        // The account name is already saved. The sign-in profile can catch up later.
      }
      onSaved?.(next);
      onOpenChange(false);
    } catch (err) {
      const message = err?.code
        ? firebaseErrorMessage(err)
        : (err instanceof Error ? err.message : '');
      setError(message || 'Could not save your name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="text-left pr-10">
          <SheetTitle>Edit name</SheetTitle>
          <SheetDescription>
            This is the name on your account and in the home greeting.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-4 pb-6">
          {error && (
            <div className="p-3 rounded-2xl bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              type="text"
              autoComplete="given-name"
              autoFocus
              placeholder="First name"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="h-12 rounded-2xl"
              maxLength={40}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              type="text"
              autoComplete="family-name"
              placeholder="Last name"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              className="h-12 rounded-2xl"
              maxLength={40}
            />
          </div>
          <Button type="submit" className="w-full h-12 rounded-2xl" disabled={saving}>
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
