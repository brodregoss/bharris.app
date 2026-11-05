import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AuthShell from '@/components/AuthShell';
import AgeFields from '@/components/account/AgeFields';
import { useAuth } from '@/lib/AuthContext';
import { saveAgeProfile } from '@/lib/accountStore';
import { signupBlockReason } from '@/lib/age';
import { cancelSocialSignup } from '@/lib/signupProfile';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AgeCheck() {
  const navigate = useNavigate();
  const { logout, deleteAccount } = useAuth();
  const [birthDate, setBirthDate] = React.useState('');
  const [guardianConsent, setGuardianConsent] = React.useState(false);
  const [referral, setReferral] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const message = signupBlockReason({ birthDate, guardianConsent });
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await saveAgeProfile({ birthDate, guardianConsent, referral });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that birthday.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      cancelSocialSignup();
      await logout();
      navigate('/account', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Before you study"
      title="Your birthday"
      subtitle="bharris.app is for ages 13 and up."
    >
      {error && (
        <div className="mb-4 p-3 rounded-card bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
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
        <Button type="submit" className="w-full h-14 rounded-full text-base font-semibold" disabled={loading}>
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
        disabled={signingOut}
        onClick={signOut}
        className="mt-6 w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        {signingOut ? 'Signing out' : 'Sign out'}
      </button>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="mt-3 w-full text-sm text-destructive hover:opacity-80"
      >
        Delete account
      </button>
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your login, notes, and study sessions. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  cancelSocialSignup();
                  await deleteAccount();
                  navigate('/account', { replace: true });
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not delete the account.');
                  setDeleteOpen(false);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete account'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthShell>
  );
}
