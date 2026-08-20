import type { Confidence, StudyTerm, StudyTier, TriageTier } from './types';

export const TIER_WEIGHT: Record<StudyTier, number> = { critical: 3, core: 2, passive: 1 };
export const CONF_WEIGHT: Record<Confidence, number> = { blank: 3, shaky: 2, know: 1 };

export const BLOCK_BUDGET_RATIO = {
  critical: 0.4,
  core: 0.3,
  passive: 0.1,
  test: 0.15,
  confidence: 0.05,
};

export function normalizeExamType(t: string) {
  if (t === 'multiple_choice') return 'mcq';
  if (t === 'short_answer' || t === 'mcq' || t === 'mixed') return t;
  return 'mixed';
}

export function tierFromDifficulty(d: number, examType = 'mixed'): StudyTier {
  const t = normalizeExamType(examType);
  if (t === 'mcq') {
    if (d >= 8) return 'critical';
    if (d >= 5) return 'core';
    return 'passive';
  }
  if (t === 'short_answer') {
    if (d >= 8) return 'critical';
    if (d >= 4) return 'core';
    return 'passive';
  }
  if (d >= 7) return 'critical';
  if (d >= 4) return 'core';
  return 'passive';
}

export function passiveRatioFor(examType = 'mixed') {
  const t = normalizeExamType(examType);
  if (t === 'mcq') return 0.12;
  if (t === 'short_answer') return 0.07;
  return 0.1;
}

export function confidenceFromTriage(t: string): Confidence {
  if (t === 'know_it') return 'know';
  if (t === 'shaky') return 'shaky';
  return 'blank';
}

export function priority(term: StudyTerm) {
  return TIER_WEIGHT[term.tier] * CONF_WEIGHT[term.confidence];
}

export function retireThresholdForTier(tier: StudyTier) {
  return tier === 'critical' ? 2 : 1;
}

function termMastery(term: StudyTerm) {
  const rt = retireThresholdForTier(term.tier);
  let m = rt ? Math.min(1, (term.correctStreak || 0) / rt) : 0;
  if (term.seen) m = Math.max(m, 0.15);
  if (term.testResult === true) m = 1;
  else if (term.testResult === false) m = Math.max(0, m - 0.3);
  return m;
}

export function computeReadiness(terms: StudyTerm[]) {
  if (!terms.length) return 0;
  let num = 0;
  let den = 0;
  terms.forEach((t) => {
    const w = TIER_WEIGHT[t.tier];
    num += w * termMastery(t);
    den += w;
  });
  return den ? Math.round((num / den) * 100) : 0;
}

export function isTermShaky(term: StudyTerm, stillShakyIds = new Set<string>()) {
  if (stillShakyIds.has(term.id)) return true;
  if (term.confidence === 'blank' || term.confidence === 'shaky') return true;
  if ((term.recallHistory || []).some((h) => h.result === 'missed')) return true;
  if (
    (term.tier === 'critical' || term.tier === 'core') &&
    (term.correctStreak || 0) < retireThresholdForTier(term.tier)
  )
    return true;
  return false;
}

export function shakyTermIds(terms: StudyTerm[], stillShaky: string[] = []) {
  const ids = new Set(stillShaky);
  terms.forEach((t) => {
    if (isTermShaky(t, ids)) ids.add(t.id);
  });
  return ids;
}

export function withinStopWindow(examTiming: string, stopTime: string | null, now: number) {
  if (examTiming === 'today' || !stopTime) return false;
  const parts = String(stopTime).split(':').map(Number);
  const h = parts[0];
  const m = parts[1];
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  const stop = new Date(now);
  stop.setHours(h, m, 0, 0);
  return now >= stop.getTime() - 45 * 60 * 1000;
}

export const WIND_DOWN_BUDGET_MS = 12 * 60 * 1000;

export function fmtTime(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export type TriageTierBorder = Record<TriageTier, string>;
export const TRIAGE_TIER_BORDER: TriageTierBorder = {
  blank: '#fb7185',
  shaky: '#fbbf24',
  know_it: '#34d399',
};
