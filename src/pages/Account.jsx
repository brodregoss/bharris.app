import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { afterAuthPath } from '@/lib/onboarding';
import GoogleSignInButton from '@/components/account/GoogleSignInButton';

export default function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, authError, firebaseUser, retryCloud, signInWithGoogle } = useAuth();
  const from = location.state?.from;
  const [retrying, setRetrying] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [googleError, setGoogleError] = React.useState('');
  const safeFrom = from === '/' || from === '/welcome' || from === '/settings' || from === '/history' || from === '/practice';

  if (isAuthenticated) {
    return <Navigate to={safeFrom ? from : afterAuthPath()} replace />;
  }

  const handleGoogle = async () => {
    setGoogleError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      navigate(afterAuthPath(), { replace: true });
    } catch (err) {
      setGoogleError(err.message || 'Could not sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-safe text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">Welcome To</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-2 leading-[1.05]">
          Last Minute Study
        </h1>
        <p className="text-base text-muted-foreground mt-4">Create an account or sign back in</p>
        {(authError || googleError) && (
          <div className="mt-4 max-w-sm mx-auto">
            <p className="text-sm text-destructive">{googleError || authError}</p>
            {firebaseUser && !googleError && (
              <Button
                variant="outline"
                className="mt-3 h-11 rounded-2xl"
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
                Try again
              </Button>
            )}
          </div>
        )}
      </div>

      <footer className="px-6 pb-safe pt-4">
        <div className="max-w-md mx-auto w-full flex flex-col gap-3">
          <GoogleSignInButton onClick={handleGoogle} loading={googleLoading} />
          <Button
            className="h-16 rounded-2xl text-lg font-bold shadow-lg"
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
