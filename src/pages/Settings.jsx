import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  ArrowLeft,
  Moon,
  Sun,
  User,
  Info,
  Shield,
  FileText,
  ChevronRight,
  Clipboard,
  Sparkles,
  LogOut,
  KeyRound,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/AuthContext';
import ChangePasswordSheet from '@/components/account/ChangePasswordSheet';
import EditNameSheet from '@/components/account/EditNameSheet';
import { getUsage, removePartner, resetPartnerCode } from '@/lib/accountStore';
import { formatPersonName } from '@/lib/personName';
import { greetingLine, greetingNameStyle, setGreetingNameStyle } from '@/lib/greeting';
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
import {
  APP_NAME,
  APP_VERSION,
  ABOUT_SECTIONS,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
} from '@/lib/legal';
import { devToolsUnlocked, tryUnlockDevTools } from '@/lib/devToolsLock';

const DOCS = {
  about: {
    title: 'About',
    description: `${APP_NAME} ${APP_VERSION}`,
    sections: ABOUT_SECTIONS,
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How this app handles your notes and data.',
    sections: PRIVACY_SECTIONS,
  },
  terms: {
    title: 'Terms of Service',
    description: 'The rules for using bharris.app.',
    sections: TERMS_SECTIONS,
  },
};

function Row({ icon: Icon, label, value, onClick }) {
  const inner = (
    <>
      {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      <span className="flex-1 text-sm font-semibold text-left">{label}</span>
      {value && (
        <span className="text-sm text-muted-foreground shrink-0">{value}</span>
      )}
      {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-accent/60 transition text-left"
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="w-full flex items-center gap-3 px-5 py-3.5">
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

function UsageBlock({ heading, person, onUpgrade }) {
  const remaining = person?.remainingQuota ?? 0;
  const used = person?.aiQuotaUsed || 0;
  const limit = person?.aiQuotaLimit || 0;
  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-sm font-bold tracking-tight">{heading}</p>
      </div>
      {person?.unlimited ? (
        <p className="text-sm text-muted-foreground">No monthly limit.</p>
      ) : person?.hasBudget || remaining > 0 ? (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-2xl font-bold tracking-tight">
              {remaining}
            </p>
            <p className="text-xs text-muted-foreground">
              of {limit} AI calls left this month
            </p>
          </div>
          <Progress value={usedPct(person)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {used} used · {planLabel(person)}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This month’s AI limit is used up.
        </p>
      )}
      {person?.subscriptionTier !== 'pro' && onUpgrade && (
        <Button className="w-full h-11 rounded-2xl" onClick={onUpgrade}>
          See plans
        </Button>
      )}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, firebaseUser, logout, deleteAccount } = useAuth();
  const { openPaywall } = usePaywall();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [ready, setReady] = React.useState(false);
  const [doc, setDoc] = React.useState(null);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);
  const [editNameOpen, setEditNameOpen] = React.useState(false);
  const [usage, setUsage] = React.useState(null);
  const [nameStyle, setNameStyle] = React.useState(() => greetingNameStyle());
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');
  const [partnerBusy, setPartnerBusy] = React.useState(false);
  const [partnerNote, setPartnerNote] = React.useState('');
  const [codeShown, setCodeShown] = React.useState(false);
  const [devCode, setDevCode] = React.useState('');
  const [devUnlocked, setDevUnlocked] = React.useState(() => devToolsUnlocked());
  const [devCodeError, setDevCodeError] = React.useState(false);

  React.useEffect(() => {
    setReady(true);
  }, []);

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

  const dark = ready && (resolvedTheme || theme) === 'dark';
  const open = DOCS[doc];
  const me = usage?.me || usage?.user || user;
  const billingPlan = me?.billingPlan || '';
  const onTrial = me?.subscriptionStatus === 'trialing' && !!me?.trialEndsAt;
  const trialLabel = onTrial ? trialRemainingLabel(me.trialEndsAt) : '';
  const displayName = me?.displayName || firebaseUser?.displayName || '';
  const greetingPreview = greetingLine(displayName, new Date(), nameStyle);

  const chooseGreetingName = (style) => {
    setGreetingNameStyle(style);
    setNameStyle(style);
  };

  const runPartner = async (action) => {
    setPartnerBusy(true);
    setPartnerNote('');
    setCodeShown(false);
    try {
      const data = await action();
      if (data?.user) setUsage((current) => ({ ...(current || {}), me: data.user, user: data.user }));
    } catch (err) {
      setPartnerNote(err instanceof Error ? err.message : 'Could not update the partner code.');
    } finally {
      setPartnerBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-safe pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="min-w-0 truncate text-base font-bold tracking-tight">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-24 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            <div className="flex items-center gap-3 p-5">
              <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 min-w-0">
                  <p className="min-w-0 truncate text-sm font-bold tracking-tight">
                    {formatPersonName(me?.displayName) || me?.email || APP_NAME}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditNameOpen(true)}
                    aria-label="Edit name"
                    className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {me?.email || 'Notes sync to this account.'}
                </p>
              </div>
            </div>
            <Row
              icon={KeyRound}
              label="Change password"
              onClick={() => setChangePasswordOpen(true)}
            />
          </section>

          <section className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            <div>
              <Row
                icon={Sparkles}
                label="Manage plan"
                value={planValue(me)}
                onClick={() => navigate('/manage')}
              />
              {trialLabel && (
                <p className="pl-12 pr-5 pb-3.5 -mt-1.5 text-sm leading-5 text-muted-foreground">
                  {trialLabel}
                </p>
              )}
            </div>
            <UsageBlock heading="AI this month" person={me} onUpgrade={openPaywall} />
            {me?.billingNotice === 'beta_ended' && !me?.billingPlan && (
              <div className="px-5 pb-5">
                <p className="text-xs text-muted-foreground">Your free week ended.</p>
              </div>
            )}
            {me?.billingPlan === 'guest' && (
              <div className="px-5 pb-5">
                <p className="text-xs text-muted-foreground">
                  You're on a friend's partner study plan. If they cancel, you both lose access.
                </p>
              </div>
            )}
          </section>

          {me?.billingPlan === 'partner' && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold tracking-tight">Partner code</p>
                <button
                  type="button"
                  title="Copy code"
                  aria-label="Copy code"
                  disabled={!me.partnerCode || partnerBusy}
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
                  variant="outline"
                  className="h-11 rounded-xl"
                  disabled={partnerBusy || !me.partnerCode}
                  onClick={() => {
                    if (!window.confirm('Reset the code? The old one will stop working.')) return;
                    runPartner(resetPartnerCode);
                  }}
                >
                  Reset code
                </Button>
                {me.partnerLinked && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    disabled={partnerBusy}
                    onClick={() => {
                      if (!window.confirm('Remove your partner? They lose access now.')) return;
                      runPartner(removePartner);
                    }}
                  >
                    Remove partner
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Resetting makes the old code stop working. Canceling the plan ends access for both of you when the period ends.
              </p>
              {partnerNote && <p className="text-sm mt-2">{partnerNote}</p>}
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold tracking-tight">Greeting name</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Home says {greetingPreview}.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={nameStyle === 'first' ? 'default' : 'outline'}
                className="h-11 rounded-xl text-sm font-semibold"
                onClick={() => chooseGreetingName('first')}
              >
                First name
              </Button>
              <Button
                type="button"
                variant={nameStyle === 'last' ? 'default' : 'outline'}
                className="h-11 rounded-xl text-sm font-semibold"
                onClick={() => chooseGreetingName('last')}
              >
                Last name
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                {dark ? (
                  <Moon className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <Label htmlFor="dark-mode" className="text-sm font-bold tracking-tight">
                    Dark mode
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dark ? 'On — easier on the eyes at night' : 'Off — light background'}
                  </p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={dark}
                onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')}
                disabled={!ready}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold tracking-tight">Dev tools</p>
            {devUnlocked ? (
              <p className="text-xs text-muted-foreground mt-1">On</p>
            ) : (
              <form
                className="mt-3 flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (tryUnlockDevTools(devCode)) {
                    setDevUnlocked(true);
                    setDevCode('');
                    setDevCodeError(false);
                    return;
                  }
                  setDevCodeError(true);
                }}
              >
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={devCode}
                  onChange={(event) => {
                    setDevCode(event.target.value);
                    setDevCodeError(false);
                  }}
                  aria-label="Dev tools code"
                  placeholder="Code"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
                />
                <Button type="submit" variant="outline" className="h-11 rounded-xl shrink-0">
                  Unlock
                </Button>
              </form>
            )}
            {devCodeError && (
              <p className="text-xs text-destructive mt-2">Wrong code</p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            <Row label="Version" value={APP_VERSION} />
            <Row icon={Info} label="About" onClick={() => setDoc('about')} />
            <Row icon={Shield} label="Privacy Policy" onClick={() => setDoc('privacy')} />
            <Row icon={FileText} label="Terms of Service" onClick={() => setDoc('terms')} />
          </section>

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/account', { replace: true });
            }}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>

          <button
            type="button"
            onClick={() => {
              setDeleteError('');
              setDeleteOpen(true);
            }}
            className="flex items-center justify-center gap-2 text-sm text-destructive hover:opacity-80"
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
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                {open.sections.map((s) => (
                  <div key={s.title}>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
