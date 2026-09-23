import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { continueStudyPath, normalizeStudyMode, STUDY_MODE, spacedCramAvailable } from '@/lib/studyUtils';
import {
  applySittingResults,
  buildSpacedSchedule,
  emptySpacedState,
  ensureSpaced,
  ensureSpacedTerm,
  lastSittingIndex,
  markTermsIntroduced,
  nextDueAfterSitting,
  nextNewStep,
  nextSittingWaitCopy,
  planSittingQueue,
  SESSION_TYPE,
  SESSION_TYPE_META,
  sittingByIndex,
  sittingIsReady,
  SITTING_RETIRE_THRESHOLD,
} from '@/lib/spacedCram';
import SpacedPlan from '@/components/study/SpacedPlan';
import SpacedFreeRecall from '@/components/study/SpacedFreeRecall';
import RecallBlock from '@/components/study/RecallBlock';
import SleepTimePicker from '@/components/study/SleepTimePicker';
import { loadSession, saveSession, saveFinishedSession, clearSession } from '@/lib/sessionStore';
import { getActiveUid } from '@/lib/userStorage';
import { withInferredMastery } from '@/lib/mastery';
import { useDebug } from '@/lib/DebugContext';

function hydrate(location) {
  const ownerUid = getActiveUid();
  const { terms: rawTerms, setup: incomingSetup, sessionId } = location.state || {};
  if (rawTerms?.length) {
    const existing = loadSession();
    const terms = rawTerms.map(ensureSpacedTerm);
    return {
      id: sessionId || existing?.id,
      ownerUid,
      terms,
      setup: incomingSetup,
      spaced: ensureSpaced({
        ...(existing?.spaced || emptySpacedState()),
        stopTime: existing?.spaced?.stopTime || existing?.stopTime || null,
      }),
      title: incomingSetup?.title || existing?.title,
      noteId: existing?.noteId || null,
    };
  }
  const saved = loadSession();
  if (saved?.terms?.length) {
    return {
      id: saved.id,
      ownerUid,
      terms: saved.terms.map(ensureSpacedTerm),
      setup: saved.setup,
      spaced: ensureSpaced({
        ...(saved.spaced || emptySpacedState()),
        stopTime: saved.spaced?.stopTime || saved.stopTime || null,
      }),
      title: saved.title || saved.setup?.title,
      noteId: saved.noteId || null,
    };
  }
  return null;
}

function drillLabel(sitting, spaced, schedule) {
  const meta = SESSION_TYPE_META[sitting?.type] || {};
  const chunkCount = schedule?.chunks?.length || 1;
  if (sitting?.type === SESSION_TYPE.NEW && chunkCount > 1) {
    const n = (spaced.chunkIndex || 0) + 1;
    if (spaced.subPhase === 'mini_rev') return `Sitting ${sitting.sitting} · mixed review ${n}/${chunkCount}`;
    return `Sitting ${sitting.sitting} · New ${n}/${chunkCount}`;
  }
  return `Sitting ${sitting?.sitting || 1} · ${meta.label || 'Drill'}`;
}

