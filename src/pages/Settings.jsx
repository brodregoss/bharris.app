import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Info,
  Compass,
  Shield,
  FileText,
  ChevronRight,
  Clipboard,
  Sparkles,
  LogOut,
  KeyRound,
  Pencil,
  Trash2,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/AuthContext';
import ChangePasswordSheet from '@/components/account/ChangePasswordSheet';
import EditNameSheet from '@/components/account/EditNameSheet';
import UsernameSheet from '@/components/account/UsernameSheet';
import { getCurrentUser, getUsage, removePartner, resetPartnerCode } from '@/lib/accountStore';
import { formatPersonName } from '@/lib/personName';
import { usePaywall } from '@/lib/PaywallContext';
import { planLabel, planValue } from '@/lib/plans';
import { trialRemainingLabel } from '../../scripts/account-plan.js';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import LegalSections from '@/components/account/LegalSections';
import {
  APP_NAME,
  APP_VERSION,
  ABOUT_SECTIONS,
  LEGAL_UPDATED,
} from '@/lib/legal';
import { devToolsUnlocked, lockDevTools, tryUnlockDevTools } from '@/lib/devToolsLock';
import { requestHomeTourReplay } from '@/lib/appTour';
import NotesScanLockCard from '@/components/account/NotesScanLockCard';
const DOCS = {
  about: {
    title: 'About',
    description: `${APP_NAME} ${APP_VERSION}`,
    sections: ABOUT_SECTIONS,
  },
};

function Row({ icon: Icon, label, value, valueClassName, onClick }) {
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
        {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs font-semibold">{label.slice(0, 1)}</span>}
      </span>
      <span className="min-w-0 flex-1 truncate text-left text-body text-foreground">{label}</span>
      {value && (
        <span className={`shrink-0 text-body font-semibold tabular-nums ${valueClassName || 'text-foreground'}`}>{value}</span>
      )}
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );

  const rowClass = 'press flex h-action w-full items-center gap-4 border-b border-border bg-surface-1 px-4 text-left last:border-b-0';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${rowClass} transition-colors active:bg-muted`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={rowClass}>
      {inner}
    </div>
  );
}

function maskPartnerCode(code) {
  const value = String(code || '');
  if (value.length <= 2) return value;
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 2)}`;
}

function usedPct(person) {
  if (!person || person.unlimited || !person.aiQuotaLimit) return 0;
  return Math.min(100, ((person.aiQuotaUsed || 0) / person.aiQuotaLimit) * 100);
}

