import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { continueStudyPath, normalizeStudyMode, STUDY_MODE, spacedCramAvailable } from '@/lib/studyUtils';
import {
  AHEAD_LINE,
  START_EARLY_LINE,
  WAIT_WHY,
  applyLastLookResults,
  applySittingResults,
  buildSpacedSchedule,
  changePlanTimes,
  countdownLabel,
  countLearned,
  countShaky,
  currentTime,
  emptySrs,
  emptySpacedState,
  describeSittingQueue,
  ensureSpaced,
  generatePlan,
  settledAttempts,
  lastSittingIndex,
  loadSavedClock,
  markTermsIntroduced,
  mergeAttemptGrades,
  mergeKeptSittings,
  nextDueAfterSitting,
  nextNewStep,
  nextSittingWaitCopy,
  migrateStudyTerms,
  offerReminder,
  openSpacedSession,
  orderSittingQueue,
  pickupLine,
  planEndGlance,
  RECOGNIZED_LINE,
  recapCopy,
  recognizedFromResults,
  recordAttempt,
  resolveExamTime,
  saveSavedClock,
  SESSION_TYPE,
  SESSION_TYPE_META,
  shakyTermNames,
  settleResume,
  shouldAutoComplete,
  shouldPersistSession,
  sittingByIndex,
  sittingEstimate,
  sittingIsReady,
  SITTING_RETIRE_THRESHOLD,
  unclearedIds,
} from '@/lib/spacedCram';
import SpacedPlan from '@/components/study/SpacedPlan';
import SpacedFreeRecall from '@/components/study/SpacedFreeRecall';
import RecallBlock from '@/components/study/RecallBlock';
import CardProgress, { cardProgressCaption } from '@/components/study/CardProgress';
import SleepTimePicker from '@/components/study/SleepTimePicker';
import { loadSession, saveSession, saveFinishedSession, clearSession } from '@/lib/sessionStore';
import { getActiveUid } from '@/lib/userStorage';
import { withInferredMastery } from '@/lib/mastery';
import { logProductEvent } from '@/lib/productEvents';
import { useDebug } from '@/lib/DebugContext';
import { currentReminderMode, scheduleStudyReminder, WEB_REMINDER_NOTE } from '@/lib/studyReminder';
import { logEstimateGap, recordSpacedMetric } from '@/lib/spacedMetrics';

