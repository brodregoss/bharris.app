import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { afterAuthPath } from '@/lib/onboarding';

export default function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, unlock } = useAuth();
  const from = location.state?.from;
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  if (isAuthenticated) {
    return <Navigate to={from && from !== '/account' ? from : afterAuthPath()} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await unlock(pin);
      navigate(from && from !== '/account' ? from : afterAuthPath(), { replace: true });
    } catch (err) {
      setError(err.message || 'Wrong password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-safe text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">Welcome To</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-2 leading-[1.05]">
          Last Minute Study
        </h1>
        <p className="text-base text-muted-foreground mt-4">Enter the password to continue</p>
      </div>

      <footer className="px-6 pb-safe pt-4">
        <form onSubmit={handleSubmit} className="max-w-md mx-auto w-full flex flex-col gap-3">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <div className="space-y-2 text-left">
            <Label htmlFor="app-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="app-password"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="pl-10 h-14 rounded-2xl text-base"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="h-16 rounded-2xl text-lg font-bold shadow-lg"
            disabled={loading || !pin.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Unlocking…
              </>
            ) : (
              'Unlock'
            )}
          </Button>
        </form>
      </footer>
    </div>
  );
}
