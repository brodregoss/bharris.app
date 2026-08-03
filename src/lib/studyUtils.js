// Shared logic for the post-triage study flow.

export const TIER_WEIGHT = { critical: 3, core: 2, passive: 1 };
export const CONF_WEIGHT = { blank: 3, shaky: 2, know: 1 };

export const BLOCK_BUDGET_RATIO = {
  critical: 0.4,
  core: 0.3,
  passive: 0.1,
  test: 0.15,
  confidence: 0.05,
};

// Normalize the setup-level examType ("multiple_choice" | "short_answer" | "mixed")
// into the canonical enum used downstream.
export function normalizeExamType(t) {
  if (t === 'multiple_choice') return 'mcq';
  if (t === 'short_answer' || t === 'mcq' || t === 'mixed') return t;
  return 'mixed';
}

// "auto-sort" tier derived from the AI difficulty score (1-10).
// Cutoffs shift by exam type: MCQ widens Passive (broad coverage),
// short-answer narrows Critical (depth on fewer big ideas), mixed = default.
export function tierFromDifficulty(d, examType = 'mixed') {
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

// Passive block time share shifts by exam type.
// MCQ softens the "trim Passive first" logic; short-answer compresses Passive harder.
export function passiveRatioFor(examType = 'mixed') {
  const t = normalizeExamType(examType);
  if (t === 'mcq') return 0.12;
  if (t === 'short_answer') return 0.07;
  return 0.1;
}

// Map the triage column (user confidence) to the confidence enum.
export function confidenceFromTriage(t) {
  if (t === 'know_it') return 'know';
  return t; // 'blank' | 'shaky'
}

export function priority(term) {
  return TIER_WEIGHT[term.tier] * CONF_WEIGHT[term.confidence];
}

export function retireThresholdForTier(tier) {
  return tier === 'critical' ? 2 : 1;
}

function termMastery(term) {
  const rt = retireThresholdForTier(term.tier);
  let m = rt ? Math.min(1, (term.correctStreak || 0) / rt) : 0;
  if (term.seen) m = Math.max(m, 0.15);
  if (term.testResult === true) m = 1;
  else if (term.testResult === false) m = Math.max(0, m - 0.3);
  return m;
}

// Weighted average of per-term mastery, weighted by tierWeight
// (Critical mistakes hurt the score most). Test results dominate.
export function computeReadiness(terms) {
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

// --- Sleep protection (wind-down) ---

// A term is "shaky" if flagged by the practice test, self-rated blank/shaky,
// missed in recall, or a critical/core term not yet retired.
export function isTermShaky(term, stillShakyIds = new Set()) {
  if (stillShakyIds.has(term.id)) return true;
  if (term.confidence === 'blank' || term.confidence === 'shaky') return true;
  if ((term.recallHistory || []).some((h) => h.result === 'missed')) return true;
  if ((term.tier === 'critical' || term.tier === 'core') && (term.correctStreak || 0) < retireThresholdForTier(term.tier)) return true;
  return false;
}

export function shakyTermIds(terms, stillShaky = []) {
  const ids = new Set(stillShaky);
  terms.forEach((t) => { if (isTermShaky(t, ids)) ids.add(t.id); });
  return ids;
}

// Within ~45 min of the configured sleep time (HH:MM). Only meaningful for
// non-today exams — same-day mode uses the exam itself as the cutoff.
export function withinStopWindow(examTiming, stopTime, now) {
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

export function fmtTime(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}