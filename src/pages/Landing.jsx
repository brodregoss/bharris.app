import React from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Timer, History, Settings, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadSession, loadFinishedSession } from '@/lib/sessionStore';
import { ONBOARDING_FLAG } from '@/lib/onboarding';

// Persistent home base. The only job here is getting the user into a session
// in one tap, with zero decisions to weigh. Everything informational lives one
// tap deeper (Past sessions). First visit goes to Welcome; afterwards this
// landing is the entry. "Start new cram" returns to Welcome.
export default function Landing() {
  const navigate = useNavigate();
  // Read fresh on every render so the first-time redirect and the Continue
  // button never go stale if storage changes while the screen is mounted.
  const hasSession = typeof window !== 'undefined' ? !!loadSession() : false;
  const onboarded = typeof window !== 'undefined' ? !!localStorage.getItem(ONBOARDING_FLAG) : false;
  const finishedSession = typeof window !== 'undefined' ? loadFinishedSession() : null;

  const restartCram = () => {
    if (!finishedSession) return;
    const resetTerms = finishedSession.terms.map((t) => ({
      ...t,
      recallHistory: [],
      correctStreak: 0,
      seen: false,
      testResult: null,
    }));
    navigate('/study', { state: { terms: resetTerms, setup: finishedSession.setup } });
  };

  const practice = () => {
    if (!finishedSession) return;
    navigate('/study', {
      state: {
        terms: finishedSession.terms,
        setup: finishedSession.setup,
        initialPhase: 'test',
        keepState: true,
      },
    });
  };

  // First time ever entering the app → welcome / notes-first setup.
  // An existing saved session also counts as having been onboarded.
  if (!onboarded && !hasSession) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* 1. Top corners — least-used actions, deliberately low emphasis */}
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/history')}
          aria-label="Past sessions"
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <History className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* 2. Center, quiet — logo + one short tagline, nothing to read */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white mb-4">
          <Timer className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Last Minute Study</h1>
        <p className="text-sm text-muted-foreground mt-1">Ready when you are.</p>
        {hasSession && (
          <button
            type="button"
            onClick={() => navigate('/panic')}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mt-3"
          >
            panic notes
          </button>
        )}
      </div>

      {/* 3. Bottom third — natural one-handed thumb zone */}
      <footer className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="max-w-md mx-auto w-full flex flex-col items-stretch gap-3">
          {hasSession ? (
            <>
              <Button
                onClick={() => navigate('/study')}
                className="h-16 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-lg font-bold shadow-lg shadow-slate-900/20"
              >
                <RotateCcw className="w-5 h-5 mr-2" /> Continue session
              </Button>
              <button
                type="button"
                onClick={() => navigate('/welcome')}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline self-center mt-1"
              >
                Start new cram
              </button>
            </>
          ) : (
            <>
              <Button
                onClick={() => navigate('/welcome')}
                className="h-16 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-lg font-bold shadow-lg shadow-slate-900/20"
              >
                Start new cram
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              {finishedSession && (
                <div className="flex items-center justify-center gap-4 mt-1">
                  <button
                    type="button"
                    onClick={restartCram}
                    className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    restart cram?
                  </button>
                  <span className="text-muted-foreground/40">·</span>
                  <button
                    type="button"
                    onClick={practice}
                    className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    practice
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}