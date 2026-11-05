import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  firebaseConfirmResetPassword,
  firebaseErrorMessage,
  firebaseVerifyResetCode,
} from '@/lib/firebase';

function returnToSignIn(navigate) {
  if (Capacitor.isNativePlatform()) {
    navigate('/account/signin', { replace: true });
    return;
  }
  window.location.href = 'bharris://signin';
}

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
      returnToSignIn(navigate);
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-5 pt-safe">
        <button
          type="button"
          onClick={() => navigate('/account/signin')}
          aria-label="Back"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">bharris.app</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-2 leading-[1.05]">
          New password
        </h1>
        <p className="text-base text-muted-foreground mt-4 max-w-sm">
          {email ? `For ${email}` : 'Choose a new password. This link works once.'}
        </p>
        {error && <p className="text-sm text-destructive mt-4 max-w-sm">{error}</p>}
      </div>
      <footer className="px-6 pb-safe pt-4">
        <div className="max-w-md mx-auto w-full flex flex-col gap-3">
          {checking ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : done ? (
            <>
              <div className="flex justify-center text-know">
                <ShieldCheck className="w-8 h-8" aria-hidden="true" />
              </div>
              <Button className="h-16 rounded-full text-lg font-bold" onClick={() => returnToSignIn(navigate)}>
                Open bharris.app
              </Button>
            </>
          ) : linkInvalid ? (
            <Button asChild className="h-16 rounded-full text-lg font-bold">
              <Link to="/account/forgot">Request a new link</Link>
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Label htmlFor="password" className="sr-only">New password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-16 rounded-full text-base"
                  minLength={8}
                  required
                />
              </div>
              <Label htmlFor="confirm" className="sr-only">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-11 h-16 rounded-full text-base"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="h-16 rounded-full text-lg font-bold" disabled={loading}>
                {loading ? 'Saving…' : 'Save password'}
              </Button>
            </form>
          )}
        </div>
      </footer>
    </div>
  );
}
