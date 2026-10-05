import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { firebaseErrorMessage, firebaseResetPassword } from '@/lib/firebase';

const RESEND_WAIT_SECONDS = 30;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [waitSeconds, setWaitSeconds] = useState(0);

  useEffect(() => {
    if (!sent || waitSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setWaitSeconds((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [sent, waitSeconds]);

  const sendReset = async () => {
    setError('');
    setLoading(true);
    try {
      await firebaseResetPassword(email);
      setSent(true);
      setWaitSeconds(RESEND_WAIT_SECONDS);
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await sendReset();
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Reset password"
      subtitle="Enter the email on your account"
      onBack={() => navigate('/account/signin')}
    >
      {error && (
        <div className="mb-4 p-3 rounded-2xl bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-foreground text-center">
            We sent a reset email to {email.trim()}. Open the newest one and tap Reset password. That button opens a bharris.app page where you choose the new password.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full h-14 rounded-2xl text-base font-semibold"
            disabled={loading || waitSeconds > 0}
            onClick={sendReset}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : waitSeconds > 0 ? (
              `Resend email in ${waitSeconds}s`
            ) : (
              'Resend email'
            )}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
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
          <Button type="submit" className="w-full h-14 rounded-2xl text-base font-semibold" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              'Send reset link'
            )}
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link to="/account/signin" className="text-foreground font-medium underline underline-offset-4">
          <ArrowLeft className="w-3 h-3 inline mr-1" />
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
