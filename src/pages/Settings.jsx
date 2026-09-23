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
  Sparkles,
  LogOut,
  KeyRound,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/AuthContext';
import ChangePasswordSheet from '@/components/account/ChangePasswordSheet';
import { getUsage } from '@/lib/accountStore';
import { formatPersonName } from '@/lib/personName';
import { greetingLine, greetingNameStyle, setGreetingNameStyle } from '@/lib/greeting';
import { usePaywall } from '@/lib/PaywallContext';
import { planLabel } from '@/lib/plans';
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
    description: 'The rules for using Last Minute Study.',
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
            {used} used · {person?.subscriptionTier === 'pro' ? 'Study Pro' : 'Free'}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          This month’s AI limit is used up.
        </p>
      )}
      {person?.subscriptionTier !== 'pro' && onUpgrade && (
        <Button className="w-full h-11 rounded-2xl" onClick={onUpgrade}>
          Upgrade to Pro
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
  const [usage, setUsage] = React.useState(null);
  const [nameStyle, setNameStyle] = React.useState(() => greetingNameStyle());
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');

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
  const displayName = me?.displayName || firebaseUser?.displayName || '';
  const greetingPreview = greetingLine(displayName, new Date(), nameStyle);

  const chooseGreetingName = (style) => {
    setGreetingNameStyle(style);
    setNameStyle(style);
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
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight truncate">
                  {formatPersonName(me?.displayName) || me?.email || APP_NAME}
                </p>
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
            <Row
              icon={Sparkles}
              label="Plan"
              value={planLabel(me)}
              onClick={openPaywall}
            />
            <UsageBlock heading="AI this month" person={me} onUpgrade={openPaywall} />
          </section>

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
