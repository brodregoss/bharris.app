import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Timer, History, Settings, RotateCcw } from 'lucide-react';
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
import { loadSession, loadFinishedSession, loadLatestCram } from '@/lib/sessionStore';
import { isOnboarded } from '@/lib/onboarding';
import { continueStudyPath, normalizeStudyMode, STUDY_MODE, trueCramPracticeState } from '@/lib/studyUtils';
import { spacedContinueLabel } from '@/lib/spacedCram';
import { useDebug } from '@/lib/DebugContext';
import { useAuth } from '@/lib/AuthContext';
import { formatPersonName } from '@/lib/personName';

const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);

function dayPart(date) {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function lastNameFrom(displayName) {
  const parts = String(displayName || '').trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  return formatPersonName(parts.at(-1) || '');
}

function greetingLine(displayName, date) {
  const hello = `Good ${dayPart(date)}`;
  const last = lastNameFrom(displayName);
  return last ? `${hello}, ${last}` : hello;
}

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
  const [, setSessionTick] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setSessionTick((n) => n + 1);
    window.addEventListener('lms:session', bump);
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.removeEventListener('lms:session', bump);
      window.clearInterval(clock);
    };
  }, []);
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

  const displayName = user?.displayName || firebaseUser?.displayName || '';
  const greeting = greetingLine(displayName, now);

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

  const box = 'h-14 rounded-xl text-base font-semibold';

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-start justify-between gap-3 px-5 pt-safe">
        <h1 className="text-4xl font-bold tracking-tight leading-[1.05] pt-1">
          Last Minute Study
        </h1>
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => navigate('/history')}
            aria-label="Past sessions"
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <History className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-primary-foreground mb-4">
          <Timer className="w-6 h-6" />
        </div>
        <p className="text-3xl font-bold tracking-tight leading-tight">{greeting}</p>
        <p className="text-base text-muted-foreground mt-3 max-w-xs leading-relaxed">
          Ready when you are.
        </p>
      </div>

      <footer className="px-5 pb-safe pt-2">
        <div className="max-w-md mx-auto w-full flex flex-col items-stretch gap-3 pb-4">
          {hasSession && (
            <>
              <Button
                onClick={() => navigate(continueStudyPath(activeSession?.setup))}
                className={`${box} text-lg`}
              >
                <RotateCcw className="w-5 h-5" />
                {continueLabel}
              </Button>
              <Button variant="secondary" onClick={practice} className={box}>
                Practice
              </Button>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={hasSession ? 'secondary' : 'default'}
              onClick={() => setConfirmNew(true)}
              className={`${box} px-2 text-sm`}
            >
              Start new cram
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/panic')}
              className={`${box} px-2 text-sm`}
            >
              Panic notes
            </Button>
          </div>
          {!hasSession && finishedSession && (
            <>
              <Button variant="secondary" onClick={practice} className={box}>
                Practice
              </Button>
              <Button variant="secondary" onClick={restartCram} className={box}>
                Restart cram
              </Button>
            </>
          )}
        </div>
      </footer>

      <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
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
  );
}