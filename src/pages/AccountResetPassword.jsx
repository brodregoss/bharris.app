import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthShell from '@/components/AuthShell';
import {
  firebaseConfirmResetPassword,
  firebaseErrorMessage,
  firebaseVerifyResetCode,
} from '@/lib/firebase';

export default function AccountResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const oobCode = params.get('oobCode') || '';
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [checking, setChecking] = React.useState(!!oobCode);
  const [done, setDone] = React.useState(false);
  const [linkInvalid, setLinkInvalid] = React.useState(!oobCode);

  React.useEffect(() => {
    let cancelled = false;
    if (!oobCode) {
      setChecking(false);
      setLinkInvalid(true);
      setError('This reset link is missing or invalid.');
      return undefined;
    }
    (async () => {
      try {
        const nextEmail = await firebaseVerifyResetCode(oobCode);
        if (!cancelled) setEmail(nextEmail);
      } catch (err) {
        if (!cancelled) {
          setLinkInvalid(true);
          setError(firebaseErrorMessage(err));
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await firebaseConfirmResetPassword(oobCode, password);
      setDone(true);
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="New password"
      subtitle={email ? `For ${email}` : 'Choose a new password'}
      onBack={() => navigate('/account/signin')}
    >
      {error && (
        <div className="mb-4 p-3 rounded-2xl bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {checking ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : done ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground">Password updated. Sign in with the new one.</p>
          <Button className="w-full h-14 rounded-2xl text-base font-semibold" onClick={() => navigate('/account/signin', { replace: true })}>
            Sign in
          </Button>
        </div>
      ) : linkInvalid ? (
        <Button asChild className="w-full h-14 rounded-2xl text-base font-semibold">
          <Link to="/account/forgot">Request a new link</Link>
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 rounded-2xl"
                minLength={8}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirm"
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
          <Button type="submit" className="w-full h-14 rounded-2xl text-base font-semibold" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Save password'
            )}
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link to="/account/signin" className="text-foreground font-medium underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
