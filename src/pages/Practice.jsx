import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ScreenSwap from '@/components/ScreenSwap';
import { useEdgeClaim, useEdgeSwipe } from '@/components/edgeSwipe';
import PracticeTest from '@/components/study/PracticeTest';
import PracticeFlashcards from '@/components/practice/PracticeFlashcards';
import SmartDefMode from '@/components/practice/SmartDefMode';
import ExplainIt from '@/components/practice/ExplainIt';
import { loadPracticeSource, savePracticeTerms } from '@/lib/sessionStore';
import { withInferredMastery, bumpFromPractice, MASTERY, clampMastery } from '@/lib/mastery';
import { cn } from '@/lib/utils';
import { sessionRankMode, flashcardDef, trueCramPracticeState } from '@/lib/studyUtils';
import { showRewarded } from '@/lib/ads';
import { userStorageKey } from '@/lib/userStorage';

const PRACTICE_CHOOSER_KEY = 'lms_practice_chooser_v1';

function practiceChooserKey() {
  return userStorageKey(PRACTICE_CHOOSER_KEY) || PRACTICE_CHOOSER_KEY;
}

function hasChosenPracticeSet() {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(practiceChooserKey()) === '1';
  } catch {
    return true;
  }
}

function markPracticeSetChosen() {
  try {
    localStorage.setItem(practiceChooserKey(), '1');
  } catch {
    // The chooser can show again next visit.
  }
}

const MODES = [
  {
    id: 'flashcards',
    title: 'Flashcards',
    sub: 'Flip the card, then grade it.',
    accent: 'bg-orange-500 dark:bg-orange-400',
    wash: 'bg-orange-500/[0.07] hover:bg-orange-500/[0.12] dark:bg-orange-400/20 dark:hover:bg-orange-400/30',
  },
  {
    id: 'smartdef',
    title: 'Smart def',
    sub: 'Write the definition yourself.',
    accent: 'bg-sky-500 dark:bg-sky-400',
    wash: 'bg-sky-500/[0.07] hover:bg-sky-500/[0.12] dark:bg-sky-400/20 dark:hover:bg-sky-400/30',
  },
  {
    id: 'test',
    title: 'Practice test',
    sub: 'Timed, like the exam.',
    accent: 'bg-violet-500 dark:bg-violet-400',
    wash: 'bg-violet-500/[0.07] hover:bg-violet-500/[0.12] dark:bg-violet-400/20 dark:hover:bg-violet-400/30',
  },
  {
    id: 'explain',
    title: 'Explain it',
    sub: 'Teach it. Fill the pyramid.',
    accent: 'bg-emerald-500 dark:bg-emerald-400',
    wash: 'bg-emerald-500/[0.07] hover:bg-emerald-500/[0.12] dark:bg-emerald-400/20 dark:hover:bg-emerald-400/30',
  },
];

const PREVIEW_TYPE_MS = 68;

function TypedText({ text, active }) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setCount(0);
      return undefined;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setCount(text.length);
      return undefined;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) window.clearInterval(id);
    }, PREVIEW_TYPE_MS);
    return () => window.clearInterval(id);
  }, [active, text]);

  return (
    <p className="text-[10px] leading-snug text-foreground">
      {text.slice(0, count)}
      <span className={cn('brain-caret', active ? 'opacity-100' : 'opacity-0')} />
    </p>
  );
}

function FlashPreview() {
  return (
    <div className="practice-flip-scene">
      <div className="practice-flip-card">
        <div className="practice-flip-face flex flex-col rounded-xl border border-border bg-background p-2 shadow-sm dark:border-white/15 dark:bg-black/40">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">Term</p>
          <p className="flex min-h-0 flex-1 items-center justify-center px-1 text-center text-xs font-bold leading-tight">
            Hippocampus
          </p>
          <div className="flex h-5 shrink-0 items-center justify-center rounded-lg bg-primary text-[9px] font-semibold text-primary-foreground">
            Show answer
          </div>
        </div>
        <div className="practice-flip-face practice-flip-back flex flex-col rounded-xl border border-border bg-background p-2 shadow-sm dark:border-white/15 dark:bg-black/40">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">Answer</p>
          <p className="flex min-h-0 flex-1 items-center justify-center px-1 text-center text-[10px] font-medium leading-snug">
            Forms new memories.
          </p>
        </div>
      </div>
    </div>
  );
}

