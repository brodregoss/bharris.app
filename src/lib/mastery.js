import { retireThresholdForTier } from '@/lib/studyUtils';

export const MASTERY = {
  NONE: 0,
  GUESS: 1,
  PARTIAL: 2,
  SOLID: 3,
  MASTERED: 4,
};

export const MASTERY_LEVELS = [
  { level: 1, label: 'Guess', hint: 'A vague try — the base of the pyramid' },
  { level: 2, label: 'Getting there', hint: 'Some of the idea, missing pieces' },
  { level: 3, label: 'Solid', hint: 'Mostly there, a few gaps' },
  { level: 4, label: 'Mastered', hint: 'Could teach it — earned, not claimed' },
];

export function clampMastery(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(4, Math.round(v)));
}

// Infer a starting level from a finished cram. Never infers Mastered —
// that can only come from a full Explain-it grade.
export function inferredMastery(term) {
  if (typeof term.mastery === 'number') return clampMastery(term.mastery);
  if (term.testResult === false) return MASTERY.GUESS;
  if ((term.recallHistory || []).some((h) => h.result === 'missed')) return MASTERY.GUESS;
  if (term.confidence === 'blank') return MASTERY.NONE;
  if (term.testResult === true) return MASTERY.SOLID;
  const rt = retireThresholdForTier(term.tier || 'core');
  if ((term.correctStreak || 0) >= rt) return MASTERY.SOLID;
  if (term.confidence === 'know') return MASTERY.PARTIAL;
  if (term.confidence === 'shaky') return MASTERY.GUESS;
  return MASTERY.NONE;
}

export function withInferredMastery(terms) {
  return (terms || []).map((t) => ({ ...t, mastery: inferredMastery(t) }));
}

// Flashcards / tests can raise as high as Solid, never Mastered.
export function bumpFromPractice(current, { correct }) {
  const now = clampMastery(current);
  if (correct) {
    if (now >= MASTERY.MASTERED) return MASTERY.MASTERED;
    if (now <= MASTERY.NONE) return MASTERY.PARTIAL;
    return Math.min(MASTERY.SOLID, now + 1);
  }
  if (now >= MASTERY.MASTERED) return MASTERY.SOLID;
  if (now <= MASTERY.NONE) return MASTERY.GUESS;
  return Math.max(MASTERY.GUESS, now - 1);
}

// User can set 0–3. Mastered cannot be chosen — only earned via Explain it.
export function userSetMastery(current, next) {
  const want = clampMastery(next);
  if (want >= MASTERY.MASTERED) return clampMastery(current);
  return want;
}

export function needsWork(term) {
  return clampMastery(term.mastery) < MASTERY.MASTERED;
}

export function sortForPractice(terms) {
  return [...terms].sort((a, b) => {
    const am = clampMastery(a.mastery);
    const bm = clampMastery(b.mastery);
    if (am !== bm) return am - bm;
    return (a.term || '').localeCompare(b.term || '');
  });
}

export function parseExplainGrade(res) {
  let obj = res;
  if (typeof obj === 'string') {
    const start = obj.indexOf('{');
    const end = obj.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        obj = JSON.parse(obj.slice(start, end + 1));
      } catch {
        obj = null;
      }
    }
  }
  if (!obj || typeof obj !== 'object') return null;
  const nested = obj.output ?? obj.data ?? obj.result ?? obj;
  const src = nested && typeof nested === 'object' ? nested : obj;
  const level = clampMastery(src.level);
  if (level < 1) return null;
  return {
    level,
    pointsHit: Array.isArray(src.points_hit) ? src.points_hit.map(String) : [],
    pointsMissed: Array.isArray(src.points_missed) ? src.points_missed.map(String) : [],
    feedback: typeof src.feedback === 'string' ? src.feedback : '',
  };
}

export function localExplainLevel(text, definition) {
  const answer = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const def = String(definition || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!answer) return 1;
  const words = def.split(' ').filter((w) => w.length > 3);
  if (!words.length) return 1;
  const hits = words.filter((w) => answer.includes(w)).length;
  const ratio = hits / words.length;
  if (ratio >= 0.7 && answer.split(' ').length >= 12) return 3;
  if (ratio >= 0.4) return 2;
  return 1;
}

