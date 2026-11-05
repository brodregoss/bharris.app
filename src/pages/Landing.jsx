import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { History, Settings, RotateCcw, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { loadSession, loadFinishedSession, loadLatestCram, listSessionPace } from '@/lib/sessionStore';
import { getCurrentUser } from '@/lib/accountStore';
import { isOnboarded } from '@/lib/onboarding';
import { continueStudyPath, normalizeStudyMode, STUDY_MODE, trueCramPracticeState } from '@/lib/studyUtils';
import { spacedContinueLabel } from '@/lib/spacedCram';
import { useDebug } from '@/lib/DebugContext';
import { useAuth } from '@/lib/AuthContext';
import { planForUser } from '@/lib/plans';
import UsernameSheet from '@/components/account/UsernameSheet';
import DotSphere from '@/components/home/DotSphere';
import AppLogo from '@/components/AppLogo';
import {
  formatCount,
  minutesCutTotal,
  paceCopy,
  quoteForDay,
  secondsLeftInDay,
  sessionPace,
  studiedTermCount,
} from '@/lib/homeBoard';

const STATS = [
  { id: 'seconds', label: 'seconds left' },
  { id: 'terms', label: 'terms studied' },
  { id: 'saved', label: 'minutes you save' },
];

// Persistent home base. The only job here is getting the user into a session
// in one tap, with zero decisions to weigh. Everything informational lives one
// tap deeper (Past sessions). First visit goes to Welcome; afterwards this
// landing is the entry. "Start new cram" returns to Welcome.
export default function Landing() {
  const navigate = useNavigate();
  const dbg = useDebug();
  const { user, firebaseUser } = useAuth();
  const [now, setNow] = React.useState(() => new Date());
  const [confirmNew, setConfirmNew] = React.useState(false);
  const [usernameOpen, setUsernameOpen] = React.useState(false);
  const [statIndex, setStatIndex] = React.useState(0);
  const [remoteSets, setRemoteSets] = React.useState([]);
  const [sessionTick, setSessionTick] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setSessionTick((n) => n + 1);
    window.addEventListener('lms:session', bump);
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.removeEventListener('lms:session', bump);
      window.clearInterval(clock);
    };
  }, []);
  React.useEffect(() => {
    let cancelled = false;
    listSessionPace()
      .then((rows) => {
        if (!cancelled) setRemoteSets(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionTick]);
  // Read fresh on every render so the first-time redirect and the Continue
  // button never go stale if storage changes while the screen is mounted.
  const hasSession = typeof window !== 'undefined' ? !!loadSession() : false;
  const activeSession = typeof window !== 'undefined' ? loadSession() : null;
  const onboarded = typeof window !== 'undefined' ? isOnboarded() : false;
  const finishedSession = typeof window !== 'undefined' ? loadFinishedSession() : null;
  const activeMode = normalizeStudyMode(activeSession?.setup?.studyMode);
  const continueLabel =
    activeMode === STUDY_MODE.SPACED_CRAM
      ? spacedContinueLabel(activeSession?.spaced, Date.now() + (dbg?.clockOffset || 0))
      : 'Continue session';

  const restartCram = () => {
    if (!finishedSession) return;
    const resetTerms = finishedSession.terms.map((t) => ({
      ...t,
      recallHistory: [],
      correctStreak: 0,
      seen: false,
      testResult: null,
      srs: t.srs ? { introduced: false } : undefined,
      pile: undefined,
    }));
    navigate(continueStudyPath(finishedSession.setup), {
      state: { terms: resetTerms, setup: finishedSession.setup },
    });
  };

  const profile = user || firebaseUser || getCurrentUser();
  const username = String(user?.username || profile?.username || '').trim();
  const showHome = onboarded || hasSession;
  const paid = planForUser(user || profile).id !== 'free';
  const studied = studiedTermCount([activeSession, finishedSession].filter(Boolean));
  const paceSource = activeSession?.terms?.length ? activeSession : finishedSession;
  const ahead = sessionPace(paceSource);
  const pace = paceCopy(ahead);
  const savedMinutes = minutesCutTotal([
    ...remoteSets,
    activeSession,
    finishedSession,
  ]);
  const statValue = statIndex === 1
    ? studied
    : statIndex === 2
      ? savedMinutes
      : secondsLeftInDay(now);
  const quote = quoteForDay(now);
  const showStat = (index) => setStatIndex(((index % STATS.length) + STATS.length) % STATS.length);

  React.useEffect(() => {
    if (!showHome || !user?.uid || username) return;
    setUsernameOpen(true);
  }, [showHome, user?.uid, username]);

  const startNewCram = () => {
    setConfirmNew(false);
    navigate('/welcome');
  };

  const practice = () => {
    const session = loadLatestCram();
    const cram = trueCramPracticeState(session);
    navigate('/practice', cram ? { state: cram } : undefined);
  };

  // First time ever entering the app → welcome / notes-first setup.
  // An existing saved session also counts as having been onboarded.
  if (!onboarded && !hasSession) {
    return <Navigate to="/welcome" replace />;
  }

  const box = 'h-14 rounded-full text-base font-semibold transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 active:translate-y-0 active:duration-100';

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] w-full flex-col px-5 sm:px-10 xl:px-16">
      <header className="flex items-center justify-between gap-3 pt-safe">
        <h1 className="flex min-w-0 items-center gap-[0.22em] pt-1 text-[clamp(1.7rem,7vw,2.65rem)] font-bold leading-none tracking-tight sm:text-5xl">
          <span className="truncate">bharris.app</span>
          <AppLogo className="h-[0.92em] w-auto shrink-0" />
        </h1>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            data-tour="history"
            onClick={() => navigate('/history')}
            aria-label="Past sessions"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-accent hover:text-foreground active:translate-y-0"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            data-tour="settings"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-accent hover:text-foreground active:translate-y-0"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-8 py-8 lg:flex-row lg:items-center lg:justify-center lg:gap-20 xl:gap-28">
        <div className="min-w-0 w-full lg:max-w-xl">
            <p className="flex items-center gap-1.5 text-[1.35rem] font-semibold tracking-tight lg:text-2xl">
              <button
                type="button"
                onClick={() => setUsernameOpen(true)}
                className="min-w-0 truncate text-left"
                aria-label={username ? 'Edit username' : 'Choose a username'}
              >
                {username ? `@${username}` : 'Choose a username'}
              </button>
              {paid && (
                <BadgeCheck
                  className="h-5 w-5 shrink-0 text-sky-500"
                  role="img"
                  aria-label="Paid account"
                />
              )}
            </p>
            <button
              type="button"
              onClick={() => showStat(statIndex + 1)}
              className="mt-5 block text-left lg:mt-8"
              aria-label={`${formatCount(statValue)} ${STATS[statIndex].label}. Show the next number.`}
            >
              <span
                key={STATS[statIndex].id}
                className="stat-swap block whitespace-nowrap text-[clamp(2.6rem,6vw,5.5rem)] font-semibold leading-none tracking-tighter tabular-nums"
              >
                {formatCount(statValue)}
              </span>
            </button>
            <div className="mt-3 flex flex-col items-start gap-0.5">
              {STATS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => showStat(index)}
                  className={
                    index === statIndex
                      ? 'text-left text-sm font-semibold text-foreground'
                      : 'text-left text-sm text-muted-foreground hover:text-foreground'
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
            {pace ? (
              <p className="mt-4 flex flex-wrap items-baseline gap-x-3" aria-label={pace.text}>
                <span className="text-base font-medium tracking-tight text-foreground lg:text-lg">{pace.target}</span>
                <span
                  className={
                    pace.tone === 'behind'
                      ? 'text-lg font-semibold tracking-tight tabular-nums text-loss lg:text-xl'
                      : 'text-lg font-semibold tracking-tight tabular-nums text-gain lg:text-xl'
                  }
                >
                  {pace.place}
                </span>
              </p>
            ) : (
              <p className="mt-4 text-sm font-medium text-muted-foreground">Pace shows once you start.</p>
            )}
            <p className="mt-4 max-w-sm text-base font-bold leading-snug text-muted-foreground lg:mt-5 lg:text-lg">
              {quote}
            </p>
            <div className="mx-auto mt-8 aspect-square w-[min(100%,22rem)] lg:hidden">
              <DotSphere className="h-full w-full" />
            </div>

      <footer className="pb-safe pt-8">
        <div className="flex w-full flex-col items-stretch gap-3 pb-4">
          {hasSession ? (
            <Button
              onClick={() => navigate(continueStudyPath(activeSession?.setup))}
              className={`${box} text-lg`}
            >
              <RotateCcw className="h-5 w-5" />
              {continueLabel}
            </Button>
          ) : finishedSession ? (
            <Button data-tour="practice" onClick={practice} className={`${box} text-lg`}>
              Practice
            </Button>
          ) : (
            <Button data-tour="new-cram" onClick={() => setConfirmNew(true)} className={`${box} text-lg`}>
              Start new cram
            </Button>
          )}
          {hasSession && (
            <Button data-tour="practice" variant="secondary" onClick={practice} className={box}>
              Practice
            </Button>
          )}
          {!hasSession && finishedSession && (
            <Button data-tour="new-cram" variant="secondary" onClick={() => setConfirmNew(true)} className={box}>
              Start new cram
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3">
            {hasSession ? (
              <Button
                data-tour="new-cram"
                variant="secondary"
                onClick={() => setConfirmNew(true)}
                className={`${box} px-2 text-sm`}
              >
                Start new cram
              </Button>
            ) : finishedSession ? (
              <Button
                variant="secondary"
                onClick={restartCram}
                className={`${box} px-2 text-sm`}
              >
                Restart cram
              </Button>
            ) : null}
            <Button
              data-tour="panic"
              variant="secondary"
              onClick={() => navigate('/panic')}
              className={`${box} px-2 text-sm ${hasSession || finishedSession ? '' : 'col-span-2'}`}
            >
              Panic notes
            </Button>
          </div>
        </div>
      </footer>
        </div>
        <div className="hidden aspect-square w-[min(42vw,28rem)] shrink-0 lg:block">
          <DotSphere className="h-full w-full" />
        </div>
      </div>

      <UsernameSheet
        open={usernameOpen}
        onOpenChange={setUsernameOpen}
        username={username}
      />
      <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
        <AlertDialogContent className="rounded-card max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new cram?</AlertDialogTitle>
            <AlertDialogDescription>
              Your notes and progress stay on the Past sessions page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startNewCram}>Start new cram</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}