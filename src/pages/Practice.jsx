import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { ArrowLeft, ChevronDown, ClipboardCheck, GripVertical, Layers, PenLine, Pyramid } from 'lucide-react';
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
import {
  withInferredMastery,
  bumpFromPractice,
  seedCramMastery,
  cramGroupsAfterMastery,
  practiceBand,
  masteryForBand,
  PRACTICE_BANDS,
  MASTERY,
  clampMastery,
} from '@/lib/mastery';
import { cn } from '@/lib/utils';
import { sessionRankMode, flashcardDef, trueCramPracticeState, priority } from '@/lib/studyUtils';
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
    icon: Layers,
    iconBg: 'bg-[#ff9f43]',
  },
  {
    id: 'smartdef',
    title: 'Your Definition',
    sub: 'Write one you will remember.',
    icon: PenLine,
    iconBg: 'bg-[#4da3ff]',
  },
  {
    id: 'test',
    title: 'Practice test',
    sub: 'Timed, like the exam.',
    icon: ClipboardCheck,
    iconBg: 'bg-primary',
  },
  {
    id: 'explain',
    title: 'Explain it',
    sub: 'Teach it. Fill the pyramid.',
    icon: Pyramid,
    iconBg: 'bg-[#3ddc84]',
  },
];


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
      data-tour="practice-slider"
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
      className="relative grid w-[11.75rem] touch-none select-none grid-cols-2 rounded-full bg-secondary p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function loadPracticeBoot(location) {
  const fromHistory = location.state?.session;
  const src = fromHistory?.terms?.length
    ? { kind: location.state?.kind || 'history', session: fromHistory }
    : loadPracticeSource();
  const flaggedTermIds =
    location.state?.flaggedTermIds
    || src?.session?.flaggedTermIds
    || src?.session?.trueCram?.flaggedTermIds
    || [];
  const coveredIds =
    location.state?.coveredIds
    || src?.session?.coveredIds
    || src?.session?.trueCram?.coveredIds
    || [];
  const isTrueCram = !!location.state?.flaggedOnly || !!trueCramPracticeState(src?.session);
  let terms = withInferredMastery(src?.session?.terms || []);
  if (isTrueCram) terms = seedCramMastery(terms, { flaggedTermIds, coveredIds });
  return {
    src,
    terms,
    flaggedTermIds: [...flaggedTermIds],
    coveredIds: [...coveredIds],
    isTrueCram,
  };
}

function sessionWithCramGroups(session, terms, groups) {
  const trueCram = session?.trueCram
    ? {
        ...session.trueCram,
        flaggedTermIds: groups.flaggedTermIds,
        coveredIds: groups.coveredIds,
      }
    : session?.trueCram;
  return {
    ...session,
    terms,
    flaggedTermIds: groups.flaggedTermIds,
    coveredIds: groups.coveredIds,
    trueCram,
  };
}

