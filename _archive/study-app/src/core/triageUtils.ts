import type { TriageTier } from './types';

export type RawTerm = {
  id: string;
  term: string;
  definition: string;
  difficulty: number;
  depends_on?: string[];
  tier?: TriageTier;
};

const MAX_TERMS = 15;

export function rankTerms(terms: RawTerm[]): RawTerm[] {
  const depCount: Record<string, number> = {};
  terms.forEach((t) => {
    depCount[t.term] = 0;
  });
  terms.forEach((t) => {
    (t.depends_on || []).forEach((d) => {
      if (depCount[d] !== undefined) depCount[d] += 1;
    });
  });
  const maxDiff = Math.max(...terms.map((t) => t.difficulty || 1), 1);
  const maxDep = Math.max(...Object.values(depCount), 1);

  const scored = terms.map((t) => {
    const diffNorm = (t.difficulty || 1) / maxDiff;
    const depNorm = (depCount[t.term] || 0) / maxDep;
    const priority = diffNorm * 0.6 + depNorm * 1.2;
    return { ...t, _priority: priority };
  });

  const sorted = [...scored].sort((a, b) => b._priority - a._priority);
  const n = sorted.length;
  const blankEnd = Math.max(1, Math.round(n * 0.35));
  const shakyEnd = blankEnd + Math.max(1, Math.round(n * 0.35));

  return sorted.map((t, i) => ({
    ...t,
    tier: (i < blankEnd ? 'blank' : i < shakyEnd ? 'shaky' : 'know_it') as TriageTier,
  }));
}

export { MAX_TERMS };

export const TIERS = [
  { id: 'blank' as const, label: 'Blank', sub: "Don't know", bg: '#FF8A8A' },
  { id: 'shaky' as const, label: 'Shaky', sub: 'Kind of know', bg: '#FFC078' },
  { id: 'know_it' as const, label: 'Know it', sub: 'Know it', bg: '#8CE99A' },
];
