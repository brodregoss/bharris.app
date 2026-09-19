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
    description: 'Review old terms on a schedule, plus some new ones.',
  },
};

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
  const [selected, setSelected] = React.useState(
    () => normalizeStudyMode(setup?.studyMode || suggested)
  );

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
    navigate('/setup', { state: { source, setup: { ...setup, studyMode: selected } } });
  };

  const continueOn = () => {
    navigate('/triage', {
      state: {
        source,
        setup: { ...setup, studyMode: selected },
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-3 pt-safe pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 px-3 pt-1 pb-3 flex flex-col overflow-y-auto">
        <div className="w-full flex-1 flex flex-col">
          <h1 className="text-xl font-bold tracking-tight text-center">Choose a study mode</h1>
          <p className="text-sm text-muted-foreground text-center mt-1.5">
            Pick whatever way you learn best.
          </p>
          <p className="text-[11px] text-muted-foreground text-center mt-1.5 leading-snug px-2">
            {suggestionLine}
          </p>

          <div className="mt-5 mx-auto w-full max-w-md flex flex-col gap-3">
            {MODES.map((id) => {
              const meta = PICKER_COPY[id];
              const isSelected = selected === id;
              const isSuggested = suggested === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  className={cn(
                    'w-full text-center rounded-2xl border px-4 py-4 shadow-sm transition flex flex-col items-center',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary'
                      : 'border-border bg-card hover:border-muted-foreground'
                  )}
                >
                  {isSuggested && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                      Suggested
                    </span>
                  )}
                  <p className="text-lg font-bold tracking-tight leading-tight text-center">
                    {meta.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-snug text-center">
                    {meta.description}
                  </p>
                  {id === STUDY_MODE.SPACED_CRAM && setup.examTiming === 'today' && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-snug text-center">
                      Nice if you can come back again.
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="px-3 pt-2 pb-safe">
        <div className="w-full">
          <Button
            size="lg"
            onClick={continueOn}
            className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
