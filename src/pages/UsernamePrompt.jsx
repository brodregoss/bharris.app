import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthShell from '@/components/AuthShell';
import { useAuth } from '@/lib/AuthContext';
import { UsernameAvailability, useUsernameAvailability } from '@/components/account/UsernameAvailability';
import { updateUsername } from '@/lib/accountStore';
import { clearUsernamePrompt } from '@/lib/signupProfile';
import { parseUsername, typedUsername } from '@/lib/username';

export default function UsernamePrompt() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [username, setUsername] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const availability = useUsernameAvailability(username);

  const submit = async (event) => {
    event.preventDefault();
    if (availability.status === 'taken' || availability.status === 'checking') return;
    const parsed = parseUsername(username);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const next = await updateUsername(parsed.username);
      if (next?.username !== parsed.username) {
        setError('Could not save that username.');
        return;
      }
      clearUsernamePrompt();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that username.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      clearUsernamePrompt();
      await logout();
      navigate('/account', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <AuthShell
      eyebrow="One more step"
      title="Choose a username"
      subtitle="This is the name on your home screen. Only your account can have it."
    >
      {error && (
        <div className="mb-4 p-3 rounded-card bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-username">Username</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground">
              @
            </span>
            <Input
              id="new-username"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              autoFocus
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
            Start with a letter. Letters, numbers, and underscores.
          </p>
          <UsernameAvailability status={availability.status} note={availability.note} />
        </div>
        <Button
          type="submit"
          className="w-full h-14 rounded-full text-base font-semibold"
          disabled={loading || availability.status === 'taken' || availability.status === 'checking' || availability.status === 'invalid'}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </form>
      <button
        type="button"
        disabled={signingOut || loading}
        onClick={signOut}
        className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        {signingOut ? 'Signing out' : 'Sign out'}
      </button>
    </AuthShell>
  );
}