export default function SpacedCram() {
  const location = useLocation();
  const navigate = useNavigate();
  const [init] = React.useState(() => hydrate(location));
  const [terms, setTerms] = React.useState(() => init?.terms || []);
  const [spaced, setSpaced] = React.useState(() => init?.spaced || emptySpacedState());
  const [bedtimeDraft, setBedtimeDraft] = React.useState(() => init?.spaced?.stopTime || '');
  const sessionIdRef = React.useRef(init?.id);
  const sittingResultsRef = React.useRef({});
  const setup = init?.setup;
  const dbg = useDebug();
  const clockOffset = dbg?.clockOffset || 0;
  const clockOffsetRef = React.useRef(0);
  const [now, setNow] = React.useState(() => Date.now() + clockOffset);

  React.useEffect(() => {
    clockOffsetRef.current = clockOffset;
  }, [clockOffset]);

  React.useEffect(() => {
    const iv = setInterval(() => setNow(Date.now() + clockOffsetRef.current), 1000);
    return () => clearInterval(iv);
  }, []);

  React.useEffect(() => {
    setNow(Date.now() + clockOffset);
  }, [clockOffset]);

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
      stopTime: spaced.stopTime || null,
      title: init.title || setup?.title,
      noteId: init.noteId || null,
    });
    if (saved?.id) sessionIdRef.current = saved.id;
  }, [init, setup, terms, spaced, navigate]);

  const { reportSession, reportTerms } = dbg || {};
  const devOn = !!dbg?.enabled;
  React.useEffect(() => {
    if (!init || !devOn) return;
    reportSession?.({
      examTiming: setup?.examTiming,
      examType: setup?.examType,
      hoursAvailable: setup?.hours,
      studyMode: setup?.studyMode || 'spaced_cram',
      currentStep:
        spaced.phase === 'complete'
          ? 'complete'
          : spaced.phase === 'drill'
            ? `sitting ${spaced.sittingIndex || 1} drill`
            : `sitting ${spaced.sittingIndex || 1}`,
      stopTime: spaced.stopTime,
    });
  }, [init, devOn, reportSession, setup, spaced]);

  React.useEffect(() => {
    if (!devOn) return;
    reportTerms?.(terms);
  }, [devOn, reportTerms, terms]);

  const byId = React.useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);
  const schedule = React.useMemo(
    () => buildSpacedSchedule({ examTiming: setup?.examTiming, hours: setup?.hours, terms }),
    [setup?.examTiming, setup?.hours, terms]
  );

  if (!init) return <Navigate to="/" replace />;
  if (!spacedCramAvailable(setup?.examTiming)) {
    return <Navigate to="/" replace />;
  }
  if (normalizeStudyMode(setup?.studyMode) !== STUDY_MODE.SPACED_CRAM) {
    return <Navigate to={continueStudyPath(setup)} replace />;
  }

  const sittingN = spaced.sittingIndex || 1;
  const sitting = sittingByIndex(schedule, sittingN);
  const lastN = lastSittingIndex(schedule);
  const allDone = sittingN > lastN || spaced.phase === 'complete';
  const queue = spaced.queue || [];
  const sittingTerms = queue.map((id) => byId.get(id)).filter(Boolean);
  const ready = sittingIsReady(spaced, now);
  const waitCopy = nextSittingWaitCopy(spaced.nextDueAt, now);
  const needBedtime = !spaced.stopTime;

  const persistSitting = (nextSpaced, nextTerms) => {
    setSpaced(nextSpaced);
    if (nextTerms) setTerms(nextTerms);
  };

  const completeSitting = (currentTerms, fromSpaced = spaced) => {
    const finished = sittingByIndex(schedule, fromSpaced.sittingIndex || 1);
    const gradedAt = Date.now();
    persistSitting(
      {
        ...fromSpaced,
        phase: (fromSpaced.sittingIndex || 1) >= lastN ? 'complete' : 'done',
        sittingIndex: (fromSpaced.sittingIndex || 1) + 1,
        chunkIndex: 0,
        subPhase: 'new',
        queue: [],
        lastFinishedAt: gradedAt,
        nextDueAt: nextDueAfterSitting(finished, { stopTime: fromSpaced.stopTime, now: gradedAt }),
      },
      currentTerms
    );
  };

  const startSitting = (override = {}) => {
    const nextSpaced = { ...spaced, ...override };
    const nextQueue = planSittingQueue(terms, nextSpaced, schedule);
    if (!nextQueue.length) {
      completeSitting(terms, nextSpaced);
      return;
    }
    sittingResultsRef.current = {};
    persistSitting({
      ...nextSpaced,
      phase: 'drill',
      queue: nextQueue.map((t) => t.id),
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

  const onDrillDone = () => {
    const currentSitting = sittingByIndex(schedule, sittingN);
    let nextTerms = applySittingResults(terms, sittingResultsRef.current);
    if (currentSitting?.type === SESSION_TYPE.NEW) {
      nextTerms = markTermsIntroduced(nextTerms, spaced.queue);
      const step = nextNewStep(spaced, schedule);
      if (step.kind === 'mini_rev') {
        persistSitting(
          { ...spaced, phase: 'chunk_break', subPhase: 'mini_rev', chunkIndex: step.chunkIndex, queue: [] },
          nextTerms
        );
        return;
      }
      if (step.kind === 'next_chunk') {
        persistSitting(
          { ...spaced, phase: 'chunk_break', subPhase: 'new', chunkIndex: step.chunkIndex, queue: [] },
          nextTerms
        );
        return;
      }
    }
    completeSitting(nextTerms);
  };

  const endToHome = () => {
    let nextTerms = terms;
    if (spaced.phase === 'drill') {
      nextTerms = applySittingResults(terms, sittingResultsRef.current);
      if (sitting?.type === SESSION_TYPE.NEW) {
        nextTerms = markTermsIntroduced(nextTerms, spaced.queue);
      }
      setTerms(nextTerms);
    }
    saveSession({
      id: sessionIdRef.current,
      setup,
      terms: nextTerms,
      phase: 'spaced_break',
      spaced: { ...spaced, phase: spaced.phase === 'complete' ? 'complete' : 'plan' },
      stopTime: spaced.stopTime || null,
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

  const confirmBedtime = () => {
    if (!bedtimeDraft) return;
    persistSitting({ ...spaced, stopTime: bedtimeDraft });
  };

  if (needBedtime && spaced.phase !== 'drill') {
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
        <main className="flex-1 px-6 pb-4 overflow-y-auto flex flex-col items-center text-center">
          <div className="m-auto flex flex-col items-center w-full max-w-xs">
            <Moon className="w-10 h-10 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold tracking-tight mb-2">What time are you planning to sleep?</h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              The plan parks a full review right before bed. Sleep is the gap that makes this work.
            </p>
            <SleepTimePicker value={bedtimeDraft} onChange={setBedtimeDraft} />
            <Button
              disabled={!bedtimeDraft}
              onClick={confirmBedtime}
              className="h-12 px-8 rounded-2xl font-semibold"
            >
              Set sleep time
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (spaced.phase === 'chunk_break') {
    const chunkCount = schedule.chunks.length;
    const n = (spaced.chunkIndex || 0) + 1;
    const copy =
      spaced.subPhase === 'mini_rev'
        ? `Chunk ${n} of ${chunkCount} learned. Mixed review of chunks 1–${n} next.`
        : `Mixed review done. Chunk ${n} of ${chunkCount} next.`;
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="px-3 pt-safe pb-2">
          <button
            type="button"
            onClick={endToHome}
            aria-label="Home"
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 px-6 pb-4 flex flex-col items-center justify-center text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Chunk learned</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{copy}</p>
          </div>
        </main>
        <footer className="px-6 pt-2 pb-safe">
          <div className="max-w-md mx-auto w-full flex flex-col gap-3">
            <Button className="h-14 rounded-2xl text-base font-semibold" onClick={() => startSitting()}>
              Continue
            </Button>
            <Button variant="outline" className="h-14 rounded-2xl text-base font-semibold" onClick={endToHome}>
              Come back later
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  if (spaced.phase === 'plan' || spaced.phase === 'done' || spaced.phase === 'complete' || allDone) {
    const justFinished = spaced.phase === 'done';
    const finishedAll = spaced.phase === 'complete' || allDone;
    const statusLine = finishedAll
      ? 'That’s the last sitting. Sleep if you can — then you’re as ready as this plan gets.'
      : justFinished && waitCopy
        ? `Sitting done. ${waitCopy}.`
        : justFinished
          ? 'Sitting done. Start the next one when you’re ready.'
          : waitCopy && !ready
            ? waitCopy
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
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{statusLine}</p>
            )}
            <SpacedPlan
              schedule={schedule}
              currentSitting={finishedAll ? lastN + 1 : sittingN}
              spaced={spaced}
              terms={terms}
            />
          </div>
        </main>
        <footer className="px-6 pt-2 pb-safe">
          <div className="max-w-md mx-auto w-full flex flex-col gap-3">
            {!finishedAll && ready && (
              <Button className="h-14 rounded-2xl text-base font-semibold" onClick={() => startSitting()}>
                {justFinished ? 'Start next sitting' : 'Start this sitting'}
              </Button>
            )}
            {!finishedAll && !ready && (
              <>
                <Button disabled className="h-14 rounded-2xl text-base font-semibold bg-muted text-muted-foreground">
                  {waitCopy || 'Come back later'}
                </Button>
                <button
                  type="button"
                  onClick={() => startSitting()}
                  className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline self-center"
                >
                  Start anyway
                </button>
              </>
            )}
            <Button variant="outline" className="h-14 rounded-2xl text-base font-semibold" onClick={endToHome}>
              Come back later
            </Button>
            {finishedAll && (
              <Button className="h-14 rounded-2xl text-base font-semibold" onClick={finishAll}>
                Finish this set
              </Button>
            )}
          </div>
        </footer>
      </div>
    );
  }

  const mixReverse = sitting?.type === SESSION_TYPE.REV || sitting?.type === SESSION_TYPE.REV_PLUS;
  const fastPass = !!sitting?.fast;
  const isFree = sitting?.type === SESSION_TYPE.FREE;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-4 pt-safe pb-3 flex items-center justify-between border-b border-border">
        <button
          type="button"
          onClick={endToHome}
          aria-label="Home"
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold truncate">{drillLabel(sitting, spaced, schedule)}</p>
        <span className="w-11 shrink-0" />
      </header>
      <div className="flex-1 flex flex-col min-h-0">
        {sittingTerms.length ? (
          isFree ? (
            <SpacedFreeRecall
              key={queue.join('|')}
              terms={sittingTerms}
              blockLabel={drillLabel(sitting, spaced, schedule)}
              onUpdateTerm={updateTerm}
              onLogAttempt={logAttempt}
              onDone={onDrillDone}
            />
          ) : (
            <RecallBlock
              key={queue.join('|')}
              terms={sittingTerms}
              retireThreshold={SITTING_RETIRE_THRESHOLD}
              singlePass={fastPass}
              mixReverse={mixReverse}
              blockLabel={drillLabel(sitting, spaced, schedule)}
              examType={setup?.examType || 'mixed'}
              onUpdateTerm={updateTerm}
              onLogAttempt={logAttempt}
              onDone={onDrillDone}
            />
          )
        ) : (
          <p className="text-sm text-muted-foreground px-6 py-8">No cards in this sitting.</p>
        )}
      </div>
    </div>
  );
}
