import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { continueStudyPath, normalizeStudyMode, STUDY_MODE } from '@/lib/studyUtils';
import {
  countDueReviews,
  countUnseen,
  ensureSrs,
  examDeadlineMs,
  forecastSpacedPlan,
  gradeSrs,
  planSpacedSitting,
  SITTING_RETIRE_THRESHOLD,
} from '@/lib/spacedCram';
import SpacedPlan from '@/components/study/SpacedPlan';
import RecallBlock from '@/components/study/RecallBlock';
import { loadSession, saveSession, saveFinishedSession, clearSession } from '@/lib/sessionStore';
import { getActiveUid } from '@/lib/userStorage';
import { withInferredMastery } from '@/lib/mastery';

function hydrate(location) {
  const ownerUid = getActiveUid();
  const { terms: rawTerms, setup: incomingSetup, sessionId } = location.state || {};
  if (rawTerms?.length) {
    const existing = loadSession();
    const terms = rawTerms.map(ensureSrs);
    return {
      id: sessionId || existing?.id,
      ownerUid,
      terms,
      setup: incomingSetup,
      spaced: existing?.spaced || { sittingIndex: 1, phase: 'plan' },
      title: incomingSetup?.title || existing?.title,
      noteId: existing?.noteId || null,
    };
  }
  const saved = loadSession();
  if (saved?.terms?.length) {
    return {
      id: saved.id,
      ownerUid,
      terms: saved.terms.map(ensureSrs),
      setup: saved.setup,
      spaced: saved.spaced || { sittingIndex: 1, phase: 'plan' },
      title: saved.title || saved.setup?.title,
      noteId: saved.noteId || null,
    };
  }
  return null;
}

