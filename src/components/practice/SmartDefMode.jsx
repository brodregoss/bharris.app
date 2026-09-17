import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SKIM_TIER_ORDER, orderLikeSkim, inferRankMode, tierLabelsFor, RANK_MODE } from '@/lib/studyUtils';
import WriteOwnDef, { writtenDefsFrom } from '@/components/study/WriteOwnDef';

export default function SmartDefMode({ terms, onUpdateTerm, onDone, rankMode }) {
  const mode = inferRankMode(terms, { rankMode });
  const labels = tierLabelsFor(mode);
  const ordered = React.useMemo(() => orderLikeSkim(terms), [terms]);
  const [selected, setSelected] = React.useState(() => new Set());
  const [stage, setStage] = React.useState('pick');

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

  const cards = ordered.filter((t) => selected.has(t.id));

  if (stage === 'write') {
    return (
      <WriteOwnDef
        cards={cards}
        allTerms={ordered}
        variant="defMode"
        onComplete={(entries) => {
          const { ids, defs } = writtenDefsFrom(entries);
          (ids.length ? ids : cards.map((c) => c.id)).forEach((id) => {
            if (defs[id]) onUpdateTerm(id, { ownDefinition: defs[id] });
          });
          onDone();
        }}
        onSkip={() => setStage('pick')}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <h2 className="text-xl font-bold tracking-tight mb-1">Which terms?</h2>
        <p className="text-xs text-muted-foreground mb-4">
          {mode === RANK_MODE.DIFFICULTY
            ? `${labels.critical} is first. Tap the ones you want to write, or a group header to grab that whole set.`
            : 'Must know is first. Tap the ones you want to write, or a group header to grab that whole set.'}
        </p>
        <div className="flex-1 overflow-y-auto space-y-5 mb-4">
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
                      className="text-sm font-bold tracking-tight hover:underline underline-offset-4"
                    >
                      {g.title}
                      <span className="text-muted-foreground font-semibold"> · {g.items.length}</span>
                      {allOn ? <span className="text-muted-foreground font-semibold"> · all on</span> : null}
                    </button>
                  </div>
                )}
                <div className="space-y-2">
                  {g.items.map((t) => {
                    const on = selected.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggle(t.id)}
                        className={cn(
                          'w-full text-left rounded-xl border p-3 transition',
                          on ? 'border-foreground bg-card' : 'border-border bg-muted/30',
                        )}
                      >
                        <p className="text-sm font-semibold">{t.term}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.definition}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <Button
          disabled={!selected.size}
          onClick={() => setStage('write')}
          className="w-full h-12 rounded-2xl font-semibold"
        >
          Start writing · {selected.size}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