function UsageBlock({ heading, person, onUpgrade, loading = false }) {
  const remaining = person?.remainingQuota ?? 0;
  const used = person?.aiQuotaUsed || 0;
  const limit = person?.aiQuotaLimit || 0;
  return (
    <div className="py-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">{heading}</p>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-label="Loading usage" />}
      </div>
      {person?.unlimited ? (
        <p className="mt-2 text-sm text-muted-foreground">No monthly limit.</p>
      ) : person?.hasBudget || remaining > 0 ? (
        <>
          <p className="mt-2 text-[2.6rem] font-semibold leading-none tracking-tighter tabular-nums">
            {remaining}
          </p>
          <p className="mt-2 text-sm font-semibold text-gain">
            {used} used · {limit} this month
          </p>
          <Progress value={usedPct(person)} className="mt-3 h-1.5" />
          <p className="mt-2 text-xs text-muted-foreground">{planLabel(person)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm font-semibold text-loss">
          This month’s AI limit is used up.
        </p>
      )}
      {person?.subscriptionTier !== 'pro' && onUpgrade && (
        <Button className="mt-4 h-12 w-full rounded-full" onClick={onUpgrade}>
          See plans
        </Button>
      )}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const light = resolvedTheme === 'light';
  const { user, firebaseUser, logout, deleteAccount } = useAuth();
  const { openPaywall } = usePaywall();
  const [doc, setDoc] = React.useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);
  const [editNameOpen, setEditNameOpen] = React.useState(false);
  const [usernameOpen, setUsernameOpen] = React.useState(false);
  const [usage, setUsage] = React.useState(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');
  const [partnerBusy, setPartnerBusy] = React.useState('');
  const [signingOut, setSigningOut] = React.useState(false);
  const [partnerNote, setPartnerNote] = React.useState('');
  const [codeShown, setCodeShown] = React.useState(false);
  const [devCode, setDevCode] = React.useState('');
  const accountUid = firebaseUser?.uid || user?.uid || '';
  const [devUnlocked, setDevUnlocked] = React.useState(() => devToolsUnlocked());

  React.useEffect(() => {
    setDevUnlocked(devToolsUnlocked(accountUid));
  }, [accountUid]);
  const [devCodeError, setDevCodeError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await getUsage();
        if (!cancelled) setUsage(next);
      } catch {
        if (!cancelled) setUsage({ me: user });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const open = DOCS[doc];
  const me = usage?.me || usage?.user || user;
  const billingPlan = me?.billingPlan || '';
  const onTrial = me?.subscriptionStatus === 'trialing' && !!me?.trialEndsAt;
  const trialLabel = onTrial ? trialRemainingLabel(me.trialEndsAt) : '';
  const profile = getCurrentUser();
  const displayName = me?.displayName || user?.displayName || firebaseUser?.displayName || profile?.displayName || '';
  const email = me?.email || user?.email || firebaseUser?.email || profile?.email || '';
  const username = String(me?.username || user?.username || profile?.username || '').trim();

  const runPartner = async (action, key) => {
    setPartnerBusy(key);
    setPartnerNote('');
    setCodeShown(false);
    try {
      const data = await action();
      if (data?.user) setUsage((current) => ({ ...(current || {}), me: data.user, user: data.user }));
    } catch (err) {
      setPartnerNote(err instanceof Error ? err.message : 'Could not update the partner code.');
    } finally {
      setPartnerBusy('');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-5 pt-safe">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back" className="-ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="mt-6 text-display text-foreground">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-24 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setUsernameOpen(true)}
                  className="min-w-0 truncate text-left text-lg font-semibold tracking-tight"
                >
                  {username ? `@${username}` : 'Choose a username'}
                </button>
                <button
                  type="button"
                  onClick={() => setUsernameOpen(true)}
                  aria-label={username ? 'Edit username' : 'Choose a username'}
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                <p className="min-w-0 truncate text-sm text-muted-foreground">
                  {formatPersonName(displayName) || email || 'Notes sync to this account.'}
                </p>
                <button
                  type="button"
                  onClick={() => setEditNameOpen(true)}
                  aria-label="Edit name"
                  className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="px-1 text-sm font-medium text-muted-foreground">Appearance</p>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Appearance">
              <button
                type="button"
                aria-pressed={!light}
                onClick={() => setTheme('dark')}
                className={`flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold ${
                  light ? 'text-muted-foreground' : 'bg-background text-foreground'
                }`}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
              <button
                type="button"
                aria-pressed={light}
                onClick={() => setTheme('light')}
                className={`flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold ${
                  light ? 'bg-background text-foreground' : 'text-muted-foreground'
                }`}
              >
                <Sun className="h-4 w-4" />
                Light
              </button>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-card border border-border">
            <Row
              icon={KeyRound}
              label="Change password"
              onClick={() => setChangePasswordOpen(true)}
            />
            <div>
              <Row
                icon={Sparkles}
                label="Manage plan"
                value={planValue(me)}
                onClick={() => navigate('/manage')}
              />
              {trialLabel && (
                <p className="mt-1.5 pl-4 text-sm text-gain">{trialLabel}</p>
              )}
            </div>
            <UsageBlock heading="AI calls left" person={me} onUpgrade={openPaywall} loading={!usage} />
            {me?.billingNotice === 'beta_ended' && !me?.billingPlan && (
              <p className="pb-3 text-sm text-muted-foreground">Your free week ended.</p>
            )}
            {me?.billingPlan === 'guest' && (
              <p className="pb-3 text-sm text-muted-foreground">
                You're on a friend's partner study plan. If they cancel, you both lose access.
              </p>
            )}
          </div>

          {me?.billingPlan === 'partner' && (
            <section className="mt-2 border-t border-border py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold tracking-tight">Partner code</p>
                <button
                  type="button"
                  title="Copy code"
                  aria-label="Copy code"
                  disabled={!me.partnerCode || !!partnerBusy}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground disabled:opacity-40"
                  onClick={async () => {
                    if (!me.partnerCode) return;
                    await navigator.clipboard.writeText(me.partnerCode);
                    setPartnerNote('Code copied.');
                  }}
                >
                  <Clipboard className="w-4 h-4" />
                  Copy code
                </button>
              </div>
              <button
                type="button"
                className="mt-2 text-left font-mono text-sm tracking-wide break-all"
                aria-label={codeShown ? 'Cover code' : 'Reveal code'}
                disabled={!me.partnerCode}
                onClick={() => setCodeShown((shown) => !shown)}
              >
                {me.partnerCode
                  ? (codeShown ? me.partnerCode : maskPartnerCode(me.partnerCode))
                  : 'Your code will show here after the plan is active.'}
              </button>
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 rounded-full"
                  disabled={!!partnerBusy || !me.partnerCode}
                  onClick={() => {
                    if (!window.confirm('Reset the code? The old one will stop working.')) return;
                    runPartner(resetPartnerCode, 'reset');
                  }}
                >
                  {partnerBusy === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset code'}
                </Button>
                {me.partnerLinked && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12 rounded-full"
                    disabled={!!partnerBusy}
                    onClick={() => {
                      if (!window.confirm('Remove your partner? They lose access now.')) return;
                      runPartner(removePartner, 'remove');
                    }}
                  >
                    {partnerBusy === 'remove' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove partner'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Resetting makes the old code stop working. Canceling the plan ends access for both of you when the period ends.
              </p>
              {partnerNote && <p className="text-sm mt-2">{partnerNote}</p>}
            </section>
          )}

          <section className="border-t border-border py-4">
            <p className="text-sm font-medium text-muted-foreground">Dev tools</p>
            {devUnlocked ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 rounded-full"
                onClick={() => {
                  lockDevTools(accountUid);
                  setDevUnlocked(false);
                  setDevCode('');
                  setDevCodeError('');
                }}
              >
                Lock
              </Button>
            ) : (
              <form
                className="mt-3 flex items-center gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!devCode.trim()) return;
                  setDevCodeError('');
                  try {
                    await tryUnlockDevTools(devCode, accountUid);
                    setDevUnlocked(true);
                    setDevCode('');
                  } catch (err) {
                    setDevCodeError(err instanceof Error ? err.message : 'That code is wrong.');
                  }
                }}
              >
                <input
                  type="password"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={devCode}
                  onChange={(event) => {
                    setDevCode(event.target.value);
                    setDevCodeError('');
                  }}
                  aria-label="Dev tools code"
                  placeholder="Dev code"
                  className="h-12 min-w-0 flex-1 rounded-full border border-border bg-transparent px-4 text-base"
                />
                <Button type="submit" variant="secondary" className="h-12 shrink-0 rounded-full" disabled={!devCode.trim()}>
                  Unlock
                </Button>
              </form>
            )}
            {devCodeError && (
              <p className="text-xs text-destructive mt-2">{devCodeError}</p>
            )}
          </section>

          {devUnlocked && <NotesScanLockCard />}

          <section className="mt-6 overflow-hidden rounded-card border border-border">
            <Row label="Version" value={APP_VERSION} />
            <Row
              icon={Compass}
              label="Show me around"
              onClick={() => {
                requestHomeTourReplay();
                navigate('/');
              }}
            />
            <Row icon={Info} label="About" onClick={() => setDoc('about')} />
            <Row icon={Shield} label="Privacy Policy" onClick={() => navigate('/privacy')} />
            <Row icon={FileText} label="Terms of Service" onClick={() => navigate('/terms')} />
          </section>

          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await logout();
                navigate('/account', { replace: true });
              } finally {
                setSigningOut(false);
              }
            }}
            className="press mt-6 flex h-action items-center justify-center gap-2 rounded-pill bg-surface-2 text-body font-semibold text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground disabled:text-tertiary"
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {signingOut ? 'Signing out' : 'Sign out'}
          </button>

          <button
            type="button"
            onClick={() => {
              setDeleteError('');
              setDeleteOpen(true);
            }}
            className="press mt-2 flex h-action items-center justify-center gap-2 rounded-pill bg-blank/12 text-body font-semibold text-blank transition-colors duration-150 ease-out hover:bg-blank/20"
          >
            <Trash2 className="w-4 h-4" />
            Delete account
          </button>

          <p className="mt-auto pt-8 text-center text-xs font-bold text-muted-foreground">
            Honorable Mention – Room 91B
          </p>
        </div>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your login, notes, and study sessions. It cannot be undone.
              An App Store subscription still has to be cancelled in iPhone Settings.
              A website subscription is cancelled with the account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                setDeleteError('');
                try {
                  await deleteAccount();
                  navigate('/account', { replace: true });
                } catch (err) {
                  setDeleteError(err instanceof Error ? err.message : 'Could not delete the account.');
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

      <UsernameSheet
        open={usernameOpen}
        onOpenChange={setUsernameOpen}
        username={username}
        onSaved={(nextUser) => {
          if (nextUser) setUsage((current) => ({ ...(current || {}), me: nextUser, user: nextUser }));
        }}
      />

      <EditNameSheet
        open={editNameOpen}
        onOpenChange={setEditNameOpen}
        displayName={displayName}
        onSaved={(nextUser) => {
          if (nextUser) setUsage((current) => ({ ...(current || {}), me: nextUser, user: nextUser }));
        }}
      />

      <ChangePasswordSheet
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
        firebaseUser={firebaseUser}
      />

      <Sheet open={!!doc} onOpenChange={(on) => { if (!on) setDoc(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85dvh] overflow-y-auto">
          {open && (
            <>
              <SheetHeader className="text-left pr-10">
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription>{open.description}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 pt-4 pb-6">
                <p className="text-xs text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
                <LegalSections sections={open.sections} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
