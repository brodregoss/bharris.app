import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import TypeDefMode from '@/components/study/TypeDefMode';
import { inferRankMode, tierLabelsFor, RANK_MODE } from '@/lib/studyUtils';

// Screen C — exposure-only scrollable list. No grading.
export default function PassiveSkim({ terms, allTerms, behind, onUpdateTerm, onDone, rankMode }) {
  const [seenIds, setSeenIds] = React.useState(new Set());
  const [extra, setExtra] = React.useState(null);
  const closeExtra = React.useCallback(() => setExtra(null), []);
  const listRef = React.useRef(null);
  const pool = allTerms?.length ? allTerms : terms;
  const mode = inferRankMode(terms, { rankMode });
  const labels = tierLabelsFor(mode);
  const difficulty = mode === RANK_MODE.DIFFICULTY;

  React.useEffect(() => {
    if (extra) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const id = e.target.getAttribute('data-id');
            if (id) {
              setSeenIds((prev) => {
                if (prev.has(id)) return prev;
                const n = new Set(prev);
                n.add(id);
                return n;
              });
              onUpdateTerm(id, { seen: true });
            }
          }
        });
      },
      { root: null, threshold: 0.5 }
    );
    const els = listRef.current?.querySelectorAll('[data-id]');
    els?.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [terms, onUpdateTerm, extra]);

  if (extra) {
    return (
      <TypeDefMode
        terms={pool}
        startIn={extra}
        onUpdateTerm={onUpdateTerm}
        onClose={closeExtra}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-xl font-bold tracking-tight">{difficulty ? labels.passive : 'Passive skim'}</h2>
          <button
            type="button"
            onClick={() => setExtra('flash')}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline shrink-0 pt-1"
          >
            Flash cards
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {difficulty
            ? 'These are the easier or more familiar ideas. Quick exposure — no grading.'
            : 'Quick exposure — no grading. Scroll through to review.'}
        </p>
        {behind && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 p-3 mb-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Running a bit behind — trimming your passive review to keep practice test time safe.</span>
          </div>
        )}
        <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 mb-4">
          {terms.map((t) => {
            const seen = seenIds.has(t.id);
            return (
              <div
                key={t.id}
                data-id={t.id}
                className={`w-full rounded-xl border p-3 transition ${
                  seen ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20' : 'border-border bg-card'
                }`}
              >
                <p className="text-lg font-semibold">{t.term}</p>
                <p className="text-base text-muted-foreground mt-0.5 leading-relaxed">{t.definition}</p>
              </div>
            );
          })}
          {terms.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nothing to skim — nice.</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => setExtra('type')}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Type the defs
          </Button>
          <Button
            onClick={onDone}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
