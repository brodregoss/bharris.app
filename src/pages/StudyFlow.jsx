import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StudyHeader from '@/components/study/StudyHeader';
import BlockSummary from '@/components/study/BlockSummary';
import RecallBlock from '@/components/study/RecallBlock';
import PassiveSkim from '@/components/study/PassiveSkim';
import PracticeTest from '@/components/study/PracticeTest';
import ConfidenceSheet from '@/components/study/ConfidenceSheet';
import CheatSheet from '@/components/study/CheatSheet';
import RoadMapDialog from '@/components/study/RoadMapDialog';
import { NotesOfferPrompt, NotesSkim } from '@/components/study/NotesOffer';
import {
  priority,
  computeReadiness,
  retireThresholdForTier,
  normalizeExamType,
  passiveRatioFor,
  withinStopWindow,
  shakyTermIds,
  WIND_DOWN_BUDGET_MS,
  BLOCK_BUDGET_RATIO,
} from '@/lib/studyUtils';
import { loadSession, saveSession, clearSession, saveFinishedSession } from '@/lib/sessionStore';
import { withInferredMastery } from '@/lib/mastery';
import { useDebug } from '@/lib/DebugContext';

function byPriorityDesc(a, b) {
  return priority(b) - priority(a);
}

function skipEmptyRecallPhase(phase, counts) {
  if (phase === 'critical' && !counts.critical) {
    return counts.core ? 'core' : counts.passive ? 'passive' : 'test';
  }
  if (phase === 'core' && !counts.core) {
    return counts.passive ? 'passive' : 'test';
  }
  if (phase === 'passive' && !counts.passive) {
    return 'test';
  }
  return phase;
}

const PHASE_LABELS = {
  notes_offer: 'Notes offer',
  notes_skim: 'Notes skim',
  critical: 'Critical block',
  critical_summary: 'Critical summary',
  core: 'Core block',
  core_summary: 'Core summary',
  passive: 'Passive skim',
  passive_summary: 'Passive summary',
  test: 'Practice test',
  test_summary: 'Test summary',
  confidence: 'Confidence sheet',
};

// Phases that only introduce / test new material — skipped once wind-down is
// active so no new content reaches the user near their stop time.
const SKIP_ON_WIND_DOWN = ['passive', 'passive_summary', 'test', 'test_summary'];

