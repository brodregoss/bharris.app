import React from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthShell from '@/components/AuthShell';
import AppleSignInButton from '@/components/account/AppleSignInButton';
import GoogleSignInButton from '@/components/account/GoogleSignInButton';
import { useAuth } from '@/lib/AuthContext';
import { afterAuthPath, leaveForAuthReturn, rememberAuthReturn } from '@/lib/onboarding';

export default function AccountSignIn() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { isAuthenticated, isLoadingAuth, signIn, signInWithApple, signInWithGoogle } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  React.useEffect(() => {
    rememberAuthReturn();
  }, []);

  const finish = () => {
    if (!leaveForAuthReturn()) navigate(afterAuthPath(), { replace: true });
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading your account</span>
      </div>
    );
  }

  if (isAuthenticated) {
    if (leaveForAuthReturn()) return null;
    return <Navigate to={afterAuthPath()} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      finish();
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setError('');
    setAppleLoading(true);
    try {
      await signInWithApple();
      finish();
    } catch (err) {
      setError(err.message || 'Could not sign in with Apple.');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) finish();
    } catch (err) {
      setError(err.message || 'Could not sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Use the email on your account"
      onBack={() => navigate('/account')}
    >
      {error && (
        <div className="mb-4 p-3 rounded-2xl bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <AppleSignInButton onClick={handleApple} loading={appleLoading} disabled={loading || googleLoading} />
        <GoogleSignInButton onClick={handleGoogle} loading={googleLoading} disabled={loading || appleLoading} />
      </div>
      <p className="text-center text-xs text-muted-foreground my-4">or use email</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 rounded-2xl"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/account/forgot"
              state={{ email }}
              className="text-xs font-medium text-foreground underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 rounded-2xl"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-14 rounded-2xl text-base font-semibold" disabled={loading || googleLoading || appleLoading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-6">
        New here?{' '}
        <Link to={{ pathname: '/account/create', search }} className="text-foreground font-medium underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
