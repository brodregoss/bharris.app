import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import AuthShell from '@/components/AuthShell';
import { firebaseErrorMessage, firebaseResetPassword } from '@/lib/firebase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await firebaseResetPassword(email);
      setSent(true);
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Reset password"
      subtitle="We'll email a reset link if that account exists"
    >
      {error && (
        <div className="mb-4 p-3 rounded-2xl bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {sent ? (
        <p className="text-sm text-foreground text-center">
          If an account exists with that email, you'll receive a password reset link shortly.
        </p>
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