function PracticeTermLists({ groups, openTermId, onToggle, onMove }) {
  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    onMove(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="mt-4 space-y-5">
        <p className="text-xs text-muted-foreground">A right answer moves a term up one list. Drag to place it yourself.</p>
        {groups.map((group) => (
          <div key={group.key}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
              <span className="ml-1.5 font-medium normal-case tracking-normal">· {group.hint} · {group.items.length}</span>
            </p>
            <Droppable droppableId={group.key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'space-y-2 rounded-2xl',
                    snapshot.isDraggingOver && 'bg-muted/70',
                    !group.items.length && 'min-h-14 border border-dashed border-border'
                  )}
                >
                  {group.items.map((term, index) => (
                    <Draggable key={term.id} draggableId={String(term.id)} index={index}>
                      {(drag, dragSnap) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={cn(
                            'border-b border-border',
                            dragSnap.isDragging && 'shadow-lg'
                          )}
                        >
                          <div className="flex items-center gap-1 pr-2">
                            <div
                              {...drag.dragHandleProps}
                              aria-label={`Drag ${term.term}`}
                              className="flex h-11 w-11 shrink-0 cursor-grab items-center justify-center rounded-full text-muted-foreground active:cursor-grabbing"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <button
                              type="button"
                              onClick={() => onToggle(term.id)}
                              aria-expanded={openTermId === term.id}
                              className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2.5 text-left"
                            >
                              <p className="truncate text-sm font-semibold">{term.term}</p>
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                  openTermId === term.id && 'rotate-180'
                                )}
                              />
                            </button>
                          </div>
                          {openTermId === term.id && (
                            <p className="px-3 pb-2.5 text-sm leading-relaxed text-muted-foreground">
                              {flashcardDef(term) || 'No definition yet.'}
                            </p>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {!group.items.length && (
                    <p className="px-3 py-3 text-center text-xs text-muted-foreground">Drag a term here</p>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}

export default function Practice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [boot] = React.useState(() => loadPracticeBoot(location));
  const sourceRef = React.useRef(boot.src);
  const groupsRef = React.useRef({
    flaggedTermIds: boot.flaggedTermIds,
    coveredIds: boot.coveredIds,
  });
  const [terms, setTerms] = React.useState(boot.terms);
  const isTrueCramSession = boot.isTrueCram;
  const [mode, setMode] = React.useState('hub');
  const [openTermId, setOpenTermId] = React.useState(null);
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [chooserSeen, setChooserSeen] = React.useState(() => {
    const hasWork = boot.terms.some((t) => clampMastery(t.mastery) < MASTERY.SOLID);
    if (location.state?.wholeSet || (location.state?.workOn && hasWork)) markPracticeSetChosen();
    return hasChosenPracticeSet();
  });
  const [prompt, setPrompt] = React.useState(null);
  const [pendingMode, setPendingMode] = React.useState('');
  const [noneNote, setNoneNote] = React.useState(false);
  const [practiceAll, setPracticeAll] = React.useState(() => {
    const hasWork = boot.terms.some((t) => clampMastery(t.mastery) < MASTERY.SOLID);
    if (location.state?.wholeSet) return true;
    if (location.state?.workOn) return !hasWork;
    if (boot.flaggedTermIds.length) return false;
    return !hasWork;
  });
  const deckIdsRef = React.useRef({ mode: 'hub', ids: null });
  const openedWorkOn = React.useRef(false);

  React.useEffect(() => {
    if (openedWorkOn.current || location.state?.workOn !== true) return;
    openedWorkOn.current = true;
    if (!terms.some((t) => clampMastery(t.mastery) < MASTERY.SOLID)) setPrompt('none');
  }, [location.state, terms]);

  const commit = React.useCallback((updater) => {
    setTerms((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const prevById = new Map(prev.map((term) => [term.id, term]));
      let groups = groupsRef.current;
      const clean = next.map((term) => {
        const before = prevById.get(term.id);
        const mastery = clampMastery(term.mastery);
        if (isTrueCramSession && before && before.mastery !== mastery) {
          groups = cramGroupsAfterMastery(
            groups.flaggedTermIds,
            groups.coveredIds,
            term.id,
            mastery
          );
        }
        if (!('practiceCorrect' in term) && mastery === term.mastery) return term;
        const rest = { ...term };
        delete rest.practiceCorrect;
        return mastery === term.mastery ? rest : { ...rest, mastery };
      });
      const src = sourceRef.current;
      if (!src) return clean;
      let session = { ...src.session, terms: clean };
      if (isTrueCramSession && groups !== groupsRef.current) {
        groupsRef.current = groups;
        session = sessionWithCramGroups(src.session, clean, groups);
      }
      sourceRef.current = { ...src, session };
      savePracticeTerms(sourceRef.current, clean);
      return clean;
    });
  }, [isTrueCramSession]);

  const updateTerm = React.useCallback(
    (id, patch) => commit((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [commit]
  );

  const moveTerm = React.useCallback((id, band) => {
    const term = terms.find((item) => item.id === id);
    if (!term || practiceBand(term.mastery) === band) return;
    updateTerm(id, { mastery: masteryForBand(band, term.mastery) });
  }, [terms, updateTerm]);
  const byImportance = (a, b) => {
    const dp = priority(b) - priority(a);
    if (dp) return dp;
    return (a.term || '').localeCompare(b.term || '');
  };
  const groups = PRACTICE_BANDS.map((band) => ({
    ...band,
    items: terms.filter((term) => practiceBand(term.mastery) === band.key).sort(byImportance),
  }));
  const focusTerms = groups.filter((group) => group.key !== 'known').flatMap((group) => group.items);
  const drillTerms = practiceAll || focusTerms.length === 0 ? terms : focusTerms;
  if (mode === 'hub') deckIdsRef.current = { mode: 'hub', ids: null };
  else if (deckIdsRef.current.mode !== mode) {
    deckIdsRef.current = { mode, ids: drillTerms.map((term) => term.id) };
  }
  const activityTerms = deckIdsRef.current.ids
    ? deckIdsRef.current.ids.map((id) => terms.find((term) => term.id === id)).filter(Boolean)
    : drillTerms;

  const closePrompt = () => {
    setPrompt(null);
    setPendingMode('');
    setNoneNote(false);
  };

  const launchMode = (id) => {
    if (!id) return;
    setMode(id);
  };

  const beginMode = (id) => {
    if (!chooserSeen) {
      setPendingMode(id);
      setNoneNote(false);
      setPrompt('choose');
      return;
    }
    launchMode(id);
  };

  const choosePracticeSet = (all) => {
    if (!all && focusTerms.length === 0) {
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
    if (!focusTerms.length) {
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
        <header className="px-5 pt-safe">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back" className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="mt-2 text-[2.5rem] font-bold leading-none tracking-tight">Practice</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">Finish a cram first — practice uses those terms.</p>
          <Button onClick={() => navigate('/welcome')} className="rounded-full">
            Start a cram
          </Button>
        </div>
      </div>
    );
  }

  const renderHeader = (which) => (
    <header className="px-5 pt-safe">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => (which === 'hub' ? navigate('/') : setMode('hub'))}
        aria-label="Back"
        className="-ml-2"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
    </header>
  );

  let body = null;
  if (mode === 'flashcards') {
    body = <PracticeFlashcards terms={activityTerms} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />;
  } else if (mode === 'smartdef') {
    body = <SmartDefMode terms={activityTerms} rankMode={rankMode} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />;
  } else if (mode === 'test') {
    body = (
      <PracticeTest
        terms={activityTerms}
        rankMode={rankMode}
        examType={sourceRef.current?.session?.setup?.examType || 'mixed'}
        budgetMs={12 * 60 * 1000}
        priorMissed={focusTerms.map((t) => t.id)}
        onDone={({ missedIds, questionIds }) => {
          const miss = new Set(missedIds);
          commit((prev) =>
            prev.map((t) => {
              if (!questionIds.includes(t.id)) return t;
              const correct = !miss.has(t.id);
              return {
                ...t,
                mastery: bumpFromPractice(t.mastery, { correct }),
                practiceCorrect: correct,
              };
            })
          );
          setMode('hub');
        }}
      />
    );
  } else if (mode === 'explain') {
    body = <ExplainIt terms={activityTerms} rankMode={rankMode} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />;
  }


  const hub = (
      <main className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto">
        <section className="relative flex flex-col px-4 pb-2">
          <div className="relative mx-auto flex w-full max-w-5xl flex-wrap items-end justify-between gap-4 pb-5 pt-2">
            <div className="min-w-0">
              <h2 className="text-[2.5rem] font-bold leading-none tracking-tight">Practice</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {groups[0].items.length} work · {groups[1].items.length} getting there · {groups[2].items.length} known
              </p>
            </div>
            <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
              <PracticeContentSlider
                practiceAll={practiceAll}
                onAll={() => setPracticeAll(true)}
                onWork={selectWorkOn}
              />
              <p id="practice-slider-label" className="sr-only">
                Practice content slider
              </p>
            </div>
          </div>

          <div data-tour="practice-modes" className="relative mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const deckCount = practiceAll ? terms.length : (focusTerms.length || terms.length);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => beginMode(m.id)}
                  className="flex w-full flex-col rounded-3xl bg-card px-4 py-4 text-left transition active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-black', m.iconBg)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="truncate text-[15px] font-semibold">{m.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-gain">
                      <span className="h-2 w-2 rounded-full bg-gain" />
                      Open
                    </span>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <p className="text-[2rem] font-semibold leading-none tracking-tight tabular-nums">{deckCount}</p>
                    <p className="text-right text-lg font-semibold leading-none tracking-tight text-gain tabular-nums">
                      {groups[0].items.length}
                    </p>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-3">
                    <p className="text-sm text-muted-foreground">terms</p>
                    <p className="text-right text-sm font-semibold text-gain">to work on</p>
                  </div>
                  <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">{m.sub}</p>
                </button>
              );
            })}
          </div>
        </section>

        {groups.some((group) => group.items.length) && (
          <section className="px-4 pb-safe pt-6">
            <div className="mx-auto w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setTermsOpen((open) => !open)}
              aria-expanded={termsOpen}
              className="flex w-full items-center justify-between rounded-3xl bg-card px-4 py-4 text-left"
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
              <PracticeTermLists
                groups={groups}
                openTermId={openTermId}
                onToggle={(id) => setOpenTermId((cur) => (cur === id ? null : id))}
                onMove={moveTerm}
              />
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
            className="rounded-3xl bg-secondary px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold">All terms</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Study every term in this set.</p>
          </button>
          <button
            type="button"
            onClick={() => choosePracticeSet(false)}
            className="rounded-3xl bg-secondary px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold">To work on</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {focusTerms.length
                ? `Just the ${focusTerms.length} you should practice.`
                : 'Just the ones you should practice.'}
            </p>
          </button>
        </div>
        {noneNote && (
          <p className="rounded-2xl bg-muted px-3 py-2.5 text-sm leading-relaxed text-foreground">
            You have no challenging terms to work on. Continue the cram session, or practice here to see what you don't know yet.
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
          <DialogTitle>No challenging terms yet</DialogTitle>
          <DialogDescription>
            You have no challenging terms to work on. Continue the cram session, or practice here to see what you don't know yet.
          </DialogDescription>
        </DialogHeader>
        <Button type="button" className="rounded-full" onClick={closePrompt}>
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