function SmartDefPreview({ active }) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-background px-2 py-1.5 dark:border-white/15 dark:bg-black/40">
      <p className="text-[11px] font-bold leading-tight">Reinforcement</p>
      <div className="mt-1 min-h-0 flex-1 rounded-lg border border-border bg-muted/50 px-1.5 py-1 dark:border-white/10 dark:bg-white/[0.06]">
        {active ? (
          <TypedText text="A reward that makes a habit stick." active />
        ) : (
          <p className="text-[10px] leading-snug text-muted-foreground">Write a definition…</p>
        )}
      </div>
    </div>
  );
}

function TestPreview() {
  const options = [
    { label: 'Amygdala', right: false },
    { label: 'Hippocampus', right: true },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background px-1.5 py-1 dark:border-white/15 dark:bg-black/40">
      <div className="flex items-center justify-between text-[8px] font-medium leading-none text-muted-foreground">
        <span>Question 1</span>
        <span>0:42</span>
      </div>
      <p className="mt-0.5 text-[9px] font-semibold leading-none">Stores new memories?</p>
      <div className="mt-auto space-y-0.5">
        {options.map((opt) => (
          <div
            key={opt.label}
            className={cn(
              'truncate rounded-md border border-border px-1.5 py-px text-[9px] leading-tight transition-colors duration-700 dark:border-white/15',
              opt.right && 'practice-choice-right group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:delay-500'
            )}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeContentSlider({ practiceAll, onAll, onWork }) {
  const trackRef = React.useRef(null);

  const chooseSide = (event) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    const x = event.clientX - rect.left;
    if (x < rect.width / 2) onAll();
    else onWork();
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={practiceAll ? 0 : 1}
      aria-valuetext={practiceAll ? 'All terms' : 'To work on'}
      aria-labelledby="practice-slider-label"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          onAll();
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          onWork();
        }
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={chooseSide}
      className="relative grid w-[11.75rem] touch-none select-none grid-cols-2 rounded-full border border-border bg-muted/70 p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-0.125rem)] rounded-full bg-primary shadow-sm transition-transform duration-500 ease-out"
        style={{ transform: `translateX(${practiceAll ? 0 : 100}%)` }}
      />
      <span className={cn(
        'relative z-10 px-2.5 py-1 text-center text-[11px] font-semibold transition-colors duration-300',
        practiceAll ? 'text-primary-foreground' : 'text-muted-foreground'
      )}
      >
        All terms
      </span>
      <span className={cn(
        'relative z-10 px-2.5 py-1 text-center text-[11px] font-semibold transition-colors duration-300',
        practiceAll ? 'text-muted-foreground' : 'text-primary-foreground'
      )}
      >
        To work on
      </span>
    </div>
  );
}

function ExplainPreview({ active }) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-background px-2 py-1.5 dark:border-white/15 dark:bg-black/40">
      <p className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">Teach this</p>
      <p className="text-[11px] font-bold leading-tight">Working memory</p>
      <div className="mt-1 min-h-0 flex-1 rounded-lg border border-border bg-muted/50 px-1.5 py-1 dark:border-white/10 dark:bg-white/[0.06]">
        {active ? (
          <TypedText text="The scratch pad you think with." active />
        ) : (
          <p className="text-[10px] leading-snug text-muted-foreground">Explain it…</p>
        )}
      </div>
    </div>
  );
}

export default function Practice() {
  const navigate = useNavigate();
  const location = useLocation();
  const sourceRef = React.useRef(null);
  const [terms, setTerms] = React.useState(() => {
    const fromHistory = location.state?.session;
    const src = fromHistory?.terms?.length
      ? { kind: location.state?.kind || 'history', session: fromHistory }
      : loadPracticeSource();
    sourceRef.current = src;
    return withInferredMastery(src?.session?.terms || []);
  });
  const flaggedOnly = !!location.state?.flaggedOnly;
  const flaggedTermIds = location.state?.flaggedTermIds
    || sourceRef.current?.session?.flaggedTermIds
    || sourceRef.current?.session?.trueCram?.flaggedTermIds;
  const coveredIds = location.state?.coveredIds
    || sourceRef.current?.session?.coveredIds
    || sourceRef.current?.session?.trueCram?.coveredIds;
  const isTrueCramSession =
    flaggedOnly || !!trueCramPracticeState(sourceRef.current?.session);
  const [mode, setMode] = React.useState('hub');
  const [startingMode, setStartingMode] = React.useState('');
  const [openTermId, setOpenTermId] = React.useState(null);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [hoveredMode, setHoveredMode] = React.useState('');
  const [chooserSeen, setChooserSeen] = React.useState(hasChosenPracticeSet);
  const [prompt, setPrompt] = React.useState(null);
  const [pendingMode, setPendingMode] = React.useState('');
  const [noneNote, setNoneNote] = React.useState(false);
  const [practiceAll, setPracticeAll] = React.useState(() => {
    const flags =
      location.state?.flaggedTermIds
      || sourceRef.current?.session?.flaggedTermIds
      || sourceRef.current?.session?.trueCram?.flaggedTermIds;
    if (Array.isArray(flags) && flags.length) return false;
    const list = withInferredMastery(sourceRef.current?.session?.terms || []);
    return !list.some((t) => clampMastery(t.mastery) < MASTERY.SOLID);
  });

  const commit = React.useCallback((updater) => {
    setTerms((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const src = sourceRef.current;
      if (src) {
        sourceRef.current = { ...src, session: { ...src.session, terms: next } };
        savePracticeTerms(sourceRef.current, next);
      }
      return next;
    });
  }, []);

  const updateTerm = React.useCallback(
    (id, patch) => commit((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [commit]
  );

  const flagSet = React.useMemo(
    () => new Set(Array.isArray(flaggedTermIds) ? flaggedTermIds : []),
    [flaggedTermIds]
  );
  const coveredSet = React.useMemo(
    () => new Set(Array.isArray(coveredIds) ? coveredIds : []),
    [coveredIds]
  );
  const workTerms = isTrueCramSession
    ? terms.filter((t) => flagSet.has(t.id))
    : terms.filter((t) => clampMastery(t.mastery) < MASTERY.SOLID);
  const knownTerms = isTrueCramSession
    ? terms.filter((t) => {
        if (flagSet.has(t.id)) return false;
        if (coveredSet.size) return coveredSet.has(t.id);
        return true;
      })
    : terms.filter((t) => clampMastery(t.mastery) >= MASTERY.SOLID);
  const drillTerms = practiceAll || workTerms.length === 0 ? terms : workTerms;

  const closePrompt = () => {
    setPrompt(null);
    setPendingMode('');
    setNoneNote(false);
  };

  const launchMode = async (id) => {
    if (!id || startingMode) return;
    if (id === 'test') {
      setStartingMode(id);
      const earned = await showRewarded('practice');
      setStartingMode('');
      if (!earned) return;
    }
    setMode(id);
  };

  const beginMode = (id) => {
    if (startingMode) return;
    if (!chooserSeen) {
      setPendingMode(id);
      setNoneNote(false);
      setPrompt('choose');
      return;
    }
    launchMode(id);
  };

  const choosePracticeSet = (all) => {
    if (!all && workTerms.length === 0) {
      setNoneNote(true);
      return;
    }
    setPracticeAll(all);
    if (!chooserSeen) {
      markPracticeSetChosen();
      setChooserSeen(true);
    }
    const id = pendingMode;
    closePrompt();
    if (id) launchMode(id);
  };

  const selectWorkOn = () => {
    if (!workTerms.length) {
      setPendingMode('');
      setNoneNote(false);
      setPrompt('none');
      return;
    }
    setPracticeAll(false);
  };

  const rankMode = sessionRankMode(sourceRef.current?.session?.setup, terms, {
    title: sourceRef.current?.session?.title,
  });
  const sheetRef = React.useRef(null);
  const modeSwipe = useEdgeSwipe({
    enabled: mode !== 'hub',
    sheetRef,
    onCommit: () => setMode('hub'),
  });
  useEdgeClaim(mode !== 'hub');

  if (!terms.length) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="flex items-center gap-1 px-3 pt-safe pb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="min-w-0 truncate text-base font-bold tracking-tight">Practice</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">Finish a cram first — practice uses those terms.</p>
          <Button onClick={() => navigate('/welcome')} className="rounded-2xl">
            Start a cram
          </Button>
        </div>
      </div>
    );
  }

  const renderHeader = (which) => (
    <header className="flex items-center gap-1 px-3 pt-safe pb-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => (which === 'hub' ? navigate('/') : setMode('hub'))}
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <h1 className="min-w-0 truncate text-base font-bold tracking-tight">
        {which === 'hub' ? 'Practice' : MODES.find((m) => m.id === which)?.title || 'Practice'}
      </h1>
    </header>
  );

  let body = null;
  if (mode === 'flashcards') {
    body = <PracticeFlashcards terms={drillTerms} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />;
  } else if (mode === 'smartdef') {
    body = <SmartDefMode terms={drillTerms} rankMode={rankMode} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />;
  } else if (mode === 'test') {
    body = (
      <PracticeTest
        terms={drillTerms}
        rankMode={rankMode}
        examType={sourceRef.current?.session?.setup?.examType || 'mixed'}
        budgetMs={12 * 60 * 1000}
        priorMissed={workTerms.map((t) => t.id)}
        onDone={({ missedIds, questionIds }) => {
          const miss = new Set(missedIds);
          commit((prev) =>
            prev.map((t) => {
              if (!questionIds.includes(t.id)) return t;
              return { ...t, mastery: bumpFromPractice(t.mastery, { correct: !miss.has(t.id) }) };
            })
          );
          setMode('hub');
        }}
      />
    );
  } else if (mode === 'explain') {
    body = <ExplainIt terms={drillTerms} rankMode={rankMode} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />;
  }

  const groups = [
    { key: 'work', title: 'Work on these', items: workTerms },
    { key: 'known', title: 'Known terms', items: knownTerms },
  ].filter((g) => g.items.length);

  const hub = (
      <main className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto">
        <section className="relative flex flex-col px-4 pb-2">
          <div
            className="pointer-events-none absolute inset-x-8 top-0 h-48 rounded-full bg-foreground/[0.035] blur-3xl dark:bg-white/[0.04]"
            aria-hidden
          />
          <div className="relative mx-auto flex w-[90%] max-w-5xl flex-wrap items-end justify-between gap-4 pb-8 pt-4">
            <div className="min-w-0">
              <h2 className="text-3xl font-bold tracking-tight">How do you want to practice?</h2>
              <p className="mt-2 inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {workTerms.length} to work on · {knownTerms.length} known
              </p>
            </div>
            <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
              <PracticeContentSlider
                practiceAll={practiceAll}
                onAll={() => setPracticeAll(true)}
                onWork={selectWorkOn}
              />
              <p id="practice-slider-label" className="text-[11px] text-muted-foreground">
                Practice content slider
              </p>
            </div>
          </div>

          <div className="relative mx-auto grid w-[90%] max-w-5xl grid-cols-4 gap-4">
            {MODES.map((m) => {
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!!startingMode}
                  onMouseEnter={() => setHoveredMode(m.id)}
                  onMouseLeave={() => setHoveredMode('')}
                  onClick={() => beginMode(m.id)}
                  className={cn(
                    'group relative flex aspect-square min-w-0 flex-col overflow-hidden rounded-[1.75rem] border border-border/80 text-left shadow-sm dark:border-white/10',
                    'transition duration-700 ease-out hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_hsl(0_0%_0%/0.45)] dark:hover:border-white/20 dark:hover:shadow-[0_18px_40px_-18px_hsl(0_0%_0%/0.7)]',
                    'active:translate-y-0 active:scale-[0.99] disabled:opacity-60',
                    m.wash
                  )}
                >
                  <span className={cn('absolute left-5 top-0 h-1.5 w-12 rounded-b-full', m.accent)} />
                  <div className="flex min-h-0 flex-1 flex-col justify-center px-4 pt-5">
                    <p className="text-2xl font-bold leading-[1.05] tracking-tight">{m.title}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground">
                      {m.sub}
                    </p>
                  </div>
                  <div className="h-[34%] min-h-0 shrink-0 overflow-hidden px-3 pb-3" aria-hidden>
                    {m.id === 'flashcards' && <FlashPreview />}
                    {m.id === 'smartdef' && <SmartDefPreview active={hoveredMode === 'smartdef'} />}
                    {m.id === 'test' && <TestPreview />}
                    {m.id === 'explain' && <ExplainPreview active={hoveredMode === 'explain'} />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {groups.length > 0 && (
          <section className="px-4 pb-safe pt-6">
            <div className="mx-auto w-[90%] max-w-5xl">
            <button
              type="button"
              onClick={() => setTermsOpen((open) => !open)}
              aria-expanded={termsOpen}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]"
            >
              <span className="text-sm font-semibold">Terms · {terms.length}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  termsOpen && 'rotate-180'
                )}
              />
            </button>
            {termsOpen && (
              <div className="mt-4 space-y-5">
                {groups.map((g) => (
                  <div key={g.key}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.title} · {g.items.length}
                    </p>
                    <div className="space-y-2">
                      {g.items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setOpenTermId((cur) => (cur === t.id ? null : t.id))}
                          aria-expanded={openTermId === t.id}
                          className="w-full rounded-2xl border border-border bg-card px-3 py-2.5 text-left transition hover:border-muted-foreground"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{t.term}</p>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                openTermId === t.id && 'rotate-180'
                              )}
                            />
                          </div>
                          {openTermId === t.id && (
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                              {flashcardDef(t) || 'No definition yet.'}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </section>
        )}
        </div>
      </main>
  );

  const chooserDialog = (
    <Dialog open={prompt === 'choose'} onOpenChange={(open) => { if (!open) closePrompt(); }}>
      <DialogContent className="rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>Which terms do you want to study?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2.5">
          <button
            type="button"
            onClick={() => choosePracticeSet(true)}
            className="rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-muted-foreground"
          >
            <p className="text-sm font-semibold">All terms</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Study every term in this set.</p>
          </button>
          <button
            type="button"
            onClick={() => choosePracticeSet(false)}
            className="rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-muted-foreground"
          >
            <p className="text-sm font-semibold">To work on</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {workTerms.length
                ? `Just the ${workTerms.length} you should practice.`
                : 'Just the ones you should practice.'}
            </p>
          </button>
        </div>
        {noneNote && (
          <p className="rounded-2xl bg-muted px-3 py-2.5 text-sm leading-relaxed text-foreground">
            You haven't done these terms yet, so there's none to recommend.
          </p>
        )}
        <DialogDescription>
          In the future, use the practice content slider to switch.
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );

  const noneDialog = (
    <Dialog open={prompt === 'none'} onOpenChange={(open) => { if (!open) closePrompt(); }}>
      <DialogContent className="rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle>Nothing to recommend yet</DialogTitle>
          <DialogDescription>
            You haven't done these terms yet, so there's none to recommend.
          </DialogDescription>
        </DialogHeader>
        <Button type="button" className="rounded-2xl" onClick={closePrompt}>
          OK
        </Button>
      </DialogContent>
    </Dialog>
  );

  if (body) {
    return (
      <div className="relative min-h-[100dvh]">
        <div className="fixed inset-0 z-20 overflow-hidden pointer-events-none bg-background" aria-hidden>
          <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
            {renderHeader('hub')}
            {hub}
          </div>
        </div>
        <div
          ref={sheetRef}
          className="relative z-30 min-h-[100dvh] bg-background text-foreground flex flex-col touch-pan-y"
          onPointerDown={modeSwipe.onPointerDown}
        >
          {renderHeader(mode)}
          <ScreenSwap viewKey={mode} className="flex-1 flex flex-col min-h-0">
            {body}
          </ScreenSwap>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {renderHeader('hub')}
      {hub}
      {chooserDialog}
      {noneDialog}
    </div>
  );
}
