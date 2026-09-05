import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Check, X, ArrowRight } from 'lucide-react';
import { bumpFromPractice, sortForPractice } from '@/lib/mastery';

export default function PracticeFlashcards({ terms, onUpdateTerm, onDone }) {
  const [queue] = React.useState(() => sortForPractice(terms).map((t) => t.id));
  const byId = React.useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const [pos, setPos] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    setRevealed(false);
  }, [pos]);

  const current = byId[queue[pos]];

  const grade = (correct) => {
    if (!current) return;
    onUpdateTerm(current.id, { mastery: bumpFromPractice(current.mastery, { correct }) });
    if (pos + 1 >= queue.length) setDone(true);
    else setPos((p) => p + 1);
  };

  if (done || !current) {
    return (
      <div className="flex-1 flex flex-col px-5 pt-6">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col items-center text-center pt-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Flashcards done</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Got-it cards moved up. Misses stay in the work-on pile. Mastered still has to be earned in Explain it.
          </p>
          <Button
            onClick={onDone}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Back to practice
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <p className="text-xs text-muted-foreground mb-3">
        Flashcards · {pos + 1}/{queue.length}
      </p>
      <div className="flex-1 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm text-center min-h-[260px] flex flex-col items-center justify-center"
        >
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
            {revealed ? 'Definition' : 'Term'}
          </p>
          <p className="text-3xl font-bold tracking-tight">{current.term}</p>
          {revealed ? (
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{current.definition}</p>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">Tap the card to flip it.</p>
          )}
        </button>

        <div className="w-full max-w-md mt-4">
          {!revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              className="w-full h-12 rounded-2xl font-semibold"
            >
              <Eye className="w-4 h-4 mr-2" /> Flip card
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => grade(false)}
                variant="destructive"
                className="h-12 rounded-2xl font-semibold"
              >
                <X className="w-4 h-4 mr-2" /> Needs work
              </Button>
              <Button
                onClick={() => grade(true)}
                variant="success"
                className="h-12 rounded-2xl font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Got it
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
