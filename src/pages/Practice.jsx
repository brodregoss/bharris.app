import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronDown, ClipboardList, GraduationCap, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PracticeTest from '@/components/study/PracticeTest';
import PracticeFlashcards from '@/components/practice/PracticeFlashcards';
import SmartDefMode from '@/components/practice/SmartDefMode';
import ExplainIt from '@/components/practice/ExplainIt';
import { loadPracticeSource, savePracticeTerms } from '@/lib/sessionStore';
import { withInferredMastery, bumpFromPractice, MASTERY, clampMastery } from '@/lib/mastery';
import { cn } from '@/lib/utils';
import { sessionRankMode, flashcardDef, trueCramPracticeState } from '@/lib/studyUtils';

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
  const [openTermId, setOpenTermId] = React.useState(null);
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
      <h1 className="min-w-0 truncate text-base font-bold tracking-tight">
        {mode === 'hub' ? 'Practice' : MODES.find((m) => m.id === mode)?.title || 'Practice'}
      </h1>
    </header>
  );

  if (mode === 'flashcards') {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        {header}
        <PracticeFlashcards terms={drillTerms} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />
      </div>
    );
  }

  if (mode === 'smartdef') {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        {header}
        <SmartDefMode terms={drillTerms} rankMode={rankMode} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />
      </div>
    );
  }

  if (mode === 'test') {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        {header}
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
      </div>
    );
  }

  if (mode === 'explain') {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        {header}
        <ExplainIt terms={drillTerms} onUpdateTerm={updateTerm} onDone={() => setMode('hub')} />
      </div>
    );
  }

  const groups = [
    { key: 'work', title: 'Work on these', items: workTerms },
    { key: 'known', title: 'Known terms', items: knownTerms },
  ].filter((g) => g.items.length);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {header}
      <main className="flex-1 px-5 pb-safe overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          <h2 className="text-2xl font-bold tracking-tight mt-2">How do you want to practice?</h2>
          <div className="flex items-center gap-2.5 mt-2 mb-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {workTerms.length} to work on · {knownTerms.length} known
            </p>
            <div
              className="flex rounded-full border border-border bg-muted/70 p-0.5"
              role="group"
              aria-label="Practice set"
            >
              <button
                type="button"
                onClick={() => setPracticeAll(true)}
                aria-pressed={practiceAll}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold transition',
                  practiceAll ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                All terms
              </button>
              <button
                type="button"
                onClick={() => setPracticeAll(false)}
                disabled={!workTerms.length}
                aria-pressed={!practiceAll}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold transition disabled:opacity-40',
                  !practiceAll ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                To work on
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Practice content slider</p>
          </div>

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

          <div className="space-y-5 mt-1">
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
                      onClick={() => setOpenTermId((cur) => (cur === t.id ? null : t.id))}
                      aria-expanded={openTermId === t.id}
                      className="w-full text-left rounded-2xl border border-border bg-card px-3 py-2.5 hover:border-muted-foreground transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{t.term}</p>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-muted-foreground shrink-0 transition-transform',
                            openTermId === t.id && 'rotate-180'
                          )}
                        />
                      </div>
                      {openTermId === t.id && (
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                          {flashcardDef(t) || 'No definition yet.'}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
