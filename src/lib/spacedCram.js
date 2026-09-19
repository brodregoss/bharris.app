import { priority } from '@/lib/studyUtils';

export function examDeadlineMs(examTiming, now = Date.now()) {
  const d = new Date(now);
  if (examTiming === 'today') {
    d.setHours(23, 59, 0, 0);
    if (d.getTime() <= now) return now + 2 * 60 * 60 * 1000;
    return d.getTime();
  }
  const days = examTiming === '2days' ? 2 : 1;
  d.setDate(d.getDate() + days);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}

export function estimatedSittings(examTiming) {
  if (examTiming === '2days') return 4;
  if (examTiming === 'tomorrow') return 3;
  return 2;
}

// One clean recall retires a card from this sitting. Misses stay in rotation
// and trip the write-your-own-def flow after three misses (same as assisted).
export const SITTING_RETIRE_THRESHOLD = 1;

export function spacedNewCap(termCount, examTiming) {
  const sittings = estimatedSittings(examTiming);
  const n = Number(termCount) || 0;
  const per = sittings ? Math.ceil(n / Math.max(1, sittings)) : 8;
  return Math.max(5, Math.min(15, per || 8));
}

const SITTING_WHEN = {
  today: ['Now', 'Later today'],
  tomorrow: ['Now', 'Later today', 'Tomorrow morning'],
  '2days': ['Now', 'Later today', 'Tomorrow', 'Exam morning'],
};

export function sittingWhenLabel(examTiming, sittingIndex) {
  const labels = SITTING_WHEN[examTiming] || SITTING_WHEN.today;
  return labels[sittingIndex - 1] || `Sitting ${sittingIndex}`;
}

export function examTimingPlanCopy(examTiming) {
  if (examTiming === '2days') return 'over the next two days';
  if (examTiming === 'tomorrow') return 'before tomorrow’s exam';
  return 'before the exam today';
}

function byPriority(a, b) {
  return priority(b) - priority(a);
}

export function forecastSpacedPlan(terms, examTiming) {
  const list = (Array.isArray(terms) ? terms : []).map(ensureSrs);
  const cap = spacedNewCap(list.length, examTiming);
  const ordered = [...list].sort(byPriority);
  const sessions = [];
  for (let start = 0; start < ordered.length; start += cap) {
    sessions.push({
      sitting: sessions.length + 1,
      news: ordered.slice(start, start + cap),
      reviews: ordered.slice(0, start),
    });
  }
  return {
    sessions,
    newCap: cap,
    estimatedSittings: estimatedSittings(examTiming),
  };
}

export function emptySrs() {
  return { introduced: false, dueAt: 0, intervalMs: 0, reps: 0, lastGrade: null };
}

export function ensureSrs(term) {
  if (term?.srs && typeof term.srs === 'object') {
    return {
      ...term,
      srs: { ...emptySrs(), ...term.srs },
    };
  }
  return { ...term, srs: emptySrs() };
}

export function gradeSrs(srs, correct, now, deadline) {
  const prev = srs && typeof srs === 'object' ? srs : emptySrs();
  const remaining = Math.max(20 * 60 * 1000, (deadline || now + 24 * 60 * 60 * 1000) - now);
  if (!correct) {
    const intervalMs = Math.min(8 * 60 * 1000, Math.max(2 * 60 * 1000, remaining / 12));
    return {
      ...prev,
      introduced: true,
      reps: 0,
      lastGrade: 'miss',
      intervalMs,
      dueAt: now + intervalMs,
    };
  }
  const base = 2 * 60 * 60 * 1000;
  const grown = prev.reps > 0 && prev.intervalMs > 0 ? prev.intervalMs * 2 : base;
  const intervalMs = Math.max(20 * 60 * 1000, Math.min(grown, remaining * 0.45));
  return {
    ...prev,
    introduced: true,
    reps: (prev.reps || 0) + 1,
    lastGrade: 'hit',
    intervalMs,
    dueAt: now + intervalMs,
  };
}

export function planSpacedSitting(terms, options = {}) {
  const now = options.now || Date.now();
  const examTiming = options.examTiming;
  const list = (Array.isArray(terms) ? terms : []).map(ensureSrs);
  const due = list
    .filter((t) => t.srs.introduced && (t.srs.dueAt || 0) <= now)
    .sort((a, b) => (a.srs.dueAt || 0) - (b.srs.dueAt || 0) || priority(b) - priority(a));
  const unseen = list.filter((t) => !t.srs.introduced).sort((a, b) => priority(b) - priority(a));
  const cap = spacedNewCap(list.length, examTiming);
  const news = unseen.slice(0, cap);
  return {
    reviews: due,
    news,
    remainingNew: Math.max(0, unseen.length - news.length),
    queue: [...due, ...news],
  };
}

export function countDueReviews(terms, now = Date.now()) {
  return (Array.isArray(terms) ? terms : []).filter(
    (t) => t.srs?.introduced && (t.srs.dueAt || 0) <= now
  ).length;
}

export function countUnseen(terms) {
  return (Array.isArray(terms) ? terms : []).filter((t) => !t.srs?.introduced).length;
}
