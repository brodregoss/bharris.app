import React from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthShell from '@/components/AuthShell';
import AppleSignInButton from '@/components/account/AppleSignInButton';
import GoogleSignInButton from '@/components/account/GoogleSignInButton';
import { useAuth } from '@/lib/AuthContext';
import { afterAuthPath } from '@/lib/onboarding';

export default function AccountCreate() {
  const navigate = useNavigate();
  const { isAuthenticated, createAccount, signInWithApple, signInWithGoogle } = useAuth();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  if (isAuthenticated) {
    return <Navigate to={afterAuthPath()} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      setError('Enter your name.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await createAccount(email, password, trimmedName);
      navigate(afterAuthPath(), { replace: true });
    } catch (err) {
      setError(err.message || 'Could not create that account.');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setError('');
    setAppleLoading(true);
    try {
      await signInWithApple();
      navigate(afterAuthPath(), { replace: true });
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
      if (signedIn) navigate(afterAuthPath(), { replace: true });
    } catch (err) {
      setError(err.message || 'Could not sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome To"
      title="Create an account"
      subtitle="Then you can start cramming"
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
          <Label htmlFor="name">Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="name"
              type="text"
              autoComplete="name"
              autoFocus
              placeholder="First and last name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 h-12 rounded-2xl"
              maxLength={80}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 rounded-2xl"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
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
        <Button type="submit" className="w-full h-14 rounded-2xl text-base font-semibold" disabled={loading || googleLoading || appleLoading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have one?{' '}
        <Link to="/account/signin" className="text-foreground font-medium underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