export default function SpacedCram() {
  const location = useLocation();
  const navigate = useNavigate();
  const [init] = React.useState(() => hydrate(location));
  const [terms, setTerms] = React.useState(() => init?.terms || []);
  const [spaced, setSpaced] = React.useState(() => init?.spaced || { sittingIndex: 1, phase: 'plan' });
  const sessionIdRef = React.useRef(init?.id);
  const sittingResultsRef = React.useRef({});
  const setup = init?.setup;

  React.useEffect(() => {
    if (!init) return;
    if (getActiveUid() !== init.ownerUid) {
      navigate('/', { replace: true });
      return;
    }
    const saved = saveSession({
      id: sessionIdRef.current,
      setup,
      terms,
      phase: spaced.phase,
      spaced,
      title: init.title || setup?.title,
      noteId: init.noteId || null,
    });
    if (saved?.id) sessionIdRef.current = saved.id;
  }, [init, setup, terms, spaced, navigate]);

  const byId = React.useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);

  if (!init) return <Navigate to="/" replace />;
  if (normalizeStudyMode(setup?.studyMode) !== STUDY_MODE.SPACED_CRAM) {
    return <Navigate to={continueStudyPath(setup)} replace />;
  }

  const now = Date.now();
  const plan = planSpacedSitting(terms, { now, examTiming: setup?.examTiming });
  const forecast = forecastSpacedPlan(terms, setup?.examTiming);
  const dueCount = countDueReviews(terms, now);
  const unseenCount = countUnseen(terms);
  const queue = spaced.queue || [];
  const sittingTerms = queue.map((id) => byId.get(id)).filter(Boolean);
  const sittingN = spaced.sittingIndex || 1;

  const persistSitting = (nextSpaced, nextTerms) => {
    setSpaced(nextSpaced);
    if (nextTerms) setTerms(nextTerms);
  };

  const gradeSittingTerms = (currentTerms, { allHit = false } = {}) => {
    const sittingIds = spaced.queue || [];
    const deadline = examDeadlineMs(setup?.examTiming);
    const gradedAt = Date.now();
    const results = sittingResultsRef.current;
    return currentTerms.map((t) => {
      if (!sittingIds.includes(t.id)) return t;
      const last = results[t.id];
      if (!allHit && last == null) return t;
      const correct = allHit || last === 'got_it';
      return {
        ...t,
        seen: true,
        srs: gradeSrs(t.srs, correct, gradedAt, deadline),
      };
    });
  };

  const startSitting = () => {
    const nextPlan = planSpacedSitting(terms, { now: Date.now(), examTiming: setup?.examTiming });
    if (!nextPlan.queue.length) {
      persistSitting({ ...spaced, phase: 'caught_up', queue: [], queueIndex: 0 });
      return;
    }
    sittingResultsRef.current = {};
    persistSitting({
      ...spaced,
      phase: 'drill',
      queue: nextPlan.queue.map((t) => t.id),
      queueIndex: 0,
    });
  };

  const updateTerm = (id, patch) => {
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const logAttempt = (id, result) => {
    sittingResultsRef.current[id] = result;
    const at = Date.now();
    setTerms((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              seen: true,
              recallHistory: [...(t.recallHistory || []), { result: result === 'got_it' ? 'got' : 'missed', at }],
            }
          : t
      )
    );
  };

  const finishSitting = () => {
    setTerms((prev) => gradeSittingTerms(prev, { allHit: true }));
    setSpaced({
      ...spaced,
      phase: 'done',
      sittingIndex: sittingN + 1,
      queue: [],
      queueIndex: 0,
    });
  };

  const endToHome = () => {
    let nextTerms = terms;
    if (spaced.phase === 'drill') {
      nextTerms = gradeSittingTerms(terms);
      setTerms(nextTerms);
    }
    saveSession({
      id: sessionIdRef.current,
      setup,
      terms: nextTerms,
      phase: 'spaced_break',
      spaced: { ...spaced, phase: 'plan' },
      title: init.title || setup?.title,
      noteId: init.noteId || null,
    });
    navigate('/');
  };

  const finishAll = () => {
    saveFinishedSession({
      id: sessionIdRef.current,
      terms: withInferredMastery(terms),
      setup,
      title: setup?.title,
      finishedAt: Date.now(),
    });
    clearSession();
    navigate('/');
  };

  if (spaced.phase === 'plan' || spaced.phase === 'caught_up' || spaced.phase === 'done') {
    const isDone = spaced.phase === 'done';
    const nothingQueued = plan.queue.length === 0;
    const caughtUp = spaced.phase === 'caught_up' || nothingQueued;
    const statusLine = isDone && !nothingQueued
      ? `${dueCount} review${dueCount === 1 ? '' : 's'} due later, plus ${unseenCount} new still waiting.`
      : nothingQueued
        ? 'Come back when reviews are due, or finish if you are done studying this set.'
        : null;
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="px-3 pt-safe pb-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Home"
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 px-6 pb-4 overflow-y-auto">
          <div className="max-w-md mx-auto w-full">
            {statusLine && (
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {isDone && !nothingQueued ? 'Sitting done. ' : ''}
                {statusLine}
              </p>
            )}
            <SpacedPlan
              forecast={forecast}
              examTiming={setup?.examTiming}
              currentSitting={sittingN}
            />
          </div>
        </main>
        <footer className="px-6 pt-2 pb-safe">
          <div className="max-w-md mx-auto w-full flex flex-col gap-3">
            {!nothingQueued && (
              <Button className="h-14 rounded-2xl text-base font-semibold" onClick={startSitting}>
                {isDone ? 'Start next sitting' : 'Start this sitting'}
              </Button>
            )}
            <Button variant="outline" className="h-14 rounded-2xl text-base font-semibold" onClick={endToHome}>
              Come back later
            </Button>
            {(caughtUp || unseenCount === 0) && (
              <Button variant="ghost" className="h-12 rounded-2xl" onClick={finishAll}>
                Finish this set
              </Button>
            )}
            {isDone && (
              <Button variant="ghost" className="h-12 rounded-2xl" onClick={() => navigate('/practice')}>
                Practice hub
              </Button>
            )}
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-4 pt-safe pb-3 flex items-center justify-between border-b border-border">
        <button
          type="button"
          onClick={endToHome}
          aria-label="Home"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold">Sitting {sittingN}</p>
        <span className="w-11" />
      </header>
      <div className="flex-1 flex flex-col min-h-0">
        {sittingTerms.length ? (
          <RecallBlock
            key={queue.join('|')}
            terms={sittingTerms}
            retireThreshold={SITTING_RETIRE_THRESHOLD}
            blockLabel={`Sitting ${sittingN}`}
            examType={setup?.examType || 'mixed'}
            onUpdateTerm={updateTerm}
            onLogAttempt={logAttempt}
            onDone={finishSitting}
          />
        ) : (
          <p className="text-sm text-muted-foreground px-6 py-8">No cards in this sitting.</p>
        )}
      </div>
    </div>
  );
}
