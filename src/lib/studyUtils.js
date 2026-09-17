// Shared logic for the post-triage study flow.

export const TIER_WEIGHT = { critical: 3, core: 2, passive: 1 };
export const CONF_WEIGHT = { blank: 3, shaky: 2, know: 1 };

export const TIER_LABELS = {
  critical: 'Must know',
  core: 'Should know',
  passive: 'Nice to know',
};

export const TIER_HINTS = {
  critical: 'Hardest terms — the ones that matter most on the exam.',
  core: 'Supporting terms you should still have down.',
  passive: 'Easier terms you only skimmed.',
};

export const RANK_MODE = {
  IMPORTANCE: 'importance',
  DIFFICULTY: 'difficulty',
};

const DIFFICULTY_TIER_LABELS = {
  critical: 'Difficult concepts',
  core: 'Tougher concepts',
  passive: 'Easier concepts',
};

const DIFFICULTY_TIER_HINTS = {
  critical: 'Obscure, easy to mix up, or slow to stick — give these extra reps.',
  core: 'Still take some work, but they are less slippery than the top group.',
  passive: 'Shorter or more familiar ideas that usually come back faster.',
};

export function normalizeRankMode(mode) {
  return mode === RANK_MODE.DIFFICULTY ? RANK_MODE.DIFFICULTY : RANK_MODE.IMPORTANCE;
}

export function tierLabelsFor(rankMode) {
  return normalizeRankMode(rankMode) === RANK_MODE.DIFFICULTY ? DIFFICULTY_TIER_LABELS : TIER_LABELS;
}

export function tierHintsFor(rankMode) {
  return normalizeRankMode(rankMode) === RANK_MODE.DIFFICULTY ? DIFFICULTY_TIER_HINTS : TIER_HINTS;
}

export function rankModeSkimHint(rankMode) {
  if (normalizeRankMode(rankMode) === RANK_MODE.DIFFICULTY) {
    return 'Every term is needed, so these are grouped by how hard they are to learn — Difficult concepts, Tougher concepts, then Easier concepts. Scroll through, then start flashcards when you’re ready.';
  }
  return 'Grouped by how much they matter on the exam — Must know, Should know, then Nice to know. Scroll through, then start flashcards when you’re ready.';
}

const LIST_STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'about', 'your']);

function sharedListToken(names) {
  const counts = {};
  names.forEach((name) => {
    String(name)
      .split(/[\s/-]+/)
      .forEach((raw) => {
        const w = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (w.length < 4 || LIST_STOP.has(w)) return;
        counts[w] = (counts[w] || 0) + 1;
      });
  });
  const n = names.length;
  return Object.values(counts).some((c) => c >= Math.max(4, Math.ceil(n * 0.6)));
}

function numberedClosedList(list) {
  const n = list.length;
  if (n < 5) return false;
  const hits = list.filter((t) =>
    /\b(amendment|article|commandment)\s*#?\d|\d+(st|nd|rd|th)\s+(amendment|article|commandment)/i.test(
      t.term || ''
    )
  ).length;
  return hits / n >= 0.6;
}

export function inferRankMode(terms, meta = {}) {
  if (meta.rankMode === RANK_MODE.DIFFICULTY || meta.rankMode === RANK_MODE.IMPORTANCE) {
    return meta.rankMode;
  }
  const title = `${meta.title || ''} ${meta.id || ''} ${meta.sourceId || ''}`.toLowerCase();
  if (/bill of rights|amendments?\b|cranial nerv|ten commandments|periodic table/.test(title)) {
    return RANK_MODE.DIFFICULTY;
  }
  const list = Array.isArray(terms) ? terms.filter((t) => t?.term) : [];
  if (list.length < 5) return RANK_MODE.IMPORTANCE;
  if (numberedClosedList(list)) return RANK_MODE.DIFFICULTY;
  const depShare = list.filter((t) => (t.depends_on || []).length > 0).length / list.length;
  if (depShare > 0.25) return RANK_MODE.IMPORTANCE;
  if (sharedListToken(list.map((t) => t.term))) return RANK_MODE.DIFFICULTY;
  return RANK_MODE.IMPORTANCE;
}

export function sessionRankMode(setup, terms, extra = {}) {
  return inferRankMode(terms, {
    title: extra.title || setup?.title,
    id: extra.id || extra.sourceId || setup?.sourceId,
    rankMode: extra.rankMode || setup?.rankMode,
  });
}

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
  const tw = TIER_WEIGHT[term?.tier] || 0;
  const cw = CONF_WEIGHT[term?.confidence] || 0;
  return tw * cw;
}