function StudyFlow() {
  const location = useLocation();
  const navigate = useNavigate();
  const { terms: rawTerms, setup: incomingSetup, initialPhase: incomingInitialPhase, keepState: incomingKeepState } = location.state || {};

  // Hydrate from an incoming triage result, or from a saved session on resume.
  const [init] = React.useState(() => {
    if (rawTerms && rawTerms.length) {
      return {
        terms: incomingKeepState ? rawTerms : rawTerms.map((t) => ({
          ...t,
          recallHistory: [],
          correctStreak: 0,
          seen: false,
          testResult: null,
        })),
        setup: incomingSetup,
        phase: incomingInitialPhase || 'notes_offer',
        blockStats: {},
        stillShaky: [],
        behind: false,
        stopTime: null,
        windDownAcknowledged: false,
        sessionStart: Date.now(),
      };
    }
    const saved = loadSession();
    if (saved && saved.terms?.length) {
      return {
        terms: saved.terms,
        setup: saved.setup,
        phase: saved.phase || 'critical',
        blockStats: saved.blockStats || {},
        stillShaky: saved.stillShaky || [],
        behind: saved.behind || false,
        stopTime: saved.stopTime || null,
        windDownAcknowledged: !!saved.windDownAcknowledged,
        // continue the clock from where it was (time away doesn't count)
        sessionStart: Date.now() - (saved.elapsedMs || 0),
      };
    }
    return null;
  });

  const setup = init?.setup || null;
  const [terms, setTerms] = React.useState(() => (init ? init.terms : []));
  const totalMs = Math.max(15 * 60 * 1000, (setup?.hours || 1) * 3600 * 1000);
  const [sessionStart] = React.useState(() => (init ? init.sessionStart : Date.now()));
  const [phase, setPhase] = React.useState(() => (init ? init.phase : 'critical'));
  const [blockStats, setBlockStats] = React.useState(() => (init ? init.blockStats : {}));
  const [stillShaky, setStillShaky] = React.useState(() => (init ? init.stillShaky : []));
  const [behind, setBehind] = React.useState(() => (init ? init.behind : false));
  const [stopTime, setStopTime] = React.useState(() => (init ? init.stopTime : null));
  const [windDownAcknowledged, setWindDownAcknowledged] = React.useState(
    () => (init ? init.windDownAcknowledged : false)
  );
  const [cheatOpen, setCheatOpen] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());

  const dbg = useDebug();
  // Close the cheat sheet when leaving a question screen.
  React.useEffect(() => {
    setCheatOpen(false);
  }, [phase]);
  const { reportSession, reportTerms, logEvent, clockOffset } = dbg || {};
  const clockOffsetRef = React.useRef(0);
  React.useEffect(() => {
    clockOffsetRef.current = clockOffset || 0;
  }, [clockOffset]);

  React.useEffect(() => {
    const iv = setInterval(() => setNow(Date.now() + clockOffsetRef.current), 1000);
    return () => clearInterval(iv);
  }, []);

  // Snap the clock immediately when the dev offset changes.
  React.useEffect(() => {
    setNow(Date.now() + clockOffsetRef.current);
  }, [clockOffset]);

  // Persist session so the user can resume where they left off.
  React.useEffect(() => {
    if (!init) return;
    saveSession({
      setup,
      terms,
      phase,
      blockStats,
      stillShaky,
      behind,
      stopTime,
      windDownAcknowledged,
      elapsedMs: Date.now() - sessionStart,
      savedAt: Date.now(),
    });
  }, [init, setup, terms, phase, blockStats, stillShaky, behind, stopTime, windDownAcknowledged, sessionStart]);

  // Report live session state + terms to the dev debug panel (dev mode only).
  const devOn = !!dbg?.enabled;
  React.useEffect(() => {
    if (!init || !devOn) return;
    reportSession?.({
      examTiming: setup?.examTiming,
      examType: setup?.examType,
      hoursAvailable: setup?.hours,
      timeSpentMs: now - sessionStart,
      readinessScore: computeReadiness(terms),
      currentStep: phase,
      behind,
      stopTime,
    });
  }, [reportSession, setup, now, terms, phase, behind, sessionStart, init, devOn, stopTime]);

  React.useEffect(() => {
    if (!devOn) return;
    reportTerms?.(terms);
  }, [reportTerms, terms, devOn]);

  // Log phase transitions + session start/resume to the dev event log.
  const phaseRef = React.useRef(phase);
  React.useEffect(() => {
    if (phaseRef.current !== phase) {
      phaseRef.current = phase;
      logEvent?.(`${PHASE_LABELS[phase] || phase} started`);
    }
  }, [phase, logEvent]);

  const loggedStartRef = React.useRef(false);
  React.useEffect(() => {
    if (!devOn || loggedStartRef.current) return;
    loggedStartRef.current = true;
    logEvent?.(rawTerms ? 'Session started' : 'Session resumed');
  }, [devOn, logEvent, rawTerms]);

  // --- Sleep protection (wind-down) ---
  // Checked on screen transitions: once within ~45 min of the configured stop
  // time (non-today exams only), the session shrinks to a short shaky-only
  // drill and no new material is introduced for the remainder of the session.
  const [windDown, setWindDown] = React.useState(false);
  React.useEffect(() => {
    const active = withinStopWindow(setup?.examTiming, stopTime, Date.now() + clockOffsetRef.current);
    setWindDown(active);
    if (active && SKIP_ON_WIND_DOWN.includes(phase)) {
      setPhase('confidence');
    }
  }, [phase, stopTime, setup?.examTiming]);

  // Live flag drives the one-time calm message (acknowledged persists so it
  // never repeats across resumes / days).
  const windDownActive = withinStopWindow(setup?.examTiming, stopTime, now);

  const shakyIds = React.useMemo(() => shakyTermIds(terms, stillShaky), [terms, stillShaky]);
  const windDownTerms = React.useMemo(
    () => terms.filter((t) => shakyIds.has(t.id)).sort(byPriorityDesc),
    [terms, shakyIds]
  );

  const updateTerm = React.useCallback(
    (id, patch) => setTerms((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    []
  );
  const logAttempt = React.useCallback(
    (id, result) =>
      setTerms((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, recallHistory: [...(t.recallHistory || []), { timestamp: Date.now(), result }] } : t
        )
      ),
    []
  );

  const criticalCount = terms.filter((t) => t.tier === 'critical').length;
  const coreCount = terms.filter((t) => t.tier === 'core').length;
  const passiveCount = terms.filter((t) => t.tier === 'passive').length;
  const tierCounts = React.useMemo(
    () => ({ critical: criticalCount, core: coreCount, passive: passiveCount }),
    [criticalCount, coreCount, passiveCount]
  );
  const startRecall = React.useCallback(() => {
    setPhase(skipEmptyRecallPhase('critical', tierCounts));
  }, [tierCounts]);
  React.useLayoutEffect(() => {
    if (!init || windDown) return;
    const next = skipEmptyRecallPhase(phase, tierCounts);
    if (next !== phase) setPhase(next);
  }, [init, phase, windDown, tierCounts]);

  if (!init) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">No study session found.</p>
        <Button onClick={() => navigate('/')} className="rounded-2xl">
          Back to start
        </Button>
      </div>
    );
  }

  const timeRemainingMs = totalMs - (now - sessionStart);
  const readiness = computeReadiness(terms);

  const criticalBudget = totalMs * BLOCK_BUDGET_RATIO.critical;
  const coreBudget = totalMs * BLOCK_BUDGET_RATIO.core;
  const testBudget = totalMs * BLOCK_BUDGET_RATIO.test;

  const criticalTerms = terms.filter((t) => t.tier === 'critical').sort(byPriorityDesc);
  const coreTerms = terms.filter((t) => t.tier === 'core').sort(byPriorityDesc);
  const passiveTerms = terms.filter((t) => t.tier === 'passive').sort(byPriorityDesc);

  const priorMissed = terms
    .filter(
      (t) =>
        (t.recallHistory || []).some((h) => h.result === 'missed') ||
        ((t.tier === 'critical' || t.tier === 'core') && (t.correctStreak || 0) < retireThresholdForTier(t.tier))
    )
    .map((t) => t.id);

  const goPassive = () => {
    const examType = normalizeExamType(setup?.examType);
    const remaining = totalMs - (now - sessionStart);
    const passiveBudget = totalMs * passiveRatioFor(examType);
    const protectedTime = testBudget + totalMs * BLOCK_BUDGET_RATIO.confidence;
    // short_answer: compress Passive earlier (harder trim); mcq: soften (only if severely behind).
    const sensitivity = examType === 'short_answer' ? 0.8 : examType === 'mcq' ? 1.3 : 1.0;
    if (remaining < (passiveBudget + protectedTime) * sensitivity) {
      setBehind(true);
      logEvent?.('Passive trimmed due to time budget', { remainingMs: remaining });
    }
    setPhase(passiveCount ? 'passive' : 'test');
  };

  let blockLabel = 'Study session';
  let content = null;
  const openCheat = () => setCheatOpen(true);

  switch (phase) {
    case 'notes_offer':
      blockLabel = 'Before you start';
      content = (
        <NotesOfferPrompt
          onSkim={() => setPhase('notes_skim')}
          onSkip={startRecall}
        />
      );
      break;
    case 'notes_skim':
      blockLabel = 'Your notes';
      content = <NotesSkim terms={terms} onDone={startRecall} />;
      break;
    case 'critical':
      blockLabel = windDown ? 'Wind-down drill' : 'Critical recall';
      content = (
        <RecallBlock
          key={windDown ? 'wind-down' : 'critical'}
          terms={windDown ? windDownTerms : criticalTerms}
          retireThreshold={windDown ? 1 : 2}
          blockBudgetMs={windDown ? WIND_DOWN_BUDGET_MS : criticalBudget}
          blockLabel={windDown ? 'Wind-down drill' : 'Critical recall'}
          examType={setup?.examType || 'mixed'}
          onUpdateTerm={updateTerm}
          onLogAttempt={logAttempt}
          onOpenCheat={openCheat}
          onDone={(s) => {
            setBlockStats((b) => ({ ...b, critical: s }));
            setPhase(windDown ? 'confidence' : 'critical_summary');
          }}
        />
      );
      break;
    case 'critical_summary':
      content = (
        <BlockSummary
          title="Critical block done"
          message={`Nice, you got ${blockStats.critical?.got || 0} of ${
            blockStats.critical?.total || 0
          } Critical terms. Now let's hit Core — should take about ${Math.round(coreBudget / 60000)} minutes.`}
          onContinue={() => setPhase(skipEmptyRecallPhase('core', tierCounts))}
        />
      );
      break;
    case 'core':
      blockLabel = windDown ? 'Wind-down drill' : 'Core recall';
      content = (
        <RecallBlock
          key={windDown ? 'wind-down' : 'core'}
          terms={windDown ? windDownTerms : coreTerms}
          retireThreshold={1}
          blockBudgetMs={windDown ? WIND_DOWN_BUDGET_MS : coreBudget}
          blockLabel={windDown ? 'Wind-down drill' : 'Core recall'}
          examType={setup?.examType || 'mixed'}
          onUpdateTerm={updateTerm}
          onLogAttempt={logAttempt}
          onOpenCheat={openCheat}
          onDone={(s) => {
            setBlockStats((b) => ({ ...b, core: s }));
            setPhase(windDown ? 'confidence' : 'core_summary');
          }}
        />
      );
      break;
    case 'core_summary':
      content = (
        <BlockSummary
          title="Core block done"
          message={`Solid — ${blockStats.core?.got || 0} of ${
            blockStats.core?.total || 0
          } Core terms down. Quick pass on the rest, then a practice test.`}
          onContinue={goPassive}
        />
      );
      break;
    case 'passive':
      blockLabel = 'Passive skim';
      content = (
        <PassiveSkim
          terms={passiveTerms}
          behind={behind}
          onUpdateTerm={updateTerm}
          onDone={() => setPhase('passive_summary')}
        />
      );
      break;
    case 'passive_summary':
      content = (
        <BlockSummary
          title="All reviewed"
          message="That's everything reviewed. Time for a practice test."
          onContinue={() => setPhase('test')}
        />
      );
      break;
    case 'test':
      blockLabel = 'Practice test';
      content = (
        <PracticeTest
          terms={terms}
          examType={setup?.examType || 'mixed'}
          budgetMs={testBudget}
          priorMissed={priorMissed}
          onDone={({ missedIds, questionIds }) => {
            setStillShaky(missedIds);
            const miss = new Set(missedIds);
            setTerms((prev) =>
              prev.map((t) =>
                questionIds.includes(t.id) ? { ...t, testResult: !miss.has(t.id) } : t
              )
            );
            setPhase('test_summary');
          }}
        />
      );
      break;
    case 'test_summary':
      content = (
        <BlockSummary
          title="Test done"
          message="Here's what's still shaky — let's lock those in."
          onContinue={() => setPhase('confidence')}
        />
      );
      break;
    case 'confidence':
      blockLabel = 'Confidence sheet';
      content = (
        <ConfidenceSheet
          terms={terms}
          examTiming={setup?.examTiming || 'today'}
          stillShaky={stillShaky}
          readiness={readiness}
          onUpdateTerm={updateTerm}
          onLogAttempt={logAttempt}
          onOpenCheat={openCheat}
          stopTime={stopTime}
          onSetStopTime={setStopTime}
          onDone={() => {
            saveFinishedSession({ terms: withInferredMastery(terms), setup, finishedAt: Date.now() });
            clearSession();
            navigate('/');
          }}
        />
      );
      break;
    default:
      content = null;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <StudyHeader
        readiness={readiness}
        timeRemainingMs={timeRemainingMs}
        blockLabel={blockLabel}
      />
      {windDownActive && !windDownAcknowledged && (
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-500/15 border-b border-amber-200 dark:border-amber-500/30 flex items-start gap-2">
          <Moon className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200 flex-1 leading-relaxed">
            You're close to your stop time — here's your last quick pass, then get some sleep. Recall locks in
            better after sleep than more cramming right now.
          </p>
          <button
            type="button"
            onClick={() => setWindDownAcknowledged(true)}
            className="text-xs text-amber-700 dark:text-amber-300 font-semibold underline-offset-4 hover:underline shrink-0"
          >
            Got it
          </button>
        </div>
      )}
      <div className="flex-1">
        {content || (
          <div className="px-8 py-16 text-center">
            <p className="text-sm text-muted-foreground">Nothing to show for this step.</p>
          </div>
        )}
      </div>
      <footer className="px-5 pt-3 pb-safe flex items-center justify-center bg-card/90 backdrop-blur mt-auto">
        <RoadMapDialog terms={terms} phase={phase} />
      </footer>
      <CheatSheet terms={terms} open={cheatOpen} onClose={() => setCheatOpen(false)} />
    </div>
  );
}

class StudyErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center">
          <p className="text-sm font-medium mb-2">Study screen hit an error</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <Button type="button" onClick={() => { window.location.hash = '#/'; }} className="rounded-2xl">
            Back to start
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function StudyFlowPage() {
  return (
    <StudyErrorBoundary>
      <StudyFlow />
    </StudyErrorBoundary>
  );
}