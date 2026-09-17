import React from 'react';
import { SKIM_TIER_ORDER, inferRankMode, tierLabelsFor } from '@/lib/studyUtils';

export default function TermDefList({ terms, rankMode }) {
  const mode = inferRankMode(terms, { rankMode });
  const labels = tierLabelsFor(mode);
  const grouped = SKIM_TIER_ORDER.map((id) => ({
    id,
    title: labels[id],
    items: (terms || []).filter((t) => t.tier === id),
  })).filter((g) => g.items.length);
  const leftover = (terms || []).filter((t) => !SKIM_TIER_ORDER.includes(t.tier));
  const sections = leftover.length
    ? [...grouped, { id: 'other', title: grouped.length ? 'Other' : null, items: leftover }]
    : grouped;

  if (!terms?.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No terms yet.</p>;
  }

  const cards = (items) =>
    items.map((t) => (
      <div key={t.id} className="rounded-xl border border-border bg-card p-3">
        <p className="text-lg font-semibold">{t.term}</p>
        <p className="text-base text-muted-foreground mt-0.5 leading-relaxed">{t.definition}</p>
      </div>
    ));

  if (sections.length <= 1 && !sections[0]?.title) {
    return <div className="space-y-2">{cards(terms)}</div>;
  }

  return (
    <div className="space-y-5">
      {sections.map((g) => (
        <div key={g.id}>
          {g.title && (
            <p className="text-sm font-bold tracking-tight mb-2">
              {g.title}
              <span className="text-muted-foreground font-semibold"> · {g.items.length}</span>
            </p>
          )}
          <div className="space-y-2">{cards(g.items)}</div>
        </div>
      ))}
    </div>
  );
}
