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
    return 'Hardest first, then tougher, then easier.';
  }
  return 'Must know, then should know, then nice to know.';
}

export function firstLookAtTerms(terms) {
  return !(Array.isArray(terms) ? terms : []).some((t) => (
    t?.seen
    || (t?.recallHistory || []).length > 0
    || String(t?.ownDefinition || '').trim()
  ));
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
export const OWN_DEF_RECOMMEND_MAX = 10;
export const OWN_DEF_ADD_MORE_BELOW = 5;

export function topTierTerms(terms) {
  return (Array.isArray(terms) ? terms : []).filter((t) => t?.tier === 'critical' && t?.id);
}

export function recommendedOwnDefTerms(terms, limit = OWN_DEF_RECOMMEND_MAX) {
  const cap = Number.isFinite(limit) ? Math.max(0, limit) : OWN_DEF_RECOMMEND_MAX;
  return topTierTerms(terms)
    .filter((t) => !String(t.ownDefinition || '').trim())
    .slice()
    .sort((a, b) => {
      const dd = (Number(b.difficulty) || 0) - (Number(a.difficulty) || 0);
      if (dd) return dd;
      return priority(b) - priority(a);
    })
    .slice(0, cap);
}

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

export const STUDY_MODE = {
  ASSISTED: 'assisted',
  TRUE_CRAM: 'true_cram',
  SPACED_CRAM: 'spaced_cram',
};

export const STUDY_MODE_META = {
  assisted: {
    id: 'assisted',
    title: 'Independent Assisted',
    description:
      'You study with the app’s help, at your own pace. Cram the important terms, then flashcards. Fine for today.',
  },
  true_cram: {
    id: 'true_cram',
    title: 'True Cram',
    description: 'Go over every term with a partner. Rotate to landscape. Built for large sets.',
  },
  spaced_cram: {
    id: 'spaced_cram',
    title: 'Spaced Cram',
    description:
      'Overnight expanding retrieval. Same terms come back at longer gaps, with extra reps on whatever is still shaky.',
  },
};

export function spacedCramAvailable(examTiming) {
  return examTiming === 'tomorrow' || examTiming === '2days';
}

export function normalizeStudyMode(mode) {
  if (mode === STUDY_MODE.TRUE_CRAM || mode === STUDY_MODE.SPACED_CRAM) return mode;
  return STUDY_MODE.ASSISTED;
}

export function continueStudyPath(setup) {
  const mode = normalizeStudyMode(setup?.studyMode);
  if (mode === STUDY_MODE.TRUE_CRAM) return '/true-cram';
  if (mode === STUDY_MODE.SPACED_CRAM) {
    return spacedCramAvailable(setup?.examTiming) ? '/spaced-cram' : '/';
  }
  return '/study';
}

export function trueCramPracticeState(session) {
  if (!session) return null;
  const fromTrueCram =
    normalizeStudyMode(session.setup?.studyMode) === STUDY_MODE.TRUE_CRAM || !!session.trueCram;
  if (!fromTrueCram) return null;
  return {
    flaggedTermIds: session.flaggedTermIds || session.trueCram?.flaggedTermIds || [],
    coveredIds: session.coveredIds || session.trueCram?.coveredIds || [],
  };
}

export function minutesPerTerm(hours, termCount) {
  const h = Number(hours);
  const n = Number(termCount);
  if (!Number.isFinite(h) || h <= 0 || !Number.isFinite(n) || n <= 0) return null;
  return (h * 60) / n;
}

export function formatMinutesPerTerm(hours, termCount) {
  const m = minutesPerTerm(hours, termCount);
  if (m == null) return null;
  if (m >= 10) return `${Math.round(m)} min`;
  return `${m.toFixed(1)} min`;
}

export function formatStudyClock(hours) {
  const total = Math.round(Number(hours) * 60);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hourLabel = h === 1 ? '1 hour' : `${h} hours`;
  if (!m) return hourLabel;
  return `${hourLabel} ${m} min`;
}

function examFormatLabel(examType) {
  const t = normalizeExamType(examType);
  if (t === 'mcq') return 'multiple choice';
  if (t === 'short_answer') return 'short answer';
  return 'mixed';
}

function examWhenLabel(examTiming) {
  if (examTiming === 'tomorrow') return 'tomorrow';
  if (examTiming === '2days') return 'in 2 days';
  return 'today';
}

function deckLine(count) {
  return count === 1 ? '1 term' : `${count} terms`;
}

// Short, honest preview of the cram that starts after a study mode is chosen.
export function buildCramPlan(options = {}) {
  const mode = normalizeStudyMode(options.studyMode);
  const count = Math.max(0, Math.round(Number(options.termCount) || 0));
  const clock = formatStudyClock(options.hours);
  const typeLabel = examFormatLabel(options.examType);
  const when = examWhenLabel(options.examTiming);
  const subject = String(options.title || '').trim();
  const facts = [clock, count ? deckLine(count) : null, typeLabel, `exam ${when}`].filter(Boolean);
  const writtenGrade = typeLabel === 'short answer'
    ? ' You grade the written answers yourself.'
    : typeLabel === 'mixed'
      ? ' You grade the written ones yourself.'
      : '';

  if (mode === STUDY_MODE.TRUE_CRAM) {
    const per = formatMinutesPerTerm(options.hours, count);
    const minutes = minutesPerTerm(options.hours, count);
    const pace = !per
      ? 'Then you and a partner say every term out loud.'
      : minutes < 1
        ? `Then a partner pass, about ${per} a term. Fast — you’ll see the whole set.`
        : `Then you and a partner say every term out loud. About ${per} each.`;
    return {
      mode,
      subject,
      facts,
      lines: [
        'First, sort each term: blank, shaky, or know it.',
        pace,
        'Misses get a second pass. This sitting covers the set.',
      ],
    };
  }

  if (mode === STUDY_MODE.SPACED_CRAM) {
    return {
      mode,
      subject,
      facts,
      lines: [
        'First, sort each term: blank, shaky, or know it. Then set when you sleep.',
        `Short sittings from now until ${when}. Learn a chunk, then those terms come back. Shaky ones get more time.`,
        `Come back for each sitting. About 10 minutes.${writtenGrade}`,
      ],
    };
  }

  const cap = recallTermCap(options.hours);
  const drill = count ? Math.min(count, cap) : cap;
  const rest = Math.max(0, count - drill);
  const reps = !count
    ? 'The terms most likely to cost you points get full flashcard reps.'
    : rest > 0
      ? `${drill} of ${count} terms get full reps. The other ${rest} are a skim, and those get cut first if you run behind.`
      : `All ${count} terms get full reps.`;
  return {
    mode,
    subject,
    facts,
    lines: [
      'First, sort each term: blank, shaky, or know it.',
      reps,
      typeLabel === 'short answer'
        ? 'The ones that matter most stay until you get them twice. Then a short written test. You grade it yourself.'
        : typeLabel === 'mixed'
          ? 'The ones that matter most stay until you get them twice. Then a short test with both kinds of questions. You grade the written ones yourself.'
          : 'The ones that matter most stay until you get them twice. Then a short multiple-choice test.',
    ],
  };
}

export function suggestStudyMode(options = {}) {
  const hours = options.hours;
  const termCount = options.termCount;
  const examTiming = options.examTiming;
  if (examTiming === 'tomorrow' || examTiming === '2days') return STUDY_MODE.SPACED_CRAM;
  const minutes = minutesPerTerm(hours, termCount);
  if (minutes != null && minutes >= 2) return STUDY_MODE.TRUE_CRAM;
  return STUDY_MODE.ASSISTED;
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

// A redo of the hard terms. Fewer than four is a tiny loop, so ask for more
// when the rest of the set can actually fill it out.
export function redoDeckPlan(shakyIds, allIds, min = 4) {
  const all = [...new Set((allIds || []).filter(Boolean))];
  const shakySet = new Set(shakyIds || []);
  const lockedIds = all.filter((id) => shakySet.has(id));
  const extraIds = all.filter((id) => !shakySet.has(id));
  const target = Math.min(min, all.length);
  const required = Math.max(0, target - lockedIds.length);
  if (required === 0 || extraIds.length <= required) {
    return {
      ask: false,
      required: 0,
      lockedIds,
      extraIds: [],
      startIds: required === 0 ? lockedIds : all,
    };
  }
  return {
    ask: true,
    required,
    lockedIds,
    extraIds,
    startIds: lockedIds,
  };
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