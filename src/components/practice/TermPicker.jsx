import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import StudyScreenShell from '@/components/study/StudyScreenShell';
import { SKIM_TIER_ORDER, orderLikeSkim, inferRankMode, tierLabelsFor, RANK_MODE } from '@/lib/studyUtils';

export default function TermPicker({ terms, rankMode, verb = 'practice', action = 'Start', onStart, onBack }) {
  const mode = inferRankMode(terms, { rankMode });
  const labels = tierLabelsFor(mode);
  const ordered = React.useMemo(() => orderLikeSkim(terms), [terms]);
  const [selected, setSelected] = React.useState(() => new Set());

  const sections = React.useMemo(() => {
    const groups = SKIM_TIER_ORDER.map((id) => ({
      id,
      title: labels[id],
      items: ordered.filter((t) => t.tier === id),
    })).filter((g) => g.items.length);
    const leftover = ordered.filter((t) => !SKIM_TIER_ORDER.includes(t.tier));
    if (leftover.length) groups.push({ id: 'other', title: groups.length ? 'Other' : null, items: leftover });
    return groups;
  }, [ordered, labels]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (items) => {
    const ids = items.map((t) => t.id);
    setSelected((prev) => {
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => {
        if (allOn) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const hint = mode === RANK_MODE.DIFFICULTY
    ? `${labels.critical} is first. Tap the ones you want to ${verb}, or a group header to grab that whole set.`
    : `Must know is first. Tap the ones you want to ${verb}, or a group header to grab that whole set.`;

  const body = (
    <>
        <h2 className="text-title text-foreground">Which terms?</h2>
        <p className="text-meta text-muted-foreground">{hint}</p>
        <div className="flex flex-col gap-6">
          {sections.map((g) => {
            const ids = g.items.map((t) => t.id);
            const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
            return (
              <div key={g.id}>
                {g.title && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.items)}
                      className="text-title text-foreground"
                    >
                      {g.title}
                      <span className="text-muted-foreground font-semibold"> · {g.items.length}</span>
                      {allOn ? <span className="text-muted-foreground font-semibold"> · all on</span> : null}
                    </button>
                  </div>
                )}
                <div className="overflow-hidden rounded-card border border-border bg-surface-1">
                  {g.items.map((t) => {
                    const on = selected.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(t.id)}
                        className={cn(
                          'press flex h-action w-full items-center border-b border-border px-4 text-left last:border-b-0',
                          on ? 'bg-surface-2 text-foreground' : 'bg-transparent text-muted-foreground',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-body font-semibold text-foreground">{t.term}</span>
                          <span className="block truncate text-meta text-muted-foreground">{t.definition}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
    </>
  );

  const start = (
    <Button
      disabled={!selected.size}
      onClick={() => onStart(ordered.filter((t) => selected.has(t.id)))}
      className="w-full"
    >
      {action} · {selected.size}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );

  if (onBack) {
    return (
      <StudyScreenShell onBack={onBack} action={start}>
        {body}
      </StudyScreenShell>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-gutter pt-8">
      <div className="mx-auto flex w-full max-w-study flex-1 flex-col gap-6">
        {body}
        {start}
      </div>
    </div>
  );
}