export const SKIM_TIER_ORDER = ['critical', 'core', 'passive'];

export function orderLikeSkim(terms) {
  const list = Array.isArray(terms) ? terms : [];
  const byPri = (a, b) => priority(b) - priority(a);
  const out = [];
  for (const id of SKIM_TIER_ORDER) {
    out.push(...list.filter((t) => t.tier === id).sort(byPri));
  }
  out.push(...list.filter((t) => !SKIM_TIER_ORDER.includes(t.tier)).sort(byPri));
  return out;
}

// How many terms we can reasonably flashcard in the time left.
// Uses ~70% of the clock (Must know + Should know) at ~3 min each.
export function recallTermCap(hours) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return 12;
  const recallMinutes = h * 60 * 0.7;
  return Math.max(8, Math.min(80, Math.floor(recallMinutes / 3)));
}

export function planRecallQueues(terms, hours) {
  const list = Array.isArray(terms) ? terms : [];
  const byPri = (a, b) => priority(b) - priority(a);
  const critical = list.filter((t) => t.tier === 'critical').sort(byPri);
  const core = list.filter((t) => t.tier === 'core').sort(byPri);
  const passive = list.filter((t) => t.tier === 'passive').sort(byPri);
  const cap = recallTermCap(hours);
  const candidates = [...critical, ...core];
  if (candidates.length <= cap) {
    return { critical, core, passive, capped: false, cap };
  }
  const keep = new Set(candidates.slice(0, cap).map((t) => t.id));
  const overflow = candidates.filter((t) => !keep.has(t.id));
  return {
    critical: critical.filter((t) => keep.has(t.id)),
    core: core.filter((t) => keep.has(t.id)),
    passive: [...passive, ...overflow],
    capped: true,
    cap,
  };
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
    const w = TIER_WEIGHT[t.tier] || 0;
    num += w * termMastery(t);
    den += w;
  });
  return den ? Math.round((num / den) * 100) : 0;
}

// --- Sleep protection (wind-down) ---

// A term is "shaky" if flagged by the practice test, self-rated blank/shaky,
// missed in recall, or a critical/core term not yet retired.
export function isTermShaky(term, stillShakyIds = new Set(), recallIds = null) {
  if (stillShakyIds.has(term.id)) return true;
  if (term.confidence === 'blank' || term.confidence === 'shaky') return true;
  if ((term.recallHistory || []).some((h) => h.result === 'missed')) return true;
  if ((term.tier === 'critical' || term.tier === 'core') && (term.correctStreak || 0) < retireThresholdForTier(term.tier)) {
    if (!recallIds || recallIds.has(term.id)) return true;
  }
  return false;
}

export function shakyTermIds(terms, stillShaky = [], recallIds = null) {
  const ids = new Set(stillShaky);
  terms.forEach((t) => { if (isTermShaky(t, ids, recallIds)) ids.add(t.id); });
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

// User-written wording for flashcard faces only. Tests and grading keep term.definition.
export function flashcardDef(term) {
  const own = String(term?.ownDefinition || '').trim();
  return own || String(term?.definition || '');
}

export function fmtTime(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Exact / near-exact match so obvious answers (including case differences) are
// marked correct even when the LLM is down or returns a malformed payload.
export function localGradeShortAnswer(student, definition) {
  const answer = normalizeAnswer(student);
  const def = normalizeAnswer(definition);
  if (!answer || !def) return null;
  if (answer === def) {
    return { correct: true, feedback: 'Matches the expected answer.' };
  }
  const shorter = answer.length <= def.length ? answer : def;
  const longer = answer.length <= def.length ? def : answer;
  if (shorter.length >= Math.min(4, def.length) && longer.includes(shorter)) {
    return { correct: true, feedback: 'Close enough to the expected answer.' };
  }
  return null;
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseGradeResponse(res) {
  let obj = parseJsonObject(res) || (res && typeof res === 'object' ? res : null);
  if (!obj) return null;
  const nested = obj.output ?? obj.data ?? obj.result ?? obj;
  obj = parseJsonObject(nested) || (nested && typeof nested === 'object' ? nested : obj);
  const raw = obj?.correct;
  if (typeof raw === 'boolean') {
    return { correct: raw, feedback: typeof obj.feedback === 'string' ? obj.feedback : '' };
  }
  if (typeof raw === 'string') {
    const lowered = raw.toLowerCase();
    if (lowered === 'true' || lowered === 'false') {
      return { correct: lowered === 'true', feedback: typeof obj.feedback === 'string' ? obj.feedback : '' };
    }
  }
  return null;
}