function hydrate(location) {
  const ownerUid = getActiveUid();
  const { terms: rawTerms, setup: incomingSetup, sessionId } = location.state || {};
  if (rawTerms?.length) {
    const existing = loadSession();
    const terms = migrateStudyTerms(rawTerms);
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
      terms: migrateStudyTerms(saved.terms),
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
  if (spaced?.lastLook) return 'Last look';
  if (spaced?.bonusRun) return 'Bonus pass';
  const meta = SESSION_TYPE_META[sitting?.type] || {};
  const last = lastSittingIndex(schedule);
  const prefix = `Sitting ${sitting?.sitting || 1} of ${last}`;
  const chunkCount = schedule?.chunks?.length || 1;
  if (sitting?.type === SESSION_TYPE.NEW && chunkCount > 1) {
    const n = (spaced.chunkIndex || 0) + 1;
    if (spaced.subPhase === 'mini_rev') return `${prefix} · mixed review ${n}/${chunkCount}`;
    return `${prefix} · New ${n}/${chunkCount}`;
  }
  return `${prefix} · ${meta.label || 'Drill'}`;
}

export default function SpacedCram() {
  const location = useLocation();
  const navigate = useNavigate();
  const dbg = useDebug();
  const [init] = React.useState(() => hydrate(location));
  const devClock = !!dbg?.enabled;
  const bootNow = currentTime(
    Date.now() + (devClock ? (dbg?.clockOffset || 0) : 0),
    devClock && Number.isFinite(dbg?.clockAt) ? dbg.clockAt : null
  );
  const [booted] = React.useState(() => {
    const spaced0 = init?.spaced || emptySpacedState();
    const terms0 = init?.terms || [];
    return settleResume(openSpacedSession(spaced0, terms0, bootNow), spaced0, terms0, bootNow);
  });
  const [terms, setTerms] = React.useState(booted.terms);
  const [spaced, setSpaced] = React.useState(booted.spaced);
  const [reviewingPlan, setReviewingPlan] = React.useState(
    () => booted.spaced?.phase === 'drill' || booted.spaced?.phase === 'chunk_break'
  );
  const [sleepDraft, setSleepDraft] = React.useState(() => init?.spaced?.stopTime || loadSavedClock().sleep || '22:30');
  const [wakeDraft, setWakeDraft] = React.useState(() => init?.spaced?.wakeTime || loadSavedClock().wake || '07:00');
  const [examDraft, setExamDraft] = React.useState(() => init?.spaced?.examClock || '');
  const [reminderState, setReminderState] = React.useState('offer');
  const sessionIdRef = React.useRef(init?.id);
  const sittingResultsRef = React.useRef({});
  const simTainted = React.useRef(false);
  const setup = init?.setup;
  const clockOffset = devClock && Number.isFinite(dbg?.clockAt) ? 0 : (devClock ? (dbg?.clockOffset || 0) : 0);
  const clockAt = devClock && Number.isFinite(dbg?.clockAt) ? dbg.clockAt : null;
  const clockOffsetRef = React.useRef(0);
  const clockAtRef = React.useRef(null);
  if (!shouldPersistSession({ clockAt, clockOffset })) simTainted.current = true;
  const [now, setNow] = React.useState(bootNow);

  React.useEffect(() => {
    clockOffsetRef.current = clockOffset;
    clockAtRef.current = clockAt;
    setNow(currentTime(Date.now() + clockOffset, clockAt));
  }, [clockOffset, clockAt]);

  const nowRef = React.useRef(bootNow);
  const termsRef = React.useRef(terms);
  termsRef.current = terms;
  const clockReady = React.useRef(false);
  React.useEffect(() => {
    nowRef.current = now;
  }, [now]);

  React.useEffect(() => {
    if (!clockReady.current) {
      clockReady.current = true;
      return;
    }
    const simulated = currentTime(Date.now() + clockOffset, clockAt);
    setSpaced((prev) => {
      const opened = settleResume(openSpacedSession(prev, termsRef.current, simulated), prev, termsRef.current, simulated);
      if (opened.terms !== termsRef.current) setTerms(opened.terms);
      return opened.spaced;
    });
  }, [clockAt, clockOffset]);

  React.useEffect(() => {
    const iv = setInterval(() => {
      setNow(currentTime(Date.now() + clockOffsetRef.current, clockAtRef.current));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  React.useEffect(() => {
    if (!init) return;
    if (getActiveUid() !== init.ownerUid) {
      navigate('/', { replace: true });
      return;
    }
    if (simTainted.current || !shouldPersistSession({ clockAt, clockOffset })) return;
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
    () => buildSpacedSchedule({
      examTiming: setup?.examTiming,
      hours: setup?.hours,
      terms,
      sleepTime: spaced.stopTime,
      wakeTime: spaced.wakeTime,
      examTime: spaced.examTime,
      sittings: Array.isArray(spaced.sittings) ? spaced.sittings : undefined,
      coreOnly: !!spaced.coreOnly,
      testType: setup?.examType || 'mixed',
    }),
    [setup?.examTiming, setup?.examType, setup?.hours, terms, spaced.stopTime, spaced.wakeTime, spaced.examTime, spaced.sittings, spaced.coreOnly]
  );
  const needTimes = !spaced.stopTime || !spaced.wakeTime || !spaced.examTime;
  const skipKeyRef = React.useRef('');
  React.useEffect(() => {
    if (!init || needTimes || spaced.editingTimes) return;
    if (spaced.phase !== 'plan' && spaced.phase !== 'done') return;
    const current = sittingByIndex(schedule, spaced.sittingIndex || 1);
    const built = describeSittingQueue(terms, { ...spaced, lastLook: false, bonusRun: false }, schedule);
    if (!shouldAutoComplete(current, built.queue.length)) return;
    const key = String(current.sitting);
    if (skipKeyRef.current === key) return;
    skipKeyRef.current = key;
    const finishedId = current.sitting;
    const sittings = (spaced.sittings || []).map((s) => (
      s.sitting === finishedId ? { ...s, done: true } : s
    ));
    setSpaced((prev) => (
      prev.sittingIndex !== finishedId ? prev : {
        ...prev,
        sittings,
        phase: 'done',
        sittingIndex: finishedId + 1,
        queue: [],
        pendingCarry: [],
        carryIds: [],
        aheadNote: true,
        lastFinishedAt: nowRef.current,
        nextDueAt: nextDueAfterSitting(current, { sittings }),
      }
    ));
  }, [init, needTimes, schedule, spaced, terms]);

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
  const persistSitting = (nextSpaced, nextTerms) => {
    setSpaced(nextSpaced);
    if (nextTerms) setTerms(nextTerms);
  };

  const completeSitting = (currentTerms, fromSpaced = spaced) => {
    if (fromSpaced.sittingStartedAt) {
      const actualMs = Math.max(0, Date.now() - fromSpaced.sittingStartedAt);
      recordSpacedMetric({
        type: 'sitting_completed',
        sitting: fromSpaced.sittingIndex || 1,
        estimatedSeconds: fromSpaced.estimateSeconds || 0,
        actualMs,
      });
      if (import.meta.env.DEV === true) {
        const line = logEstimateGap(fromSpaced.estimateSeconds, actualMs, {
          dev: true,
          log: (msg) => {
            console.info(msg);
            dbg?.logEvent?.(msg);
          },
        });
        void line;
      }
    }
    const finished = sittingByIndex(schedule, fromSpaced.sittingIndex || 1);
    const gradedAt = now;
    const finishedId = finished?.sitting || fromSpaced.sittingIndex;
    const sittings = (fromSpaced.sittings || []).map((s) => (
      s.sitting === finishedId ? { ...s, done: true } : s
    ));
    persistSitting(
      {
        ...fromSpaced,
        sittings,
        phase: 'done',
        sittingIndex: (fromSpaced.sittingIndex || 1) + 1,
        chunkIndex: 0,
        subPhase: 'new',
        queue: [],
        carryIds: Array.isArray(fromSpaced.pendingCarry) ? fromSpaced.pendingCarry : [],
        pendingCarry: [],
        bonusRun: false,
        lastLook: false,
        resumeIds: [],
        resumeSitting: 0,
        resumeLine: '',
        clearedIds: [],
        pickingUp: '',
        aheadNote: !!fromSpaced.aheadNote,
        lastFinishedAt: gradedAt,
        nextDueAt: nextDueAfterSitting(finished, { sittings }),
      },
      currentTerms
    );
  };

  const startSitting = (override = {}) => {
    const keepResults = !!override.keepResults;
    const rest = { ...override };
    delete rest.keepResults;
    const resuming = !rest.lastLook && !rest.bonusRun
      && spaced.resumeIds?.length
      && (!spaced.resumeSitting || spaced.resumeSitting === (spaced.sittingIndex || 1));
    if (!keepResults) {
      sittingResultsRef.current = {};
      setTerms((prev) => prev.map((t) => ({
        ...t,
        srs: { ...emptySrs(), ...t.srs, missCount: 0 },
      })));
    }
    const nextSpaced = {
      ...spaced,
      ...rest,
      welcomeLine: '',
      aheadNote: false,
      shakyBefore: rest.lastLook ? spaced.shakyBefore : countShaky(terms),
      clearedIds: rest.lastLook ? spaced.clearedIds : [],
      resumeIds: rest.lastLook ? spaced.resumeIds : (resuming ? spaced.resumeIds : []),
      resumeSitting: rest.lastLook ? spaced.resumeSitting : (resuming ? (spaced.resumeSitting || spaced.sittingIndex || 1) : 0),
    };
    const built = describeSittingQueue(terms, nextSpaced, schedule);
    const nextQueue = built.queue;
    if (!nextQueue.length) {
      if (nextSpaced.bonusRun || nextSpaced.lastLook) {
        persistSitting({
          ...nextSpaced,
          phase: 'plan',
          bonusRun: false,
          lastLook: false,
          queue: [],
          pendingCarry: [],
          aheadNote: true,
        });
        return;
      }
      const current = sittingByIndex(schedule, nextSpaced.sittingIndex || 1);
      if (shouldAutoComplete(current, 0)) {
        completeSitting(terms, { ...nextSpaced, pendingCarry: [], aheadNote: true });
        return;
      }
      completeSitting(terms, { ...nextSpaced, pendingCarry: built.leftoverIds, aheadNote: false });
      return;
    }
    const queueIds = nextQueue.map((t) => t.id);
    const freeIds = (rest.lastLook || rest.bonusRun)
      ? []
      : (resuming
        ? (spaced.freeIds || []).filter((id) => queueIds.includes(id))
        : (built.freeIds || []));
    const mcIds = (rest.lastLook || rest.bonusRun)
      ? []
      : (resuming
        ? (spaced.mcIds || []).filter((id) => queueIds.includes(id))
        : (built.mcIds || []));
    const mcTermIds = (rest.lastLook || rest.bonusRun)
      ? []
      : (resuming
        ? (spaced.mcTermIds || []).filter((id) => mcIds.includes(id))
        : (built.mcTermIds || []));
    const mcDefIds = (rest.lastLook || rest.bonusRun)
      ? []
      : (resuming
        ? (spaced.mcDefIds || []).filter((id) => mcIds.includes(id))
        : (built.mcDefIds || []));
    const ordered = (rest.lastLook || rest.bonusRun)
      ? queueIds
      : orderSittingQueue(queueIds, { freeIds, mcIds });
    const freeSet = new Set(freeIds);
    const hasDrill = ordered.some((id) => !freeSet.has(id));
    const estimate = sittingEstimate(ordered.length, {
      mcTermCards: mcTermIds.length,
      mcDefCards: mcDefIds.length,
    });
    recordSpacedMetric({
      type: 'sitting_started',
      sitting: nextSpaced.sittingIndex || 1,
      estimatedSeconds: estimate.seconds,
      lastLook: !!rest.lastLook,
    });
    persistSitting({
      ...nextSpaced,
      phase: 'drill',
      queue: ordered,
      freeIds,
      mcIds,
      mcTermIds,
      mcDefIds,
      mixStep: hasDrill ? 'flash' : 'free',
      pendingCarry: built.leftoverIds,
      aheadNote: false,
      drillTotal: ordered.length,
      estimateSeconds: estimate.seconds,
      sittingStartedAt: Date.now(),
      recognizedIds: [],
      pickingUp: resuming ? pickupLine(ordered.length) : '',
      resumeIds: rest.lastLook ? nextSpaced.resumeIds : [],
      clearedIds: [],
    });
  };

  const updateTerm = (id, patch) => {
    setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const logAttempt = (id, result, mode = 'flash') => {
    const attempt = recordAttempt(sittingResultsRef.current, id, result, mode);
    if (attempt.lastGrade === 'hit' || attempt.lastGrade === 'partial') {
      setSpaced((prev) => ({
        ...prev,
        clearedIds: [...new Set([...(prev.clearedIds || []), id])],
      }));
    }
    const at = Date.now();
    setTerms((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              seen: true,
              recallHistory: [...(t.recallHistory || []), {
                result: result === 'got_it' ? 'got' : result === 'partly' ? 'partly' : 'missed',
                at,
              }],
              srs: {
                ...emptySrs(),
                ...t.srs,
                missCount: attempt.missCount,
                lastGrade: attempt.lastGrade,
                lastMode: attempt.mode,
              },
            }
          : t
      )
    );
  };

  const onDrillDone = () => {
    const freeIds = spaced.freeIds || [];
    if (spaced.mixStep !== 'free' && freeIds.length) {
      persistSitting({ ...spaced, mixStep: 'free' });
      return;
    }
    const gradedAt = nowRef.current;
    const gradeContext = { at: gradedAt, wakeTime: spaced.wakeTime, sleepTime: spaced.stopTime };
    if (spaced.lastLook) {
      const nextTerms = applyLastLookResults(terms, sittingResultsRef.current);
      sittingResultsRef.current = {};
      persistSitting({
        ...spaced,
        phase: 'plan',
        lastLook: false,
        queue: [],
        pendingCarry: [],
        aheadNote: false,
        clearedIds: [],
      }, nextTerms);
      return;
    }
    if (spaced.bonusRun) {
      let nextTerms = applySittingResults(terms, sittingResultsRef.current, gradeContext);
      nextTerms = markTermsIntroduced(nextTerms, spaced.queue);
      sittingResultsRef.current = {};
      persistSitting({
        ...spaced,
        phase: 'plan',
        bonusRun: false,
        queue: [],
        pendingCarry: [],
        aheadNote: false,
        clearedIds: [],
      }, nextTerms);
      return;
    }
    const currentSitting = sittingByIndex(schedule, sittingN);
    if (currentSitting?.type === SESSION_TYPE.NEW) {
      const step = nextNewStep(spaced, schedule);
      if (step.kind === 'mini_rev' || step.kind === 'next_chunk') {
        const progressed = markTermsIntroduced(
          mergeAttemptGrades(terms, sittingResultsRef.current),
          spaced.queue
        );
        const keptHits = { ...(spaced.pendingGrades || {}), ...settledAttempts(sittingResultsRef.current) };
        sittingResultsRef.current = {};
        persistSitting(
          {
            ...spaced,
            phase: 'chunk_break',
            subPhase: step.subPhase,
            chunkIndex: step.chunkIndex,
            queue: [],
            pendingGrades: keptHits,
          },
          progressed
        );
        return;
      }
    }
    const results = { ...(spaced.pendingGrades || {}), ...(sittingResultsRef.current || {}) };
    const recognizedIds = recognizedFromResults(results);
    let nextTerms = applySittingResults(terms, results, gradeContext);
    if (currentSitting?.type === SESSION_TYPE.NEW || currentSitting?.fullRev || currentSitting?.prioritized) {
      nextTerms = markTermsIntroduced(nextTerms, spaced.queue);
    }
    sittingResultsRef.current = {};
    completeSitting(nextTerms, { ...spaced, pendingGrades: {}, aheadNote: false, recognizedIds });
  };

  const remindLater = async () => {
    const due = Number(spaced.nextDueAt) || 0;
    const result = await scheduleStudyReminder(due);
    if (!result.ok) {
      setReminderState('hidden');
      return;
    }
    setReminderState('set');
  };

  const endToHome = () => {
    let nextTerms = terms;
    let nextSpaced = {
      ...spaced,
      bonusRun: false,
      phase: spaced.phase === 'complete' ? 'complete' : 'plan',
    };
    if (spaced.phase === 'drill') {
      recordSpacedMetric({
        type: 'sitting_abandoned',
        sitting: spaced.sittingIndex || 1,
        actualMs: Math.max(0, Date.now() - (spaced.sittingStartedAt || Date.now())),
      });
      nextTerms = mergeAttemptGrades(terms, sittingResultsRef.current);
      if (!spaced.lastLook && sitting?.type === SESSION_TYPE.NEW) {
        nextTerms = markTermsIntroduced(nextTerms, spaced.queue);
      }
      if (!spaced.lastLook) {
        const left = unclearedIds(spaced.queue, sittingResultsRef.current);
        nextSpaced = {
          ...nextSpaced,
          queue: left,
          resumeIds: left,
          resumeSitting: spaced.sittingIndex || 1,
          resumeLine: pickupLine(left.length),
          pickingUp: '',
          clearedIds: [],
          pendingGrades: { ...(spaced.pendingGrades || {}), ...settledAttempts(sittingResultsRef.current) },
          freeIds: (spaced.freeIds || []).filter((id) => left.includes(id)),
          mcIds: (spaced.mcIds || []).filter((id) => left.includes(id)),
          mcTermIds: (spaced.mcTermIds || []).filter((id) => left.includes(id)),
          mcDefIds: (spaced.mcDefIds || []).filter((id) => left.includes(id)),
        };
      }
      setTerms(nextTerms);
    }
    if (simTainted.current || !shouldPersistSession({ clockAt, clockOffset })) {
      navigate('/');
      return;
    }
    saveSession({
      id: sessionIdRef.current,
      setup,
      terms: nextTerms,
      phase: 'spaced_break',
      spaced: nextSpaced,
      stopTime: spaced.stopTime || null,
      title: init.title || setup?.title,
      noteId: init.noteId || null,
    });
    navigate('/');
  };

  const finishAll = () => {
    if (simTainted.current || !shouldPersistSession({ clockAt, clockOffset })) {
      navigate('/');
      return;
    }
    saveFinishedSession({
      id: sessionIdRef.current,
      terms: withInferredMastery(terms),
      setup,
      title: setup?.title,
      finishedAt: Date.now(),
    });
    logProductEvent('cram_finished', {
      feature: STUDY_MODE.SPACED_CRAM,
      detail: sessionIdRef.current || '',
    });
    clearSession();
    navigate('/');
  };

  const confirmTimes = () => {
    if (!examDraft) return;
    const examTime = resolveExamTime({ now, examTiming: setup?.examTiming, examClock: examDraft });
    saveSavedClock(sleepDraft, wakeDraft);
    const keepFinished = (spaced.sittings || []).some((s) => s.done);
    setReviewingPlan(false);
    persistSitting(changePlanTimes({
      ...spaced,
      lastFinishedAt: keepFinished ? spaced.lastFinishedAt : 0,
    }, terms, {
      sleepTime: sleepDraft,
      wakeTime: wakeDraft,
      examTime,
      examClock: examDraft,
      now,
    }));
  };

  const chooseCore = (coreOnly) => {
    const plan = generatePlan({
      now,
      sleepTime: spaced.stopTime,
      wakeTime: spaced.wakeTime,
      examTime: spaced.examTime,
      terms,
      coreOnly,
    });
    const merged = mergeKeptSittings(spaced.sittings, plan.sittings, now);
    const next = merged.sittings.find((s) => !s.done);
    persistSitting({
      ...spaced,
      coreOnly,
      sittings: merged.sittings,
      sittingIndex: merged.sittingIndex,
      welcomeLine: '',
      catchUpKey: '',
      queue: [],
      phase: 'plan',
      nextDueAt: next && next.at > now + 15000 ? next.at : 0,
    });
  };

  if (spaced.editingTimes || (needTimes && spaced.phase !== 'drill' && spaced.phase !== 'chunk_break')) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="px-3 pt-safe pb-2">
          <button
            type="button"
            onClick={() => {
              if (spaced.editingTimes) persistSitting({ ...spaced, editingTimes: false });
              else navigate('/');
            }}
            aria-label="Home"
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 px-6 pb-4 overflow-y-auto flex flex-col items-center text-center">
          <div className="flex flex-col items-center w-full max-w-xs py-4">
            <Moon className="w-10 h-10 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold tracking-tight mb-2">When should this plan run?</h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Sleep, wake, and exam time. Sittings stay inside waking hours, and the last pass is about an hour and a half before the exam.
            </p>
            <div className="w-full text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Sleep</p>
              <SleepTimePicker value={sleepDraft} onChange={setSleepDraft} />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Wake</p>
              <SleepTimePicker value={wakeDraft} onChange={setWakeDraft} />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Exam</p>
              <SleepTimePicker value={examDraft} onChange={setExamDraft} requireChoice />
            </div>
          </div>
        </main>
        <footer className="px-6 pt-2 pb-safe">
          <div className="max-w-md mx-auto w-full">
            <Button
              disabled={!sleepDraft || !wakeDraft || !examDraft}
              onClick={confirmTimes}
              className="w-full h-14 rounded-full text-base font-semibold"
            >
              Build my plan
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  if (spaced.phase === 'chunk_break' && !reviewingPlan) {
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
            <Button className="h-14 rounded-full text-base font-semibold" onClick={() => startSitting({ keepResults: true })}>
              Continue
            </Button>
            <Button variant="outline" className="h-14 rounded-full text-base font-semibold" onClick={endToHome}>
              Come back later
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  const examOver = !!spaced.examOver || (Number(spaced.examTime) > 0 && now >= spaced.examTime);
  if (examOver && spaced.phase !== 'drill' && spaced.phase !== 'chunk_break') {
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
        <main className="flex-1 px-6 pb-4 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold tracking-tight">Plan complete</h1>
        </main>
      </div>
    );
  }

  if (reviewingPlan || spaced.phase === 'plan' || spaced.phase === 'done' || spaced.phase === 'complete' || allDone) {
    const justFinished = spaced.phase === 'done';
    const finishedAll = allDone;
    const statusLine = spaced.welcomeLine
      ? spaced.welcomeLine
      : spaced.aheadNote
        ? AHEAD_LINE
        : finishedAll
          ? 'That’s the last sitting. Sleep if you can — then you’re as ready as this plan gets.'
          : justFinished && waitCopy
            ? `Sitting done. ${waitCopy}.`
            : justFinished
              ? 'Sitting done. Start the next one when you’re ready.'
              : waitCopy && !ready
                ? waitCopy
                : null;
    const finishedNumber = Math.max(0, sittingN - 1);
    const shakyNow = countShaky(terms);
    const recognizedSet = new Set(spaced.recognizedIds || []);
    const recognizedNames = terms
      .filter((t) => recognizedSet.has(t.id))
      .map((t) => t.term)
      .filter(Boolean);
    const shakyNames = shakyTermNames(terms).filter((name) => !recognizedNames.includes(name));
    const glance = planEndGlance(terms);
    const showRecap = justFinished && Number.isFinite(spaced.shakyBefore);
    const recap = recapCopy({
      sittingNumber: finishedNumber,
      learned: countLearned(terms),
      shakyBefore: spaced.shakyBefore,
      shakyAfter: shakyNow,
      recognized: recognizedNames.length,
    });
    const solidNames = terms
      .filter((t) => t?.srs?.introduced && t.pile === 'solid')
      .map((t) => t.term)
      .filter(Boolean);
    const resumeNote = spaced.resumeIds?.length
      ? (spaced.resumeLine || pickupLine(spaced.resumeIds.length))
      : '';
    const upcomingBuilt = finishedAll
      ? { queue: [], mcTermIds: [], mcDefIds: [] }
      : describeSittingQueue(terms, { ...spaced, lastLook: false, bonusRun: false }, schedule);
    const preview = sittingEstimate(upcomingBuilt.queue.length, {
      mcTermCards: (upcomingBuilt.mcTermIds || []).length,
      mcDefCards: (upcomingBuilt.mcDefIds || []).length,
    });
    const leftHalfway = reviewingPlan || (
      (spaced.resumeIds || []).length > 0
      && (!spaced.resumeSitting || spaced.resumeSitting === sittingN)
    );
    const beginSitting = () => {
      setReviewingPlan(false);
      if (spaced.phase === 'drill') return;
      if (spaced.phase === 'chunk_break') {
        startSitting({ keepResults: true });
        return;
      }
      startSitting();
    };
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="px-3 pt-safe pb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Home"
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Button
            type="button"
            variant="outline"
            onClick={() => persistSitting({ ...spaced, editingTimes: true })}
            className="h-10 rounded-full px-4 text-sm font-semibold"
          >
            Change times
          </Button>
        </header>
        <main className="flex-1 px-6 pb-4 overflow-y-auto">
          <div className="max-w-md mx-auto w-full">
            {statusLine && (
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{statusLine}</p>
            )}
            {resumeNote && (
              <p className="text-sm font-medium mb-3">{resumeNote}</p>
            )}
            {showRecap && (
              <div className="mb-4 space-y-1">
                <p className="text-sm font-medium text-foreground">{recap.text}</p>
                {shakyNames.length > 0 && (
                  <ul className="text-sm leading-relaxed">
                    {shakyNames.map((name) => <li key={name}>{name}</li>)}
                  </ul>
                )}
                {recognizedNames.length > 0 && (
                  <div className="text-meta text-know">
                    <p>{RECOGNIZED_LINE}</p>
                    <ul className="leading-relaxed">
                      {recognizedNames.map((name) => <li key={name}>{name}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{solidNames.length ? solidNames.join(', ') : `Solid: ${glance.solid}`}</p>
              </div>
            )}
            {finishedAll && (
              <div className="mb-4">
                <p className="text-sm font-medium">Solid {glance.solid} · Shaky {glance.shaky}</p>
                {glance.shakyTerms.length > 0 && (
                  <ul className="text-sm mt-1 leading-relaxed">
                    {glance.shakyTerms.map((name) => <li key={name}>{name}</li>)}
                  </ul>
                )}
              </div>
            )}
            {!finishedAll && !ready && !leftHalfway && (
              <div className="mb-4 text-center">
                <p className="text-sm">{WAIT_WHY}</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{countdownLabel(spaced.nextDueAt, now)}</p>
              </div>
            )}
            {preview.line && (
              <p className="text-sm text-muted-foreground mb-3">{preview.line}</p>
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
            {!finishedAll && (ready || leftHalfway) && (
              <Button className="h-14 rounded-full text-base font-semibold" onClick={beginSitting}>
                {leftHalfway ? 'Continue' : 'Start'}
              </Button>
            )}
            {Number(spaced.examTime) > now && (
              <Button
                variant="outline"
                className="h-auto whitespace-normal rounded-full px-4 py-3 text-base font-semibold flex-col gap-1"
                onClick={() => {
                  setReviewingPlan(false);
                  recordSpacedMetric({ type: 'last_look', sitting: spaced.sittingIndex || 1 });
                  startSitting({ lastLook: true });
                }}
              >
                <span>Last look</span>
                <span className="text-xs font-normal text-muted-foreground leading-snug">
                  A short quiz on the terms you still miss. This doesn’t change your plan.
                </span>
              </Button>
            )}
            {schedule?.large && schedule.bonusCount > 0 && (
              <button
                type="button"
                onClick={() => chooseCore(!spaced.coreOnly)}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline self-center"
              >
                {spaced.coreOnly ? 'Include bonus' : 'Core only'}
              </button>
            )}
            {!finishedAll && !ready && !leftHalfway && (
              <>
                <Button disabled className="h-14 rounded-full text-base font-semibold bg-muted text-muted-foreground">
                  {waitCopy || 'Come back later'}
                </Button>
                {offerReminder(finishedNumber) && currentReminderMode() !== 'off' && reminderState !== 'hidden' && (
                  <button
                    type="button"
                    onClick={remindLater}
                    className="text-sm text-muted-foreground hover:text-foreground self-center text-center"
                  >
                    <span className="underline underline-offset-4">
                      {reminderState === 'set' ? 'Reminder set' : 'Remind me'}
                    </span>
                    {currentReminderMode() === 'web' && (
                      <span className="block mt-1">{WEB_REMINDER_NOTE}</span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    recordSpacedMetric({ type: 'start_anyway', sitting: spaced.sittingIndex || 1 });
                    startSitting();
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground self-center text-center"
                >
                  <span className="underline underline-offset-4">Start anyway</span>
                  <span className="block mt-1">{START_EARLY_LINE}</span>
                </button>
              </>
            )}
            {finishedAll && (
              <Button className="h-14 rounded-full text-base font-semibold" onClick={finishAll}>
                Finish this set
              </Button>
            )}
          </div>
        </footer>
      </div>
    );
  }

  const drillingBonus = !!spaced.bonusRun;
  const drillingLast = !!spaced.lastLook;
  const mixReverse = !drillingLast && (drillingBonus || sitting?.type === SESSION_TYPE.REV || sitting?.type === SESSION_TYPE.REV_PLUS);
  const fastPass = drillingLast || (!drillingBonus && !!sitting?.fast);
  const freeSet = new Set(drillingLast || drillingBonus ? [] : (spaced.freeIds || []));
  const mcIds = drillingLast || drillingBonus ? [] : (spaced.mcIds || []);
  const mcDirections = {};
  (spaced.mcTermIds || []).forEach((id) => { mcDirections[id] = 'term'; });
  (spaced.mcDefIds || []).forEach((id) => { mcDirections[id] = 'def'; });
  const drillTerms = sittingTerms.filter((t) => !freeSet.has(t.id));
  const freeTerms = sittingTerms.filter((t) => freeSet.has(t.id));
  const showFree = !drillingLast && !drillingBonus && (spaced.mixStep === 'free' || (!drillTerms.length && freeTerms.length > 0));

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
      <div className="px-4 pt-3">
        {spaced.pickingUp && (
          <p className="text-sm font-medium text-center mb-2">{spaced.pickingUp}</p>
        )}
        <CardProgress
          done={(spaced.clearedIds || []).length}
          total={spaced.drillTotal || queue.length}
          caption={cardProgressCaption(spaced.drillTotal || queue.length, (spaced.clearedIds || []).length, {
            mcTermCards: (spaced.mcTermIds || []).length,
            mcDefCards: (spaced.mcDefIds || []).length,
          })}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        {(showFree ? freeTerms : drillTerms).length ? (
          showFree ? (
            <SpacedFreeRecall
              key={`free-${queue.join('|')}`}
              terms={freeTerms}
              blockLabel={drillLabel(sitting, spaced, schedule)}
              onUpdateTerm={updateTerm}
              onLogAttempt={(id, result) => logAttempt(id, result, 'free')}
              onCardTimed={({ mode, ms }) => recordSpacedMetric({ type: 'card', mode, ms })}
              onDone={onDrillDone}
            />
          ) : (
            <RecallBlock
              key={`drill-${queue.join('|')}`}
              terms={drillTerms}
              retireThreshold={SITTING_RETIRE_THRESHOLD}
              singlePass={fastPass}
              mixReverse={mixReverse}
              cardMode="flash"
              mcIds={mcIds}
              mcDirections={mcDirections}
              distractorTerms={terms}
              blockLabel={drillLabel(sitting, spaced, schedule)}
              examType="short_answer"
              showProgress={false}
              onUpdateTerm={updateTerm}
              onLogAttempt={logAttempt}
              onCardTimed={({ mode, ms }) => recordSpacedMetric({ type: 'card', mode, ms })}
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
