import React from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthShell from '@/components/AuthShell';
import AppleSignInButton from '@/components/account/AppleSignInButton';
import GoogleSignInButton from '@/components/account/GoogleSignInButton';
import TermsNotice from '@/components/account/TermsNotice';
import AgeFields from '@/components/account/AgeFields';
import { useAuth } from '@/lib/AuthContext';
import { afterAuthPath, leaveForAuthReturn, rememberAuthReturn } from '@/lib/onboarding';
import { signupBlockReason } from '@/lib/age';
import { ensureCloudUser } from '@/lib/accountStore';
import { beginSocialSignup, cancelSocialSignup, clearSignupProfile, settleSocialSignup, stageSignupProfile } from '@/lib/signupProfile';
import { UsernameAvailability, useUsernameAvailability } from '@/components/account/UsernameAvailability';
import { parseUsername, typedUsername } from '@/lib/username';

export default function AccountCreate() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { firebaseUser, isAuthenticated, isLoadingAuth, createAccount, signInWithApple, signInWithGoogle } = useAuth();
  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const [guardianConsent, setGuardianConsent] = React.useState(false);
  const [referral, setReferral] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const availability = useUsernameAvailability(username);

  React.useEffect(() => {
    rememberAuthReturn();
  }, []);

  const chosenUsername = () => {
    if (availability.status === 'taken') {
      setError('That username is taken.');
      return '';
    }
    if (availability.status === 'checking') return '';
    const parsed = parseUsername(username);
    if (parsed.error) {
      setError(parsed.error);
      return '';
    }
    return parsed.username;
  };

  const profileFor = (chosen) => ({ birthDate, guardianConsent, referral, username: chosen });

  const blockReason = () => {
    const message = signupBlockReason({ birthDate, guardianConsent, referral });
    if (message) setError(message);
    return message;
  };

  const saveCloud = async (chosen) => {
    stageSignupProfile(profileFor(chosen));
    if (!firebaseUser) return false;
    await ensureCloudUser(firebaseUser);
    return true;
  };

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
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      setError('Enter your name.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    const chosen = chosenUsername();
    if (!chosen || blockReason()) return;
    cancelSocialSignup();
    setLoading(true);
    try {
      if (!(await saveCloud(chosen))) {
        await createAccount(email, password, trimmedName);
      }
      finish();
    } catch (err) {
      setError(err.message || 'Could not create that account.');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setError('');
    beginSocialSignup();
    setAppleLoading(true);
    try {
      const signedIn = firebaseUser
        ? await ensureCloudUser(firebaseUser)
        : await signInWithApple();
      if (!signedIn) return;
      settleSocialSignup(signedIn);
      finish();
    } catch (err) {
      cancelSocialSignup();
      setError(err.message || 'Could not sign in with Apple.');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    beginSocialSignup();
    setGoogleLoading(true);
    try {
      const signedIn = firebaseUser
        ? await ensureCloudUser(firebaseUser)
        : await signInWithGoogle();
      if (!firebaseUser && !signedIn) return;
      settleSocialSignup(signedIn);
      finish();
    } catch (err) {
      cancelSocialSignup();
      setError(err.message || 'Could not sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome To"
      title="Create an account"
      subtitle="Apple or Google first. Username and birthday come next."
      onBack={() => {
        clearSignupProfile();
        navigate('/account');
      }}
    >
      {error && (
        <div className="mb-4 p-3 rounded-card bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <div className="space-y-3">
        <TermsNotice action="continuing with Apple or Google" />
        <AppleSignInButton
          onClick={handleApple}
          loading={appleLoading}
          disabled={loading || googleLoading}
        />
        <GoogleSignInButton
          onClick={handleGoogle}
          loading={googleLoading}
          disabled={loading || appleLoading}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground my-4">or use email</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <AgeFields
          birthDate={birthDate}
          onBirthDate={(value) => {
            setBirthDate(value);
            setGuardianConsent(false);
            setError('');
          }}
          guardianConsent={guardianConsent}
          onGuardianConsent={(value) => {
            setGuardianConsent(value);
            setError('');
          }}
          referral={referral}
          onReferral={setReferral}
          showReferral
        />
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
              placeholder="yourname"
              value={username}
              onChange={(event) => {
                setUsername(typedUsername(event.target.value));
                setError('');
              }}
              className="h-12 rounded-full pl-8"
              maxLength={20}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            This is the name on your home screen. Only your account can have it.
          </p>
          <UsernameAvailability status={availability.status} note={availability.note} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="First and last name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 h-12 rounded-full"
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
              className="pl-10 h-12 rounded-full"
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
              className="pl-10 h-12 rounded-full"
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
              className="pl-10 h-12 rounded-full"
              minLength={8}
              required
            />
          </div>
        </div>
        <TermsNotice action="creating an account" />
        <Button
          type="submit"
          className="w-full h-14 rounded-full text-base font-semibold"
          disabled={loading || googleLoading || appleLoading || availability.status === 'taken' || availability.status === 'checking' || availability.status === 'invalid'}
        >
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
        <Link to={{ pathname: '/account/signin', search }} className="text-foreground font-medium underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
