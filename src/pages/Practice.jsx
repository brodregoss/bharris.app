import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ClipboardList, GraduationCap, Lock, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import PracticeTest from '@/components/study/PracticeTest';
import PracticeFlashcards from '@/components/practice/PracticeFlashcards';
import SmartDefMode from '@/components/practice/SmartDefMode';
import ExplainIt from '@/components/practice/ExplainIt';
import UnderstandingPyramid from '@/components/practice/UnderstandingPyramid';
import { loadPracticeSource, savePracticeTerms } from '@/lib/sessionStore';
import {
  withInferredMastery,
  userSetMastery,
  bumpFromPractice,
  MASTERY,
  MASTERY_LEVELS,
  clampMastery,
} from '@/lib/mastery';
import { cn } from '@/lib/utils';
import { sessionRankMode } from '@/lib/studyUtils';

const MODES = [
  {
    id: 'flashcards',
    title: 'Flashcards',
    sub: 'Flip a term, then mark got it or needs work.',
    icon: BookOpen,
  },
  {
    id: 'smartdef',
    title: 'Smart def',
    sub: 'Stumped on a couple of terms? Write your own definition to lock them in.',
    icon: PenLine,
  },
  {
    id: 'test',
    title: 'Practice test',
    sub: 'Timed questions like the exam — MCQ and short answer.',
    icon: ClipboardList,
  },
  {
    id: 'explain',
    title: 'Explain it',
    sub: 'Teach the term out loud on the page. Fill the pyramid to master it.',
    icon: GraduationCap,
  },
];

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
  const [mode, setMode] = React.useState('hub');
  const [adjusting, setAdjusting] = React.useState(null);

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

  const mastered = terms.filter((t) => clampMastery(t.mastery) >= MASTERY.MASTERED);
  const workOn = terms.filter((t) => clampMastery(t.mastery) > MASTERY.NONE && clampMastery(t.mastery) < MASTERY.MASTERED);
  const unstarted = terms.filter((t) => clampMastery(t.mastery) <= MASTERY.NONE);

  const rankMode = sessionRankMode(sourceRef.current?.session?.setup, terms, {
    title: sourceRef.current?.session?.title,
  });

  if (!terms.length) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="flex items-center gap-1 px-3 pt-safe pb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-bold tracking-tight">Practice</h1>
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

  const header = (
    <header className="flex items-center gap-1 px-3 pt-safe pb-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => (mode === 'hub' ? navigate('/') : setMode('hub'))}
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <h1 className="text-base font-bold tracking-tight">
        {mode === 'hub' ? 'Practice' : MODES.find((m) => m.id === mode)?.title || 'Practice'}
      </h1>
    </header>
  );

  if (mode === 'flashcards') {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        {header}
        <PracticeFlashcards terms={terms} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />
      </div>
    );
  }

  if (mode === 'smartdef') {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        {header}
        <SmartDefMode terms={terms} rankMode={rankMode} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />
      </div>
    );
  }

  if (mode === 'test') {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        {header}
        <PracticeTest
          terms={terms}
          rankMode={rankMode}
          examType={sourceRef.current?.session?.setup?.examType || 'mixed'}
          budgetMs={12 * 60 * 1000}
          priorMissed={workOn.concat(unstarted).map((t) => t.id)}
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
      </div>
    );
  }

  if (mode === 'explain') {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        {header}
        <ExplainIt terms={terms} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />
      </div>
    );
  }

  const groups = [
    { key: 'work', title: 'Work on these', items: workOn },
    { key: 'fresh', title: 'Not practiced yet', items: unstarted },
    { key: 'mastered', title: 'Mastered', items: mastered },
  ].filter((g) => g.items.length);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {header}
      <main className="flex-1 px-5 pb-safe overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          <h2 className="text-2xl font-bold tracking-tight mt-2">How do you want to practice?</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {mastered.length} mastered · {workOn.length + unstarted.length} still to lock in
          </p>

          <div className="space-y-2.5 mb-8">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className="w-full text-left rounded-2xl border border-border bg-card p-4 flex items-start gap-3 hover:border-muted-foreground transition shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <h3 className="text-sm font-bold tracking-tight mb-1">Your terms</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Tap a term if the level feels wrong. You can lower it or set Guess / Getting there / Solid — Mastered has to be earned in Explain it.
          </p>

          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                  {g.title} · {g.items.length}
                </p>
                <div className="space-y-2">
                  {g.items.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAdjusting(t)}
                      className="w-full text-left rounded-2xl border border-border bg-card px-3 py-2.5 flex items-center gap-3 hover:border-muted-foreground transition"
                    >
                      <div className="w-14 shrink-0">
                        <UnderstandingPyramid level={t.mastery || 0} size="sm" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{t.term}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {MASTERY_LEVELS.find((l) => l.level === clampMastery(t.mastery))?.label || 'Not practiced'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Sheet open={!!adjusting} onOpenChange={(open) => !open && setAdjusting(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {adjusting && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{adjusting.term}</SheetTitle>
                <SheetDescription>
                  Change the level if it doesn’t match how you feel. Mastered can’t be tapped on — earn it by teaching the term in Explain it.
                </SheetDescription>
              </SheetHeader>
              <div className="px-1 pt-4 pb-6">
                <UnderstandingPyramid level={adjusting.mastery || 0} size="lg" showLabels className="mb-5" />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateTerm(adjusting.id, { mastery: 0 });
                      setAdjusting(null);
                    }}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-sm font-semibold',
                      clampMastery(adjusting.mastery) === 0
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card'
                    )}
                  >
                    Not practiced
                  </button>
                  {MASTERY_LEVELS.map((l) => {
                    const locked = l.level === MASTERY.MASTERED;
                    const active = clampMastery(adjusting.mastery) === l.level;
                    return (
                      <button
                        key={l.level}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          if (locked) return;
                          updateTerm(adjusting.id, { mastery: userSetMastery(adjusting.mastery, l.level) });
                          setAdjusting(null);
                        }}
                        className={cn(
                          'rounded-xl border px-3 py-3 text-sm font-semibold flex items-center justify-center gap-1.5',
                          locked && 'opacity-50 cursor-not-allowed',
                          active && !locked ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                          locked && active && 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200 opacity-100'
                        )}
                      >
                        {locked && <Lock className="w-3.5 h-3.5" />}
                        {l.label}
                      </button>
                    );
                  })}
                </div>
                {clampMastery(adjusting.mastery) >= MASTERY.MASTERED && (
                  <button
                    type="button"
                    onClick={() => {
                      updateTerm(adjusting.id, { mastery: MASTERY.SOLID });
                      setAdjusting(null);
                    }}
                    className="mt-3 w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    This doesn’t feel mastered — drop to Solid
                  </button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
