import React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { termCount } from '@/lib/notesSource';
import {
  STUDY_MODE,
  STUDY_MODE_META,
  suggestStudyMode,
  formatMinutesPerTerm,
  normalizeStudyMode,
  spacedCramAvailable,
  buildCramPlan,
} from '@/lib/studyUtils';

const MODES = [STUDY_MODE.ASSISTED, STUDY_MODE.TRUE_CRAM, STUDY_MODE.SPACED_CRAM];

const PICKER_COPY = {
  assisted: {
    title: 'Independent Assisted',
    description: 'Study with help at your own pace. Fine for today.',
  },
  true_cram: {
    title: 'True Cram',
    description: 'Go over every term with a partner. Built for large sets.',
  },
  spaced_cram: {
    title: 'Spaced Cram',
    description: 'Overnight expanding retrieval. Same terms come back on a schedule.',
  },
};

function pickSafeMode(mode, suggested, examTiming) {
  const next = normalizeStudyMode(mode || suggested);
  if (next === STUDY_MODE.SPACED_CRAM && !spacedCramAvailable(examTiming)) {
    return suggested === STUDY_MODE.SPACED_CRAM ? STUDY_MODE.ASSISTED : normalizeStudyMode(suggested);
  }
  return next;
}

export default function StudyMode() {
  const navigate = useNavigate();
  const location = useLocation();
  const source = location.state?.source;
  const setup = location.state?.setup;
  const count = termCount(source);
  const suggested = suggestStudyMode({
    hours: setup?.hours,
    termCount: count,
    examTiming: setup?.examTiming,
  });
  const [selected, setSelected] = React.useState(() =>
    pickSafeMode(setup?.studyMode, suggested, setup?.examTiming)
  );
  const [showPlan, setShowPlan] = React.useState(false);

  const spacedOk = spacedCramAvailable(setup?.examTiming);

  React.useEffect(() => {
    if (selected === STUDY_MODE.SPACED_CRAM && !spacedOk) {
      setSelected(pickSafeMode(null, suggested, setup?.examTiming));
    }
  }, [selected, spacedOk, suggested, setup?.examTiming]);

  if (!source) {
    return <Navigate to="/welcome" replace />;
  }
  if (!setup?.hours || !setup?.examType || !setup?.examTiming) {
    return <Navigate to="/setup" replace state={{ source, setup }} />;
  }

  const perTermLabel = formatMinutesPerTerm(setup.hours, count);
  const suggestedMeta = STUDY_MODE_META[suggested];
  const suggestionLine = perTermLabel
    ? `Based on having ~${perTermLabel} per term, ${suggestedMeta.title} might work best.`
    : `${suggestedMeta.title} might work best for this exam timing.`;

  const goBack = () => {
    if (showPlan) {
      setShowPlan(false);
      return;
    }
    navigate('/setup', { state: { source, setup: { ...setup, studyMode: selected } } });
  };

  const continueOn = () => {
    setShowPlan(true);
  };

  const startPlan = () => {
    const studyMode = pickSafeMode(selected, suggested, setup.examTiming);
    navigate('/triage', {
      state: {
        source,
        setup: { ...setup, studyMode },
      },
    });
  };

  const plan = buildCramPlan({
    studyMode: pickSafeMode(selected, suggested, setup.examTiming),
    hours: setup.hours,
    termCount: count,
    examType: setup.examType,
    examTiming: setup.examTiming,
    title: source.title || source.name || '',
  });

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-5 pt-safe">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto px-5 pb-3 pt-2">
        {showPlan ? (
          <div className="flex w-full flex-1 flex-col">
            <h1 className="text-display text-foreground">Here’s the plan</h1>
            {plan.subject ? (
              <p className="mt-3 text-lg font-semibold">{plan.subject}</p>
            ) : null}
            <p className="mt-2 text-sm leading-snug text-muted-foreground">
              {plan.facts.join(' · ')}
            </p>
            <ol className="mx-auto mt-6 flex w-full max-w-study flex-col overflow-hidden rounded-card border border-border bg-surface-1">
              {plan.lines.map((line, i) => (
                <li key={line} className="flex items-start gap-3 px-4 py-4 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-meta font-semibold tabular-nums text-foreground">{i + 1}</span>
                  <span className="pt-2 text-body text-foreground">{line}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
        <div className="flex w-full flex-1 flex-col">
          <h1 className="text-display text-foreground">Study mode</h1>
          <p className="mt-3 text-meta text-muted-foreground">
            Pick whatever way you learn best.
          </p>
          <p className="mt-2 text-meta text-primary">
            {suggestionLine}
          </p>

          <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-2">
            {MODES.map((id) => {
              const meta = PICKER_COPY[id];
              const locked = id === STUDY_MODE.SPACED_CRAM && !spacedOk;
              const isSelected = selected === id && !locked;
              const isSuggested = suggested === id && !locked;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={locked}
                  onClick={() => setSelected(id)}
                  className={cn(
                    'press flex w-full flex-col items-center rounded-card border px-6 py-4 text-center transition',
                    locked
                      ? 'cursor-not-allowed border-border bg-surface-2 text-tertiary'
                      : isSelected
                        ? 'border-primary bg-surface-1 text-foreground'
                        : 'border-border bg-surface-1 text-foreground'
                  )}
                >
                  {isSuggested && (
                    <span className="mb-1 text-label uppercase text-primary">
                      Suggested
                    </span>
                  )}
                  <p className="text-center text-lg font-semibold leading-tight tracking-tight">
                    {meta.title}
                  </p>
                  <p className="mt-1 text-center text-meta text-muted-foreground">
                    {meta.description}
                  </p>
                  {locked && (
                    <p className="mt-1 text-center text-xs leading-snug text-muted-foreground">
                      Needs overnight gaps — won’t work for a same-day exam.
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        )}
      </main>

      <footer className="flex justify-center px-5 pt-2 pb-[max(2.75rem,calc(env(safe-area-inset-bottom,0px)+2.25rem))]">
        <div className="w-1/2">
          <Button
            size="lg"
            onClick={showPlan ? startPlan : continueOn}
            className="h-14 w-full rounded-full text-base font-semibold"
          >
            {showPlan ? 'Start' : 'Continue'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
