import React from 'react';
import { Loader2, Lock } from 'lucide-react';
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
import {
  firebaseChangePassword,
  firebaseErrorMessage,
  firebaseHasPasswordProvider,
} from '@/lib/firebase';

export default function ChangePasswordSheet({ open, onOpenChange, firebaseUser }) {
  const hasPassword = firebaseHasPasswordProvider(firebaseUser);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState('');
  const [updated, setUpdated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setError('');
      setUpdated(false);
      setSaving(false);
    }
  }, [open]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await firebaseChangePassword(currentPassword, newPassword);
      setUpdated(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85dvh] overflow-y-auto">
        <SheetHeader className="text-left pr-10">
          <SheetTitle>Change password</SheetTitle>
          <SheetDescription>
            {hasPassword
              ? 'Enter your current password, then choose a new one.'
              : 'This account signs in with Google, so there is no password to change.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pt-4 pb-6">
          {error && (
            <div className="p-3 rounded-2xl bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          {updated && (
            <p className="text-sm text-foreground">
              Password updated. Use the new one next time you sign in.
            </p>
          )}

          {hasPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pl-10 h-12 rounded-2xl"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 h-12 rounded-2xl"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-10 h-12 rounded-2xl"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 rounded-2xl" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Change password'
                )}
              </Button>
            </form>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
