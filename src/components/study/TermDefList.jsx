import React from 'react';

const GROUPS = [
  { id: 'critical', title: 'Critical' },
  { id: 'core', title: 'Core' },
  { id: 'passive', title: 'Passive' },
];

export default function TermDefList({ terms }) {
  const grouped = GROUPS.map((g) => ({
    ...g,
    items: (terms || []).filter((t) => t.tier === g.id),
  })).filter((g) => g.items.length);
  const leftover = (terms || []).filter((t) => !GROUPS.some((g) => g.id === t.tier));
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
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
              {g.title} · {g.items.length}
            </p>
          )}
          <div className="space-y-2">{cards(g.items)}</div>
        </div>
      ))}
    </div>
  );
}
