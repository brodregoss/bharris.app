import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { afterAuthPath, leaveForAuthReturn } from '@/lib/onboarding';
import { beginSocialSignup, cancelSocialSignup, settleSocialSignup } from '@/lib/signupProfile';
import AppleSignInButton from '@/components/account/AppleSignInButton';
import GoogleSignInButton from '@/components/account/GoogleSignInButton';
import TermsNotice from '@/components/account/TermsNotice';

export default function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth, authError, firebaseUser, retryCloud, signInWithApple, signInWithGoogle } = useAuth();
  const from = location.state?.from;
  const [retrying, setRetrying] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [socialError, setSocialError] = React.useState('');
  const safeFrom = from === '/' || from === '/welcome' || from === '/settings' || from === '/history' || from === '/practice';

  if (isLoadingAuth) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center" role="status" aria-live="polite">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
        <span className="sr-only">Loading your account</span>
      </div>
    );
  }

  if (isAuthenticated) {
    if (leaveForAuthReturn()) return null;
    return <Navigate to={safeFrom ? from : afterAuthPath()} replace />;
  }

  if (new URLSearchParams(window.location.search).get('googleStart') === '1') {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const handleApple = async () => {
    setSocialError('');
    beginSocialSignup();
    setAppleLoading(true);
    try {
      const signedIn = await signInWithApple();
      if (!signedIn) return;
      settleSocialSignup(signedIn);
      if (!leaveForAuthReturn()) navigate(afterAuthPath(), { replace: true });
    } catch (err) {
      cancelSocialSignup();
      setSocialError(err.message || 'Could not sign in with Apple.');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogle = async () => {
    setSocialError('');
    beginSocialSignup();
    setGoogleLoading(true);
    try {
      const signedIn = await signInWithGoogle();
      if (!signedIn) return;
      settleSocialSignup(signedIn);
      if (!leaveForAuthReturn()) navigate(afterAuthPath(), { replace: true });
    } catch (err) {
      cancelSocialSignup();
      setSocialError(err.message || 'Could not sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-safe text-center">
        <p className="text-label uppercase text-muted-foreground">Welcome To</p>
        <h1 className="mt-3 text-display text-foreground">
          bharris.app
        </h1>
        <p className="mt-4 text-meta text-muted-foreground">Create an account or sign back in</p>
        {(authError || socialError) && (
          <div className="mt-4 max-w-sm mx-auto">
            <p className="text-sm text-destructive">{socialError || authError}</p>
            {firebaseUser && !socialError && (
              <Button
                variant="outline"
                className="mt-3 h-11 rounded-full"
                disabled={retrying}
                onClick={async () => {
                  setRetrying(true);
                  try {
                    await retryCloud();
                  } catch {
                    // Error text stays on screen.
                  } finally {
                    setRetrying(false);
                  }
                }}
              >
                {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Try again'}
              </Button>
            )}
          </div>
        )}
      </div>

      <footer className="px-6 pb-safe pt-4">
        <div className="mx-auto flex w-full max-w-study flex-col gap-3">
          <TermsNotice action="continuing with Apple or Google" />
          <AppleSignInButton onClick={handleApple} loading={appleLoading} disabled={googleLoading} />
          <GoogleSignInButton onClick={handleGoogle} loading={googleLoading} disabled={appleLoading} />
          <Button
            className="w-full"
            onClick={() => navigate('/account/create')}
          >
            Create an account
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline self-center py-1"
            onClick={() => navigate('/account/signin')}
          >
            Sign in with email
          </button>
        </div>
      </footer>
    </div>
  );
}
