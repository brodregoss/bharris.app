import { normalizeExamType, priority } from '@/lib/studyUtils';

export const SITTING_RETIRE_THRESHOLD = 1;

export const SESSION_TYPE = {
  NEW: 'new',
  REV: 'rev',
  REV_PLUS: 'rev_plus',
  FREE: 'free',
};

export const SESSION_TYPE_META = {
  new: {
    label: 'New',
    meaning: 'Learn new terms for the first time (recall-before-flip).',
  },
  rev: {
    label: 'Rev',
    meaning: 'Shuffled quiz of everything learned so far, roughly equal time per term.',
  },
  rev_plus: {
    label: 'Rev+',
    meaning: 'Most of the time on the shaky pile, quick pass on solid terms.',
  },
    free: {
    label: 'Free',
    meaning: 'Think or say the definition first. Typing is optional.',
  },
};

const MIN_MS = 60 * 1000;
const SHORT_GAP_MS = 25 * MIN_MS;
const MEDIUM_GAP_MS = 90 * MIN_MS;
const LONG_GAP_MS = 150 * MIN_MS;
const BED_LEAD_MS = 20 * MIN_MS;
const MORNING_LEAD_MS = 90 * MIN_MS;
const MIN_SEPARATION_MS = 15 * MIN_MS;
const WAKE_BUFFER_MS = 5 * MIN_MS;
const LONG_WAKE_GAP_MS = 3 * 60 * MIN_MS;
const LIGHT_CARDS = 8;
const LAST_LOOK_CARDS = 10;
const CARD_SECONDS = 22;
const MC_TERM_SECONDS = 12;
const MC_DEF_SECONDS = 18;
const MIN_MC_DECK = 8;
const MIN_MC_OPTIONS = 3;
const LARGE_DECK = 50;
const ABSENCE_MS = 12 * 60 * MIN_MS;
const OVERDUE_REBUILD_MS = 30 * MIN_MS;
const LITTLE_TIME_MS = 45 * MIN_MS;
const MAX_SITTING_MINUTES = 10;
const MORNING_LOCKED_CAP = 12;
const CLOCK_KEY = 'lms_spaced_clock';
export const AHEAD_LINE = "Nothing needed here. You're ahead of plan.";
export const WAIT_WHY = 'Your memory needs this gap to stick';
export const START_EARLY_LINE = "Fine to start early. It'll feel easier than it really is.";
export const TEST_FORMAT_LINE = "Added practice in your test's format.";
export const SLIP_LINE = 'Some slipping overnight is normal. This pass is what fixes it.';
export const RECOGNIZED_LINE = 'Recognized, one recall to lock it in';
export const WEB_REMINDER_NOTE = 'Only works while this tab is open';

// Full shapes. generatePlan trims these for deck size, then drops anything
// that would land outside waking hours.
const FULL_TOMORROW = [
  { role: 'start', type: SESSION_TYPE.NEW, dayOffset: 0 },
  { role: 'gap', type: SESSION_TYPE.REV, gap: SHORT_GAP_MS, dayOffset: 0, required: true },
  { role: 'gap', type: SESSION_TYPE.REV_PLUS, gap: MEDIUM_GAP_MS, dayOffset: 0 },
  { role: 'gap', type: SESSION_TYPE.FREE, gap: LONG_GAP_MS, dayOffset: 0 },
  { role: 'before_bed', type: SESSION_TYPE.REV, dayOffset: 0 },
  { role: 'morning', type: SESSION_TYPE.REV_PLUS, shakyOnly: true, fast: true },
];

const FULL_TWO_DAY = [
  { role: 'start', type: SESSION_TYPE.NEW, dayOffset: 0 },
  { role: 'gap', type: SESSION_TYPE.REV, gap: SHORT_GAP_MS, dayOffset: 0, required: true },
  { role: 'gap', type: SESSION_TYPE.REV_PLUS, gap: MEDIUM_GAP_MS, dayOffset: 0 },
  { role: 'before_bed', type: SESSION_TYPE.REV, dayOffset: 0 },
  { role: 'wake', type: SESSION_TYPE.REV_PLUS, dayOffset: 1 },
  { role: 'midday', type: SESSION_TYPE.FREE, shakyOnly: true, dayOffset: 1 },
  { role: 'before_bed', type: SESSION_TYPE.REV, dayOffset: 1 },
  { role: 'morning', type: SESSION_TYPE.REV_PLUS, shakyOnly: true, fast: true },
];

export function emptySrs() {
  return { introduced: false, missCount: 0, solidStreak: 0 };
}

export function emptySpacedState() {
  return {
    sittingIndex: 1,
    chunkIndex: 0,
    subPhase: 'new',
    phase: 'plan',
    queue: [],
    lastFinishedAt: 0,
    nextDueAt: 0,
    stopTime: null,
    wakeTime: null,
    examClock: null,
    examTime: null,
    sittings: null,
    carryIds: [],
    pendingCarry: [],
    coreOnly: false,
    bonusRun: false,
    lastLook: false,
    aheadNote: false,
    welcomeLine: '',
    catchUpKey: '',
    editingTimes: false,
    examOver: false,
    resumeIds: [],
    resumeSitting: 0,
    clearedIds: [],
    shakyBefore: null,
    pendingGrades: {},
  };
}

export function ensureSpaced(spaced) {
  return { ...emptySpacedState(), ...(spaced && typeof spaced === 'object' ? spaced : {}) };
}

export function ensureSrs(term) {
  return ensureSpacedTerm(term);
}

export function ensureSpacedTerm(term) {
  const srs = term?.srs && typeof term.srs === 'object' ? { ...emptySrs(), ...term.srs } : emptySrs();
  return {
    ...term,
    srs,
    pile: term?.pile === 'solid' || term?.pile === 'shaky' ? term.pile : term?.pile || null,
  };
}

function byPriority(a, b) {
  return priority(b) - priority(a);
}

export function chunkSizeFor(hours, termCount) {
  const n = Number(termCount) || 0;
  if (n <= 12) return Math.max(1, n);
  const h = Number(hours);
  if (Number.isFinite(h) && h <= 2) return 6;
  if (Number.isFinite(h) && h <= 4) return 8;
  return 10;
}

export function chunkTerms(terms, size) {
  const list = Array.isArray(terms) ? terms : [];
  const cap = Math.max(1, size || 10);
  const chunks = [];
  for (let i = 0; i < list.length; i += cap) {
    chunks.push(list.slice(i, i + cap));
  }
  if (chunks.length > 1 && chunks[chunks.length - 1].length <= 2) {
    const last = chunks.pop();
    chunks[chunks.length - 1] = [...chunks[chunks.length - 1], ...last];
  }
  return chunks;
}

function parseClock(hhmm, fallbackH, fallbackM) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return {
    h: Number.isFinite(h) ? h : fallbackH,
    m: Number.isFinite(m) ? m : fallbackM,
  };
}

function clockOn(ms, hhmm, fallbackH, fallbackM) {
  const d = new Date(ms);
  const { h, m } = parseClock(hhmm, fallbackH, fallbackM);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function addDays(ms, days) {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function sleepAfter(wakeMs, sleepTime) {
  let sleep = clockOn(wakeMs, sleepTime, 22, 30);
  if (sleep <= wakeMs) sleep = clockOn(addDays(wakeMs, 1), sleepTime, 22, 30);
  return sleep;
}

function wakeOnOrAfter(ms, wakeTime) {
  let wake = clockOn(ms, wakeTime, 7, 0);
  if (wake < ms) wake = clockOn(addDays(ms, 1), wakeTime, 7, 0);
  return wake;
}

function awakeSpan(ms, wakeTime, sleepTime) {
  if (!Number.isFinite(ms)) return null;
  const wakeToday = clockOn(ms, wakeTime, 7, 0);
  const wake = wakeToday <= ms ? wakeToday : clockOn(addDays(ms, -1), wakeTime, 7, 0);
  const sleep = sleepAfter(wake, sleepTime);
  if (ms >= wake && ms < sleep) return { wake, sleep };
  return null;
}

function studyWindows(now, exam, wakeTime, sleepTime, notBefore) {
  const windows = [];
  let cursor = now;
  for (let i = 0; i < 8 && cursor < exam; i += 1) {
    const span = awakeSpan(cursor, wakeTime, sleepTime);
    const wake = span ? span.wake : wakeOnOrAfter(cursor, wakeTime);
    if (wake >= exam) break;
    const sleep = sleepAfter(wake, sleepTime);
    const start = Math.max(wake, now, notBefore);
    const end = Math.min(sleep, exam);
    if (end - start >= 5 * MIN_MS) {
      windows.push({
        wake,
        sleep,
        start,
        end,
        examMorning: exam < sleep,
      });
    }
    const next = wakeOnOrAfter(sleep + 1000, wakeTime);
    if (next <= cursor) break;
    cursor = next;
  }
  return windows;
}

function addRealMs(ms, delta) {
  return ms + delta;
}

function dropRank(spec) {
  if (spec.required) return 99;
  if (spec.role === 'midday') return 1;
  if (spec.role === 'gap' && spec.type === SESSION_TYPE.FREE) return 2;
  if (spec.role === 'gap' && spec.type === SESSION_TYPE.REV_PLUS) return 3;
  if (spec.role === 'gap' && spec.type === SESSION_TYPE.REV) return 4;
  if (spec.role === 'before_bed' && spec.dayOffset === 1) return 5;
  return 99;
}

function targetSittingCount(termCount, nights) {
  const n = Math.max(0, Number(termCount) || 0);
  if (nights >= 2) {
    if (n <= 12) return 4;
    if (n <= 30) return 6;
    if (n <= 49) return 7;
    return 8;
  }
  if (nights <= 0) return 1;
  if (n <= 12) return 3;
  if (n <= 30) return 4;
  if (n <= 49) return 5;
  return 6;
}

function blueprintFor(nights, termCount, anyUnintroduced) {
  if (nights <= 0) {
    return [{
      role: 'morning',
      type: anyUnintroduced ? SESSION_TYPE.NEW : SESSION_TYPE.REV_PLUS,
      shakyOnly: !anyUnintroduced,
      fast: !anyUnintroduced,
    }];
  }
  const full = (nights >= 2 ? FULL_TWO_DAY : FULL_TOMORROW).map((s) => ({ ...s }));
  const target = targetSittingCount(termCount, nights);
  while (full.length > target) {
    let dropAt = -1;
    let best = 99;
    full.forEach((s, i) => {
      const rank = dropRank(s);
      if (rank < best) {
        best = rank;
        dropAt = i;
      }
    });
    if (dropAt < 0 || best >= 99) break;
    full.splice(dropAt, 1);
  }
  if (!anyUnintroduced) {
    const startIdx = full.findIndex((s) => s.role === 'start');
    if (startIdx >= 0) {
      full.splice(startIdx, 1);
      if (full[startIdx]?.role === 'gap') {
        full[startIdx] = { ...full[startIdx], role: 'start' };
      }
    }
  }
  return full;
}

function placeWindow(window, specs, placed, exam) {
  const bedSpec = specs.find((s) => s.role === 'before_bed');
  const bedAt = window.sleep - BED_LEAD_MS;
  const sequential = specs.filter((s) => s.role !== 'before_bed');
  let prev = placed.length ? placed[placed.length - 1].at : null;
  const gapLatest = bedSpec ? Math.min(window.end, bedAt - MIN_SEPARATION_MS) : Math.min(window.end, exam);

  sequential.forEach((spec) => {
    const anchored = spec.role === 'start' || spec.role === 'wake';
    let at;
    if (anchored) at = window.start;
    else if (spec.role === 'midday') at = window.wake + Math.floor((window.sleep - window.wake) / 2);
    else at = addRealMs(prev == null ? window.start : prev, spec.gap || SHORT_GAP_MS);
    if (at < window.start) at = window.start;
    if (!anchored && prev != null && at < prev + MIN_SEPARATION_MS) at = prev + MIN_SEPARATION_MS;
    const latest = anchored ? Math.min(window.end, exam) : gapLatest;
    if (at >= latest || at >= window.sleep || at >= exam) return;
    if (prev != null && at < prev + MIN_SEPARATION_MS) return;
    placed.push({ ...spec, at });
    prev = at;
  });

  if (!bedSpec) return;
  let at = bedAt;
  if (at < window.start) at = window.start;
  if (prev != null && at < prev + MIN_SEPARATION_MS) return;
  if (at >= window.sleep || at >= exam || at > window.end) return;
  placed.push({ ...bedSpec, at });
}

function anchorMorning(examWindow, exam, now) {
  if (!examWindow) return null;
  const wake = examWindow.wake;
  let at = addRealMs(exam, -MORNING_LEAD_MS);
  let shortened = false;
  if (at < wake) {
    at = addRealMs(wake, WAKE_BUFFER_MS);
    shortened = true;
  }
  if (at < examWindow.start) at = examWindow.start;
  if (at < now) at = Math.max(now, examWindow.start);
  if (at >= exam) return null;
  return { at, shortened };
}

function wakeRole(role) {
  return role === 'wake' || role === 'wake_light';
}

function maybeLightWake(placed, examWindow, morningAt, now, exam) {
  if (!examWindow || morningAt == null) return;
  if (morningAt - examWindow.wake <= LONG_WAKE_GAP_MS) return;
  let at = examWindow.wake;
  if (at < examWindow.start) at = examWindow.start;
  if (at < now) at = Math.max(now, examWindow.start);
  if (at >= exam || at >= morningAt || morningAt - at < MIN_SEPARATION_MS) return;
  const stacked = placed.some((s) => {
    if (Math.abs(s.at - at) < MIN_SEPARATION_MS) return true;
    if (s.role === 'morning' && morningAt - at < MIN_SEPARATION_MS) return true;
    return wakeRole(s.role) && s.at >= examWindow.wake && s.at < examWindow.sleep;
  });
  if (stacked) return;
  placed.push({
    role: 'wake_light',
    type: SESSION_TYPE.REV,
    shakyOnly: true,
    fast: true,
    light: true,
    minutes: 3,
    at,
  });
}

function foldShortReview(blueprint, placed) {
  const wanted = blueprint.some((s) => s.required && s.role === 'gap' && s.type === SESSION_TYPE.REV);
  if (!wanted || placed.some((s) => s.required)) return;
  const host = placed.find((s) => s.role === 'before_bed')
    || placed.find((s) => s.role === 'start')
    || placed[0];
  if (host) host.includesShortRev = true;
}

function placeBlueprint({ windows, blueprint, exam, now }) {
  const placed = [];
  const examWindow = [...windows].reverse().find((w) => w.examMorning) || null;
  const morningAnchor = anchorMorning(examWindow, exam, now);
  const morningAt = morningAnchor?.at ?? null;
  const offsets = [...new Set(
    blueprint.filter((s) => s.role !== 'morning').map((s) => s.dayOffset || 0)
  )].sort((a, b) => a - b);

  offsets.forEach((offset) => {
    const window = windows[offset];
    if (!window || window.examMorning) return;
    const specs = blueprint.filter((s) => s.role !== 'morning' && (s.dayOffset || 0) === offset);
    placeWindow(window, specs, placed, exam);
  });

  const morningSpec = blueprint.find((s) => s.role === 'morning');
  if (morningSpec && morningAt != null) {
    placed.push({
      ...morningSpec,
      at: morningAt,
      short: !!morningAnchor.shortened,
      fast: morningSpec.fast || !!morningAnchor.shortened,
      minutes: morningAnchor.shortened ? 3 : morningSpec.minutes,
    });
  }
  maybeLightWake(placed, examWindow, morningAt, now, exam);

  if (!placed.length && windows.length) {
    const last = windows[windows.length - 1];
    const at = Math.min(Math.max(last.start, last.sleep - BED_LEAD_MS), last.end - 5 * MIN_MS);
    const spec = blueprint[0] || { role: 'start', type: SESSION_TYPE.REV };
    if (at >= last.start && at < exam) placed.push({ ...spec, at });
  }
  foldShortReview(blueprint, placed);
  return placed;
}

function calendarDayIndex(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayWord(at, now) {
  const days = Math.round((calendarDayIndex(at) - calendarDayIndex(now)) / (24 * 60 * MIN_MS));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return new Date(at).toLocaleDateString(undefined, { weekday: 'short' });
}

function labelFor(spec, at, now) {
  const clock = formatClock(at);
  const when = `${dayWord(at, now)} · ${clock}`;
  if (spec.role === 'bonus') return `Bonus review · ${when}`;
  if (spec.role === 'focus') return `Focused pass · ${when}`;
  if (spec.role === 'before_bed') return `Before bed · ${when}`;
  if (spec.role === 'wake' || spec.role === 'wake_light') return `On waking · ${when}`;
  if (spec.role === 'morning') return `Test morning · ${when}`;
  if (spec.role === 'midday') return `Midday · ${when}`;
  if (spec.role === 'start' && Math.abs(at - now) <= 2 * MIN_MS) return `Start · ${dayWord(at, now)}`;
  return when;
}

function preferSitting(prev, next) {
  if (next.role === 'morning') return next;
  if (prev.role === 'morning' || next.role === 'wake_light') return prev;
  if (prev.role === 'wake_light') return next;
  return prev;
}

function indexSittings(raw, now) {
  const sorted = raw.filter((s) => Number.isFinite(s.at)).sort((a, b) => a.at - b.at);
  const kept = [];
  sorted.forEach((s) => {
    const prev = kept[kept.length - 1];
    if (prev && s.at < prev.at + MIN_SEPARATION_MS) {
      kept[kept.length - 1] = preferSitting(prev, s);
      return;
    }
    kept.push(s);
  });
  return kept.map((s, i) => ({
    sitting: i + 1,
    timing: labelFor(s, s.at, now),
    type: s.type,
    role: s.role,
    at: s.at,
    shakyOnly: !!s.shakyOnly,
    fast: !!s.fast,
    light: !!s.light,
    short: !!s.short,
    includesShortRev: !!s.includesShortRev,
    includesBonus: !!s.includesBonus,
    includesBonusReview: !!s.includesBonusReview,
    fullRev: !!s.fullRev,
    foldedBed: !!s.foldedBed,
    prioritized: !!s.prioritized,
    minutes: s.light || s.short ? (s.minutes || 3) : undefined,
    done: !!s.done,
  }));
}

function timelineItems(sittings, wakeTime, sleepTime) {
  const items = [];
  sittings.forEach((sitting, i) => {
    if (!Number.isFinite(sitting?.at)) return;
    items.push({ kind: 'sitting', ...sitting });
    const next = sittings[i + 1];
    if (!next || !Number.isFinite(next.at)) return;
    const span = awakeSpan(sitting.at, wakeTime, sleepTime);
    if (!span || next.at >= span.sleep) items.push({ kind: 'sleep', label: 'Sleep' });
  });
  return items;
}

export function estimateSittingMinutes(termCount) {
  const cards = Math.min(Math.max(Number(termCount) || 1, 1), 24);
  return Math.max(3, Math.min(10, Math.round((cards * 22) / 60)));
}

export function foldNoteFor(sittings) {
  const host = (Array.isArray(sittings) ? sittings : []).find((s) => s?.includesShortRev);
  if (!host) return '';
  if (host.role === 'before_bed') return 'The 25-min review is part of the before-bed sitting.';
  return 'The 25-min review is part of the first sitting.';
}

export function summaryLineFor(sittingCount, termCount) {
  const n = Number(sittingCount) || 0;
  if (!n) return 'Plan complete';
  const mins = estimateSittingMinutes(termCount);
  return `${n} sitting${n === 1 ? '' : 's'}, ~${mins} min each`;
}

function whyLineFor(sittings, nights) {
  const list = Array.isArray(sittings) ? sittings : [];
  if (!list.length) return 'Plan complete';
  const twoDay = nights >= 2 || list.some((s) => s.role === 'wake' || s.role === 'midday');
  if (twoDay) {
    return 'Expanding retrieval over two days, with sleep before the highest-stakes reviews.';
  }
  if (list.length === 1) return 'One focused pass with the time you have left.';
  if (!list.some((s) => s.role === 'morning')) {
    return 'Expanding retrieval across the waking hours you have left, with a pass before sleep.';
  }
  return 'Expanding retrieval compressed into today and the morning of the exam — each gap longer than the last.';
}

export function resolveExamTime({ now = Date.now(), examTiming = 'tomorrow', examClock = '09:00' } = {}) {
  const days = examTiming === '2days' ? 2 : 1;
  const when = addDays(now, days);
  const { h, m } = parseClock(examClock, 9, 0);
  const d = new Date(when);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function clockHHMM(value, fallback) {
  const text = String(value || '');
  return /^\d{1,2}:\d{2}$/.test(text) ? text : fallback;
}

function emptyPlan(termCount, exam) {
  return {
    sittings: [],
    items: [],
    summaryLine: 'Plan complete',
    whyLine: 'Plan complete',
    examAt: Number.isFinite(exam) ? exam : 0,
    termCount,
  };
}

export function savedPlanSittings(sittings) {
  if (!Array.isArray(sittings) || !sittings.length) return null;
  if (sittings.some((s) => !s || !Number.isFinite(s.at) || !s.type)) return null;
  return sittings;
}

export function migrateSpacedState(spaced) {
  const base = ensureSpaced(spaced);
  if (!Array.isArray(base.sittings) || !base.sittings.length) return base;
  if (savedPlanSittings(base.sittings)) return base;
  return { ...base, sittings: null };
}

export function migrateStudyTerms(terms) {
  return (Array.isArray(terms) ? terms : []).map((term) => {
    const introduced = term?.srs?.introduced === true;
    const next = ensureSpacedTerm(term);
    if (introduced) next.srs = { ...next.srs, introduced: true };
    return next;
  });
}

export function examClockSet(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ''));
}

export function loadSavedClock() {
  try {
    if (typeof localStorage === 'undefined') return { sleep: '', wake: '' };
    const data = JSON.parse(localStorage.getItem(CLOCK_KEY) || 'null');
    return {
      sleep: examClockSet(data?.sleep) ? data.sleep : '',
      wake: examClockSet(data?.wake) ? data.wake : '',
    };
  } catch {
    return { sleep: '', wake: '' };
  }
}

export function saveSavedClock(sleep, wake) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CLOCK_KEY, JSON.stringify({
      sleep: examClockSet(sleep) ? sleep : '',
      wake: examClockSet(wake) ? wake : '',
    }));
  } catch {
    // Ignore private-mode and quota failures.
  }
}

export function nextSittingName(type) {
  if (type === SESSION_TYPE.NEW) return 'New';
  if (type === SESSION_TYPE.FREE) return 'Free recall';
  return 'Review';
}

function maxSittingCards() {
  return Math.max(1, Math.round((MAX_SITTING_MINUTES * 60) / CARD_SECONDS));
}

function markBonusParts(sittings, { large, bonusCount, coreOnly }) {
  if (!large || !bonusCount || coreOnly) return sittings;
  const next = sittings.map((s) => ({ ...s }));
  const newer = next.find((s) => s.type === SESSION_TYPE.NEW);
  if (newer) newer.includesBonus = true;
  const middles = next.filter((s) => s.type !== SESSION_TYPE.NEW && s.role !== 'morning');
  const hosts = [];
  if (middles.length) hosts.push(middles[middles.length - 1]);
  if (bonusCount > maxSittingCards() && middles.length > 1) hosts.unshift(middles[middles.length - 2]);
  if (!hosts.length && newer) hosts.push(newer);
  hosts.forEach((host, index) => {
    host.includesBonusReview = true;
    host.bonusPart = index;
    host.bonusParts = hosts.length;
  });
  return next;
}

export function currentTime(now = Date.now(), devClock = null) {
  return Number.isFinite(devClock) ? devClock : now;
}

export function generatePlan({
  now = Date.now(),
  sleepTime = '22:30',
  wakeTime = '07:00',
  examTime,
  terms = [],
  lastFinishedAt = 0,
  coreOnly = false,
  testType = 'mixed',
} = {}) {
  const list = migrateStudyTerms(terms);
  const exam = typeof examTime === 'number' ? examTime : Number(examTime);
  const termCount = list.length;
  const when = Number(now);
  const clock = Number.isFinite(when) ? when : Date.now();
  if (!Number.isFinite(exam) || exam <= clock) return emptyPlan(termCount, exam);
  const sleep = clockHHMM(sleepTime, '22:30');
  const wake = clockHHMM(wakeTime, '07:00');
  const finished = Number(lastFinishedAt);
  const notBefore = Number.isFinite(finished) && finished > 0 ? Math.max(clock, addRealMs(finished, SHORT_GAP_MS)) : clock;
  const windows = studyWindows(clock, exam, wake, sleep, notBefore);
  const nights = windows.filter((w) => w.sleep < exam).length;
  const anyUnintroduced = list.some((t) => !t?.srs?.introduced);
  const blueprint = blueprintFor(nights, termCount, anyUnintroduced);
  const placed = placeBlueprint({ windows, blueprint, exam, now: clock });
  const split = splitCorePlan(list);
  const sittings = markBonusParts(indexSittings(placed, clock), {
    large: split.large,
    bonusCount: split.bonusIds.length,
    coreOnly: !!coreOnly,
  });
  return {
    sittings,
    items: timelineItems(sittings, wake, sleep),
    summaryLine: summaryLineFor(sittings.length, termCount),
    whyLine: whyLineFor(sittings, nights),
    foldNote: foldNoteFor(sittings),
    examAt: exam,
    termCount,
    testType: normalizeExamType(testType),
  };
}

function resumeSitting(sittings, sittingIndex) {
  const idx = Number(sittingIndex) || 1;
  return sittings.find((s) => s.sitting === idx && !s.done)
    || sittings.find((s) => !s.done && s.sitting >= idx)
    || sittings.find((s) => !s.done)
    || null;
}

function activityAt(spaced) {
  const finished = Number(spaced?.lastFinishedAt) || 0;
  if (finished > 0) return finished;
  const done = (spaced?.sittings || []).filter((s) => s?.done && Number.isFinite(s.at));
  if (!done.length) return 0;
  return Math.max(...done.map((s) => s.at));
}

function wholeDaySkipped(sittings, now, sleepTime) {
  const list = Array.isArray(sittings) ? sittings : [];
  if (!list.some((s) => s?.role === 'wake' || s?.role === 'midday')) return false;
  const today = calendarDayIndex(now);
  return list.some((s) => {
    if (s?.done || !Number.isFinite(s?.at)) return false;
    if (calendarDayIndex(s.at) >= today) return false;
    return now >= sleepAfter(s.at, sleepTime || '22:30');
  });
}

function bedSkipped(sittings, now, sleepTime) {
  return (Array.isArray(sittings) ? sittings : []).some((s) => {
    if (s?.done || s?.role !== 'before_bed' || !Number.isFinite(s?.at)) return false;
    if (s.at >= now) return false;
    return now >= sleepAfter(s.at, sleepTime || '22:30');
  });
}

function dueAt(spaced) {
  const current = resumeSitting(spaced?.sittings, spaced?.sittingIndex);
  const scheduled = Number(spaced?.nextDueAt) > 0 ? Number(spaced.nextDueAt) : current?.at;
  return Number.isFinite(scheduled) ? scheduled : 0;
}

function longGap(spaced, now) {
  const due = dueAt(spaced);
  if (!due) return false;
  return now - due >= ABSENCE_MS;
}

function overdueForRebuild(spaced, now) {
  const due = dueAt(spaced);
  if (!due) return false;
  return now - due >= OVERDUE_REBUILD_MS;
}

export function welcomeBackLine(remaining) {
  const n = Math.max(0, Number(remaining) || 0);
  const word = n === 1 ? 'sitting' : 'sittings';
  return `Welcome back. Updated your plan: ${n} ${word} left.`;
}

export function mergeKeptSittings(existing, fresh, now = Date.now()) {
  const done = (Array.isArray(existing) ? existing : [])
    .filter((s) => s?.done)
    .map((s) => ({ ...s, done: true }));
  const maxDone = done.reduce((m, s) => Math.max(m, Number(s.sitting) || 0), 0);
  const added = (Array.isArray(fresh) ? fresh : [])
    .filter((s) => Number.isFinite(s?.at))
    .map((s, i) => ({
      ...s,
      sitting: maxDone + i + 1,
      done: false,
      timing: labelFor(s, s.at, now),
    }));
  const sittings = [...done, ...added].sort((a, b) => a.sitting - b.sitting);
  const next = sittings.find((s) => !s.done);
  return {
    sittings,
    sittingIndex: next ? next.sitting : maxDone + 1,
  };
}

function examCompleteState(spaced) {
  return {
    ...spaced,
    phase: 'complete',
    examOver: true,
    welcomeLine: '',
    queue: [],
    aheadNote: false,
    editingTimes: false,
    lastLook: false,
    bonusRun: false,
  };
}

function makeOverdueAvailable(spaced, now) {
  const sittings = savedPlanSittings(spaced.sittings) || spaced.sittings;
  const current = resumeSitting(sittings, spaced.sittingIndex);
  const phase = spaced.phase === 'complete' ? 'plan' : (spaced.phase || 'plan');
  if (!current) {
    return { ...spaced, sittings, phase, examOver: false };
  }
  if (current.at <= now) {
    return { ...spaced, sittings, phase, examOver: false, nextDueAt: 0 };
  }
  return { ...spaced, sittings, phase, examOver: false };
}

function withResume(spaced) {
  if (spaced?.phase !== 'drill' && spaced?.phase !== 'chunk_break') return spaced;
  const cleared = new Set(spaced.clearedIds || []);
  if (!cleared.size) return spaced;
  const source = spaced.resumeIds?.length ? spaced.resumeIds : (spaced.queue || []);
  const left = source.filter((id) => !cleared.has(id));
  return {
    ...spaced,
    queue: left,
    resumeIds: left,
    resumeSitting: spaced.resumeSitting || spaced.sittingIndex || 0,
    resumeLine: left.length ? pickupLine(left.length) : '',
  };
}

export function catchUpPlan(spaced, terms, now = Date.now()) {
  const base = migrateSpacedState(spaced);
  if (!base.stopTime || !base.wakeTime || !base.examTime) return base;
  if (base.phase === 'drill' || base.phase === 'chunk_break') return withResume(base);
  const exam = Number(base.examTime);
  const clock = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  if (!Number.isFinite(exam) || clock >= exam) return examCompleteState(base);

  const existing = savedPlanSittings(base.sittings);
  if (!existing) {
    const plan = generatePlan({
      now: clock,
      sleepTime: base.stopTime,
      wakeTime: base.wakeTime,
      examTime: exam,
      terms,
      coreOnly: !!base.coreOnly,
    });
    const first = plan.sittings[0];
    return {
      ...base,
      sittings: plan.sittings,
      sittingIndex: first ? first.sitting : 1,
      chunkIndex: 0,
      subPhase: 'new',
      queue: [],
      phase: plan.sittings.length ? 'plan' : 'plan',
      examOver: false,
      welcomeLine: '',
      nextDueAt: first && first.at > clock + 15000 ? first.at : 0,
    };
  }

  if (!existing.some((s) => !s.done)) {
    return makeOverdueAvailable({ ...base, examOver: false }, clock);
  }

  const reasons = {
    wholeDay: wholeDaySkipped(existing, clock, base.stopTime),
    bed: bedSkipped(existing, clock, base.stopTime),
    gap: longGap(base, clock),
    overdue: overdueForRebuild(base, clock),
    little: exam - clock <= LITTLE_TIME_MS,
  };
  const triggered = reasons.wholeDay || reasons.bed || reasons.gap || reasons.overdue || reasons.little;
  if (!triggered) return makeOverdueAvailable({ ...base, examOver: false }, clock);

  const key = JSON.stringify({
    ...reasons,
    finished: activityAt(base) || 0,
    due: dueAt(base) || 0,
  });
  if (base.catchUpKey === key) return makeOverdueAvailable(base, clock);

  let fresh = generatePlan({
    now: clock,
    sleepTime: base.stopTime,
    wakeTime: base.wakeTime,
    examTime: exam,
    terms,
    coreOnly: !!base.coreOnly,
  });
  if (reasons.little) {
    const seed = fresh.sittings[fresh.sittings.length - 1] || { at: clock };
    const at = Math.min(Math.max(clock, seed.at || clock), exam - MIN_MS);
    fresh = {
      ...fresh,
      sittings: [{
        ...seed,
        role: 'focus',
        type: SESSION_TYPE.REV,
        prioritized: true,
        shakyOnly: false,
        fullRev: true,
        at: at >= exam ? clock : at,
      }],
    };
  }
  const merged = mergeKeptSittings(existing, fresh.sittings, clock);
  if (reasons.bed) {
    const morning = merged.sittings.find((s) => !s.done && s.role === 'morning')
      || merged.sittings.find((s) => !s.done);
    if (morning) morning.foldedBed = true;
  }
  if (reasons.gap) {
    const next = merged.sittings.find((s) => !s.done);
    if (next) {
      next.fullRev = true;
      if (next.type !== SESSION_TYPE.NEW) next.type = SESSION_TYPE.REV;
      next.shakyOnly = false;
    }
  }
  const remaining = merged.sittings.filter((s) => !s.done).length;
  const next = merged.sittings.find((s) => !s.done);
  const resumeStill = base.resumeIds?.length
    && merged.sittings.some((s) => s.sitting === base.resumeSitting && !s.done);
  return {
    ...base,
    sittings: merged.sittings,
    sittingIndex: merged.sittingIndex,
    resumeIds: resumeStill ? base.resumeIds : [],
    resumeSitting: resumeStill ? base.resumeSitting : 0,
    chunkIndex: 0,
    subPhase: 'new',
    queue: [],
    phase: 'plan',
    examOver: false,
    welcomeLine: welcomeBackLine(remaining),
    catchUpKey: key,
    aheadNote: false,
    nextDueAt: next && next.at > clock + 15000 ? next.at : 0,
  };
}

export function changePlanTimes(spaced, terms, {
  sleepTime,
  wakeTime,
  examTime,
  examClock,
  now = Date.now(),
} = {}) {
  const base = ensureSpaced(spaced);
  const plan = generatePlan({
    now,
    sleepTime,
    wakeTime,
    examTime,
    terms,
    coreOnly: !!base.coreOnly,
  });
  const merged = mergeKeptSittings(base.sittings, plan.sittings, now);
  const next = merged.sittings.find((s) => !s.done);
  return {
    ...base,
    stopTime: sleepTime,
    wakeTime: wakeTime,
    examTime,
    examClock: examClock || base.examClock || null,
    sittings: merged.sittings,
    sittingIndex: merged.sittingIndex,
    phase: 'plan',
    examOver: false,
    welcomeLine: '',
    catchUpKey: '',
    editingTimes: false,
    queue: [],
    nextDueAt: next && next.at > now + 15000 ? next.at : 0,
  };
}

export function openSpacedSession(spaced, terms, now = Date.now()) {
  const base = migrateSpacedState(spaced);
  if (!base.stopTime || !base.wakeTime || !base.examTime) return base;
  if (base.phase === 'drill' || base.phase === 'chunk_break') return withResume(base);
  return catchUpPlan(base, terms, now);
}

export function sittingDetail(sitting, schedule) {
  if (!sitting) return '';
  if (sitting.type === SESSION_TYPE.NEW) {
    const chunkN = schedule?.chunks?.length || 1;
    if (chunkN > 1) {
      return `${chunkN} chunks of about ${schedule.chunkSize}. Learn each chunk recall-before-flip, then a mixed review of what you’ve got so far.`;
    }
    return 'Go through every term recall-before-flip until you get each one right once. This first pass is slow; that’s normal.';
  }
  if (sitting.type === SESSION_TYPE.REV) {
    if (sitting.light) return 'A short pass on whatever is still shaky. About 3 minutes.';
    if (sitting.short) return 'A shorter pass. You wake close to the exam, so this one stays brief.';
    return sitting.role === 'before_bed'
      ? 'One more full pass through everything learned so far, then sleep. That overnight gap is the highest-value rep.'
      : 'Shuffled quiz of everything learned so far. Misses go back into rotation.';
  }
  if (sitting.type === SESSION_TYPE.REV_PLUS) {
    if (sitting.shakyOnly) {
      return 'Fast pass. Almost all time on whatever is still shaky — solid terms only need a glance.';
    }
    return 'About 70–80% of time on the shaky pile, 2–3× the reps of solid terms. Mix in reversed cards (definition → term).';
  }
  return 'Write each definition from memory with no prompt but the term. Harder than flipping a card, and that’s the point.';
}

export function buildSpacedSchedule({
  examTiming,
  hours,
  terms,
  now,
  sleepTime,
  wakeTime,
  examTime,
  lastFinishedAt,
  sittings,
  coreOnly = false,
  testType = 'mixed',
} = {}) {
  const list = migrateStudyTerms(terms).sort(byPriority);
  const split = splitCorePlan(list);
  const kept = savedPlanSittings(sittings);
  const plan = kept
    ? {
        sittings,
        items: timelineItems(sittings, wakeTime || '07:00', sleepTime || '22:30'),
        summaryLine: summaryLineFor(sittings.length, list.length),
        whyLine: whyLineFor(sittings),
        foldNote: foldNoteFor(sittings),
        testType: normalizeExamType(testType),
      }
    : generatePlan({
        now: now || Date.now(),
        sleepTime: sleepTime || '22:30',
        wakeTime: wakeTime || '07:00',
        examTime,
        terms: list,
        lastFinishedAt,
        coreOnly: !!coreOnly,
        testType,
      });
  const coreList = split.large ? list.filter((t) => split.coreIds.includes(t.id)) : list;
  const bonusList = split.large && !coreOnly
    ? list.filter((t) => split.bonusIds.includes(t.id))
    : [];
  const unseen = [
    ...coreList.filter((t) => !t.srs?.introduced),
    ...bonusList.filter((t) => !t.srs?.introduced),
  ];
  const chunkSource = unseen.length ? unseen : coreList;
  const chunkSize = chunkSizeFor(hours, chunkSource.length);
  const rawChunks = chunkTerms(chunkSource, chunkSize);
  return {
    examTiming,
    hours: Number(hours) || 0,
    termCount: list.length,
    chunkSize,
    chunks: rawChunks.map((chunkTermsList, index) => ({ index, terms: chunkTermsList })),
    sittings: plan.sittings,
    items: plan.items,
    summaryLine: plan.summaryLine,
    whyLine: plan.whyLine,
    foldNote: plan.foldNote || '',
    testType: normalizeExamType(testType),
    large: split.large,
    coreIds: split.coreIds,
    bonusIds: split.bonusIds,
    coreCount: split.coreIds.length,
    bonusCount: split.bonusIds.length,
  };
}

export function sittingByIndex(schedule, sittingIndex) {
  return (schedule?.sittings || []).find((s) => s.sitting === sittingIndex) || null;
}

export function lastSittingIndex(schedule) {
  const sittings = schedule?.sittings || [];
  return sittings.length ? sittings[sittings.length - 1].sitting : 1;
}

export function formatClock(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

export function nextDueAfterSitting(sitting, { sittings } = {}) {
  const list = Array.isArray(sittings) ? sittings : [];
  const idx = list.findIndex((s) => s.sitting === sitting?.sitting);
  const next = idx >= 0 ? list[idx + 1] : null;
  return next?.at || 0;
}

export function sittingIsReady(spaced, now = Date.now()) {
  const nextDueAt = Number(spaced?.nextDueAt) || 0;
  if (!nextDueAt) return true;
  return nextDueAt <= now;
}

export function nextSittingWaitCopy(nextDueAt, now = Date.now()) {
  const due = Number(nextDueAt) || 0;
  if (!due || due <= now) return null;
  const diff = due - now;
  if (diff < 90 * 60 * 1000) {
    const mins = Math.max(1, Math.round(diff / 60000));
    return `Come back in ~${mins} min`;
  }
  return `Come back at ${formatClock(due)}`;
}

export function spacedContinueLabel(spaced, now = Date.now()) {
  if (spaced?.phase === 'complete') return 'Plan complete';
  if (sittingIsReady(spaced, now)) return 'Next sitting ready';
  const due = Number(spaced?.nextDueAt) || 0;
  return due ? `Come back at ${formatClock(due)}` : 'Continue session';
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function termPile(term) {
  if (term?.pile === 'solid' || term?.pile === 'shaky') return term.pile;
  return 'shaky';
}

function introducedTerms(terms) {
  return (Array.isArray(terms) ? terms : []).filter((t) => t?.srs?.introduced);
}

function timeMinutes(hours, sitting) {
  if (sitting?.light || sitting?.short) return 3;
  const h = Number(hours);
  if (Number.isFinite(h) && h <= 2) return 6;
  if (Number.isFinite(h) && h <= 4) return 8;
  return 10;
}

function queueCap(hours, sitting) {
  if (sitting?.light || sitting?.short) return LIGHT_CARDS;
  return Math.max(1, Math.round((timeMinutes(hours, sitting) * 60) / CARD_SECONDS));
}

function finishList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'number') return { at: item, afterSleep: false };
    return { at: Number(item?.at), afterSleep: !!item?.afterSleep };
  }).filter((item) => Number.isFinite(item.at));
}

export function crossedSleep(prevAt, at, wakeTime, sleepTime) {
  if (!Number.isFinite(prevAt) || !Number.isFinite(at) || at <= prevAt) return false;
  const prev = awakeSpan(prevAt, wakeTime || '07:00', sleepTime || '22:30');
  const next = awakeSpan(at, wakeTime || '07:00', sleepTime || '22:30');
  if (prev && next) return next.wake > prev.wake;
  return false;
}

export function termIsLocked(term) {
  const finishes = finishList(term?.srs?.solidFinishes);
  if (finishes.length < 2) return false;
  const a = finishes[finishes.length - 2];
  const b = finishes[finishes.length - 1];
  if (b.at - a.at >= MEDIUM_GAP_MS) return true;
  return !!(a.afterSleep || b.afterSleep);
}

function isLocked(term) {
  return termIsLocked(term);
}

export function shouldAutoComplete(sitting, queueLength) {
  return isMiddleSitting(sitting) && !sitting?.done && !(Number(queueLength) > 0);
}

export function lastLookQueue(terms) {
  const list = Array.isArray(terms) ? terms : [];
  const introduced = introducedTerms(list);
  const pool = introduced.length ? introduced : list;
  return sortReview(pool.filter((t) => termPile(t) === 'shaky')).slice(0, LAST_LOOK_CARDS);
}

export function isMiddleSitting(sitting) {
  if (!sitting || sitting.role === 'morning' || sitting.type === SESSION_TYPE.NEW) return false;
  return true;
}

export function skipLockedLine(count) {
  const n = Number(count) || 0;
  if (n <= 0) return '';
  return `Skipping ${n} term${n === 1 ? '' : 's'} you've already locked in.`;
}

export function splitCorePlan(terms) {
  const ranked = migrateStudyTerms(terms).sort(byPriority);
  if (ranked.length < LARGE_DECK) {
    return { large: false, coreIds: ranked.map((t) => t.id), bonusIds: [] };
  }
  const cap = Math.max(1, Math.round((10 * 60) / CARD_SECONDS));
  const chosen = new Set(ranked.slice(0, cap).map((t) => t.id));
  ranked.forEach((t) => {
    if (t.tier === 'critical') chosen.add(t.id);
  });
  return {
    large: true,
    coreIds: ranked.filter((t) => chosen.has(t.id)).map((t) => t.id),
    bonusIds: ranked.filter((t) => !chosen.has(t.id)).map((t) => t.id),
  };
}

function lockStamp(term) {
  const finishes = finishList(term?.srs?.solidFinishes);
  if (!finishes.length) return Number.POSITIVE_INFINITY;
  return Math.min(...finishes.map((f) => Number(f.at) || 0));
}

function byWeakLock(a, b) {
  const streakA = Number(a?.srs?.solidStreak) || 0;
  const streakB = Number(b?.srs?.solidStreak) || 0;
  if (streakA !== streakB) return streakA - streakB;
  return lockStamp(a) - lockStamp(b);
}

function sortReview(list) {
  return [...list].sort((a, b) => {
    const shakyA = termPile(a) === 'shaky' ? 0 : 1;
    const shakyB = termPile(b) === 'shaky' ? 0 : 1;
    if (shakyA !== shakyB) return shakyA - shakyB;
    const streakA = Number(a?.srs?.solidStreak) || 0;
    const streakB = Number(b?.srs?.solidStreak) || 0;
    if (streakA !== streakB) return streakA - streakB;
    return byPriority(a, b);
  });
}

function applyCarry(ordered, carryIds) {
  const carry = new Set(Array.isArray(carryIds) ? carryIds : []);
  if (!carry.size) return ordered;
  const front = [];
  const back = [];
  ordered.forEach((t) => (carry.has(t.id) ? front : back).push(t));
  return [...front, ...back];
}

function candidatePool(terms, sitting, options = {}) {
  const list = Array.isArray(terms) ? terms : [];
  const introduced = introducedTerms(list);
  const pool = introduced.length ? introduced : list;
  if (sitting?.role === 'bonus' || options.bonus) {
    const ids = new Set(options.bonusIds || []);
    return list.filter((t) => ids.has(t.id));
  }
  if (options.large && Array.isArray(options.coreIds) && options.coreIds.length) {
    const ids = new Set(options.coreIds);
    const core = pool.filter((t) => ids.has(t.id));
    return core.length ? core : list.filter((t) => ids.has(t.id));
  }
  return pool;
}

function emptyQueue() {
  return { queue: [], leftoverIds: [], skipCount: 0, skipLine: '' };
}

function bonusReviewTerms(terms, options) {
  if (!options?.bonusIds?.length || options.coreOnly) return [];
  const ids = new Set(options.bonusIds);
  return sortReview((Array.isArray(terms) ? terms : []).filter((t) => ids.has(t.id)));
}

function bonusOwned(all, sitting) {
  const size = maxSittingCards();
  const part = Number(sitting?.bonusPart) || 0;
  const parts = Math.max(1, Number(sitting?.bonusParts) || 1);
  if (part < parts - 1) return all.slice(part * size, (part + 1) * size);
  return all.slice(part * size);
}

function finishQueue(working, cap, sitting, terms, options, coreLeftover = []) {
  let owned = [];
  let queue = working;
  if (sitting?.includesBonusReview) {
    owned = bonusOwned(bonusReviewTerms(terms, options), sitting);
    const seen = new Set(owned.map((t) => t.id));
    queue = [...owned, ...working.filter((t) => !seen.has(t.id))];
  }
  queue = queue.slice(0, cap);
  const shown = new Set(queue.map((t) => t.id));
  const extra = owned.filter((t) => !shown.has(t.id)).map((t) => t.id);
  const leftoverIds = [
    ...extra,
    ...coreLeftover.filter((id) => !shown.has(id) && !extra.includes(id)),
  ];
  return { queue, leftoverIds };
}

function includeCarry(pool, terms, carryIds) {
  const carry = new Set(Array.isArray(carryIds) ? carryIds : []);
  if (!carry.size) return pool;
  const have = new Set(pool.map((t) => t.id));
  const extras = (Array.isArray(terms) ? terms : []).filter((t) => carry.has(t.id) && !have.has(t.id));
  return extras.length ? [...extras, ...pool] : pool;
}

export function describeReviewQueue(terms, sitting, hours, options = {}) {
  const pool = includeCarry(
    sitting?.prioritized
      ? sortReview(Array.isArray(terms) ? terms : [])
      : candidatePool(terms, sitting, options),
    terms,
    options.carryIds
  );
  if (!pool.length && !sitting?.includesBonusReview) return emptyQueue();
  const ignoreThin = !!(sitting?.fullRev || sitting?.prioritized || sitting?.foldedBed);
  const middle = isMiddleSitting(sitting);
  const skipped = middle && !ignoreThin ? pool.filter(isLocked) : [];
  const cap = queueCap(hours, sitting);

  if (sitting?.foldedBed) {
    const shaky = sortReview(pool.filter((t) => termPile(t) === 'shaky'));
    const rest = sortReview(pool.filter((t) => termPile(t) !== 'shaky'));
    const shakyTake = shaky.slice(0, cap);
    const sweep = rest.slice(0, LIGHT_CARDS);
    return {
      queue: [...shakyTake, ...sweep],
      leftoverIds: shaky.slice(shakyTake.length).map((t) => t.id),
      skipCount: 0,
      skipLine: '',
    };
  }

  if (sitting?.role === 'morning') {
    const shaky = sortReview(pool.filter((t) => termPile(t) === 'shaky'));
    const shakyIds = new Set(shaky.map((t) => t.id));
    const lockedRanked = pool
      .filter((t) => isLocked(t) && !shakyIds.has(t.id))
      .sort(byWeakLock);
    const lockedTake = lockedRanked.slice(0, MORNING_LOCKED_CAP);
    const others = applyCarry(
      sortReview(pool.filter((t) => !shakyIds.has(t.id) && !isLocked(t))),
      options.carryIds
    );
    const room = Math.max(0, cap - shaky.length - lockedTake.length);
    const taken = others.slice(0, room);
    let queue = [...shaky, ...lockedTake, ...taken];
    const coreLeft = [
      ...lockedRanked.slice(lockedTake.length).map((t) => t.id),
      ...others.slice(taken.length).map((t) => t.id),
    ];
    if (!sitting.includesBonusReview) {
      return { queue, leftoverIds: coreLeft, skipCount: 0, skipLine: '' };
    }
    const owned = bonusOwned(bonusReviewTerms(terms, options), sitting);
    const bonusRoom = Math.max(0, maxSittingCards() - queue.length);
    const bonusTake = owned.slice(0, bonusRoom);
    const seen = new Set(bonusTake.map((t) => t.id));
    queue = [...bonusTake, ...queue.filter((t) => !seen.has(t.id))];
    const shown = new Set(queue.map((t) => t.id));
    const extra = owned.filter((t) => !shown.has(t.id)).map((t) => t.id);
    return {
      queue,
      leftoverIds: [...extra, ...coreLeft.filter((id) => !shown.has(id) && !extra.includes(id))],
      skipCount: 0,
      skipLine: '',
    };
  }

  let working = ignoreThin ? pool.slice() : pool.filter((t) => !isLocked(t));
  if (!ignoreThin && (sitting?.light || sitting?.short || sitting?.shakyOnly)) {
    const shaky = working.filter((t) => termPile(t) === 'shaky');
    if (shaky.length) working = shaky;
  }
  working = applyCarry(sortReview(working), options.carryIds);
  const built = finishQueue(working, cap, sitting, terms, options, working.map((t) => t.id));
  return {
    queue: built.queue,
    leftoverIds: built.leftoverIds.filter((id) => !built.queue.some((t) => t.id === id)),
    skipCount: skipped.length,
    skipLine: skipLockedLine(skipped.length),
  };
}

export function buildReviewQueue(terms, sitting, hours, options) {
  return describeReviewQueue(terms, sitting, hours, options).queue;
}

export function newChunkTerms(schedule, chunkIndex) {
  return schedule?.chunks?.[chunkIndex]?.terms || [];
}

export function learnedChunkTerms(schedule, throughIndex) {
  const chunks = schedule?.chunks || [];
  const out = [];
  for (let i = 0; i <= throughIndex && i < chunks.length; i += 1) {
    out.push(...(chunks[i].terms || []));
  }
  return out;
}

export function freeRecallRatio(testType) {
  const type = normalizeExamType(testType);
  if (type === 'short_answer') return 0.3;
  if (type === 'mixed') return 0.2;
  return 0;
}

export function freeRecallCount(length, testType) {
  const cards = Math.max(0, Number(length) || 0);
  if (!cards) return 0;
  const type = normalizeExamType(testType);
  let count = Math.round(cards * freeRecallRatio(type));
  if (type === 'short_answer' && cards >= 5) count = Math.max(count, 2);
  return Math.min(cards, count);
}

export function firstReviewSittingId(sittings) {
  const list = (Array.isArray(sittings) ? sittings : [])
    .filter((s) => s && s.type !== SESSION_TYPE.NEW)
    .sort((a, b) => (Number(a.sitting) || 0) - (Number(b.sitting) || 0));
  return list[0]?.sitting ?? null;
}

function emptyModeIds() {
  return { freeIds: [], mcIds: [], mcTermIds: [], mcDefIds: [] };
}

function mcEvidenceRank(a, b) {
  return (Number(a?.srs?.solidStreak) || 0) - (Number(b?.srs?.solidStreak) || 0);
}

export function mixHostIds(sittings) {
  const list = Array.isArray(sittings) ? sittings : [];
  const morning = [...list].reverse().find((s) => s?.role === 'morning');
  const morningDay = morning && Number.isFinite(morning.at) ? calendarDayIndex(morning.at) : null;
  const ids = [];
  const lastBed = [...list].reverse().find((s) => s?.role === 'before_bed');
  if (lastBed) ids.push(lastBed.sitting);
  list.forEach((s) => {
    if (!s || s.role === 'morning' || s.type === SESSION_TYPE.NEW) return;
    if (s.sitting === lastBed?.sitting) return;
    const examMorning = morningDay != null && Number.isFinite(s.at) && calendarDayIndex(s.at) === morningDay;
    if ((s.role === 'wake' || s.role === 'wake_light') && examMorning) ids.push(s.sitting);
  });
  return ids;
}

export function cardModeIds(queue, sitting, testType, sittings, deckCount = 0, deck = null) {
  const cards = Array.isArray(queue) ? queue : [];
  if (!cards.length || !sitting) return emptyModeIds();
  if (sitting.role === 'morning' || sitting.type === SESSION_TYPE.NEW) return emptyModeIds();
  if (sitting.type === SESSION_TYPE.FREE) {
    return { freeIds: cards.map((t) => t.id), mcIds: [], mcTermIds: [], mcDefIds: [] };
  }
  const type = normalizeExamType(testType);
  const ids = cards.map((t) => t.id);
  if (type === 'short_answer') {
    if (!mixHostIds(sittings).includes(sitting.sitting)) return emptyModeIds();
    const count = freeRecallCount(cards.length, type);
    return { freeIds: ids.slice(ids.length - count), mcIds: [], mcTermIds: [], mcDefIds: [] };
  }
  if (sitting.sitting === firstReviewSittingId(sittings)) return emptyModeIds();
  const freeCount = type === 'mixed' ? freeRecallCount(cards.length, type) : 0;
  const freeIds = ids.slice(ids.length - freeCount);
  const freeSet = new Set(freeIds);
  const deckSize = Number(deckCount) || 0;
  if (deckSize < MIN_MC_DECK) return { freeIds, mcIds: [], mcTermIds: [], mcDefIds: [] };
  const pool = Array.isArray(deck) && deck.length ? deck : cards;
  const share = type === 'mcq' ? 0.4 : 0.2;
  const target = Math.round(cards.length * share);
  const eligible = cards
    .filter((t) => t?.srs?.introduced && !freeSet.has(t.id) && !termIsLocked(t) && termPile(t) !== 'solid')
    .slice()
    .sort(mcEvidenceRank);
  const chosen = [];
  eligible.forEach((t) => {
    if (chosen.length >= target) return;
    const preferred = chosen.length % 2 === 0 ? 'term' : 'def';
    const built = buildMcCard(pool, t, preferred) || buildMcCard(pool, t, preferred === 'term' ? 'def' : 'term');
    if (!built) return;
    chosen.push({ id: t.id, direction: built.direction });
  });
  return {
    freeIds,
    mcIds: chosen.map((c) => c.id),
    mcTermIds: chosen.filter((c) => c.direction === 'term').map((c) => c.id),
    mcDefIds: chosen.filter((c) => c.direction === 'def').map((c) => c.id),
  };
}

export function freeRecallIds(queue, sitting, testType, sittings, deckCount) {
  return cardModeIds(queue, sitting, testType, sittings, deckCount).freeIds;
}

function termText(value) {
  return String(value || '').trim().toLowerCase();
}

function termSimilarity(a, b) {
  const left = termText(a);
  const right = termText(b);
  let i = 0;
  while (i < left.length && i < right.length && left[i] === right[i]) i += 1;
  return i;
}

export function pickMcDistractors(deck, correct, n = 3, direction = 'term') {
  const field = direction === 'def' ? 'definition' : 'term';
  const correctOption = termText(correct?.[field]);
  const correctTerm = termText(correct?.term);
  const correctDef = termText(correct?.definition);
  if (!correctOption) return [];
  const deps = new Set(correct?.depends_on || []);
  const ranked = (Array.isArray(deck) ? deck : []).filter((t) => {
    if (!t || t.id === correct?.id) return false;
    const option = termText(t[field]);
    const term = termText(t.term);
    const def = termText(t.definition);
    if (!option || option === correctOption) return false;
    if (term && term === correctTerm) return false;
    if (correctDef && def === correctDef) return false;
    return true;
  }).sort((a, b) => {
    const score = (t) => {
      let s = 0;
      if (correct?.tier && t.tier === correct.tier) s += 4;
      if (correct?.category && t.category && t.category === correct.category) s += 4;
      if ((t.depends_on || []).some((d) => deps.has(d))) s += 3;
      s += Math.min(3, termSimilarity(correct?.term, t.term));
      return s;
    };
    return score(b) - score(a) || termText(a.term).localeCompare(termText(b.term));
  });
  const seen = new Set([correctOption]);
  const out = [];
  ranked.forEach((t) => {
    if (out.length >= n) return;
    const key = termText(t[field]);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(String(t[field]).trim());
  });
  return out;
}

export function buildMcCard(deck, correct, direction = 'term') {
  const field = direction === 'def' ? 'definition' : 'term';
  const answer = String(correct?.[field] || '').trim();
  if (!answer) return null;
  const distractors = pickMcDistractors(deck, correct, 3, direction);
  const options = [answer, ...distractors];
  if (options.length < MIN_MC_OPTIONS) return null;
  return { direction: direction === 'def' ? 'def' : 'term', answer, options };
}

export function interleaveMc(ids, mcIds) {
  const wanted = new Set(mcIds || []);
  const flash = [];
  const choice = [];
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    if (wanted.has(id)) choice.push(id);
    else flash.push(id);
  });
  if (!choice.length) return [...(Array.isArray(ids) ? ids : [])];
  if (!flash.length) return choice;
  const total = flash.length + choice.length;
  const stride = total / choice.length;
  const out = new Array(total);
  const used = new Set();
  choice.forEach((id, i) => {
    let at = Math.min(total - 1, Math.round((i + 0.5) * stride));
    while (used.has(at) && at > 0) at -= 1;
    while (used.has(at) && at < total) at += 1;
    out[at] = id;
    used.add(at);
  });
  let fi = 0;
  for (let i = 0; i < total; i += 1) {
    if (!out[i]) out[i] = flash[fi++];
  }
  return out;
}

export function orderSittingQueue(ids, { freeIds = [], mcIds = [] } = {}) {
  const free = new Set(freeIds || []);
  const list = Array.isArray(ids) ? ids : [];
  const freeOrder = list.filter((id) => free.has(id));
  const drill = list.filter((id) => !free.has(id));
  return [...interleaveMc(drill, mcIds), ...freeOrder];
}

function withModeIds(built, sitting, spaced, schedule, terms) {
  const queue = built?.queue || [];
  const deckCount = Number(schedule?.termCount) || (Array.isArray(terms) ? terms.length : 0);
  if (spaced?.resumeIds?.length && sitting && (!spaced.resumeSitting || sitting.sitting === spaced.resumeSitting)) {
    const ids = new Set(queue.map((t) => t.id));
    return {
      ...built,
      freeIds: (spaced.freeIds || []).filter((id) => ids.has(id)),
      mcIds: (spaced.mcIds || []).filter((id) => ids.has(id)),
      mcTermIds: (spaced.mcTermIds || []).filter((id) => ids.has(id)),
      mcDefIds: (spaced.mcDefIds || []).filter((id) => ids.has(id)),
    };
  }
  return {
    ...built,
    ...cardModeIds(queue, sitting, schedule?.testType, schedule?.sittings, deckCount, terms),
  };
}

function queueOptions(terms, spaced, schedule) {
  const split = Array.isArray(schedule?.coreIds)
    ? { large: !!schedule.large, coreIds: schedule.coreIds, bonusIds: schedule.bonusIds || [] }
    : splitCorePlan(terms);
  return {
    large: split.large,
    coreIds: split.coreIds,
    bonusIds: split.bonusIds,
    carryIds: spaced?.carryIds,
    bonus: !!spaced?.bonusRun,
    coreOnly: !!spaced?.coreOnly,
  };
}

function buildSittingQueue(terms, spaced, schedule) {
  if (spaced?.lastLook) {
    return { queue: lastLookQueue(terms), leftoverIds: [], skipCount: 0, skipLine: '' };
  }
  if (spaced?.bonusRun) {
    return describeReviewQueue(
      terms,
      { role: 'bonus', type: SESSION_TYPE.REV },
      schedule?.hours,
      queueOptions(terms, spaced, schedule)
    );
  }
  const sitting = sittingByIndex(schedule, spaced?.sittingIndex || 1);
  if (!sitting || sitting.done) return emptyQueue();
  if (spaced?.resumeIds?.length && (!spaced.resumeSitting || sitting.sitting === spaced.resumeSitting)) {
    const byId = new Map((Array.isArray(terms) ? terms : []).map((t) => [t.id, t]));
    const queue = spaced.resumeIds.map((id) => byId.get(id)).filter(Boolean);
    return {
      queue,
      leftoverIds: Array.isArray(spaced.pendingCarry) ? spaced.pendingCarry : [],
      skipCount: 0,
      skipLine: '',
    };
  }
  if (sitting.type === SESSION_TYPE.NEW) {
    let queue = [];
    if (spaced?.subPhase === 'mini_rev') {
      const learned = learnedChunkTerms(schedule, spaced.chunkIndex || 0);
      const ids = new Set(learned.map((t) => t.id));
      queue = shuffle((Array.isArray(terms) ? terms : []).filter((t) => ids.has(t.id)));
    } else {
      const chunk = newChunkTerms(schedule, spaced.chunkIndex || 0);
      const ids = new Set(chunk.map((t) => t.id));
      queue = (Array.isArray(terms) ? terms : []).filter((t) => ids.has(t.id));
    }
    return { queue, leftoverIds: [], skipCount: 0, skipLine: '' };
  }
  return describeReviewQueue(terms, sitting, schedule?.hours, queueOptions(terms, spaced, schedule));
}

export function describeSittingQueue(terms, spaced, schedule) {
  const built = buildSittingQueue(terms, spaced, schedule);
  if (spaced?.lastLook || spaced?.bonusRun) return { ...built, freeIds: [], mcIds: [] };
  const sitting = sittingByIndex(schedule, spaced?.sittingIndex || 1);
  return withModeIds(built, sitting, spaced, schedule, terms);
}

export function planSittingQueue(terms, spaced, schedule) {
  return describeSittingQueue(terms, spaced, schedule).queue;
}

export function markTermsIntroduced(terms, ids) {
  const set = ids instanceof Set ? ids : new Set(ids || []);
  return (Array.isArray(terms) ? terms : []).map((t) =>
    set.has(t.id) ? { ...t, srs: { ...emptySrs(), ...t.srs, introduced: true } } : t
  );
}

export function sittingEndedShaky({ missCount = 0, lastGrade } = {}) {
  return (Number(missCount) || 0) >= 2 || lastGrade === 'miss';
}

export function recordAttempt(bucket, id, result, mode = 'flash') {
  const prev = (bucket && bucket[id]) || { missCount: 0, lastGrade: null, mode: 'flash' };
  const miss = result !== 'got_it';
  const nextMode = mode === 'free' || mode === 'mc' ? mode : 'flash';
  const next = {
    missCount: (Number(prev.missCount) || 0) + (miss ? 1 : 0),
    lastGrade: miss ? 'miss' : (nextMode === 'mc' ? 'partial' : 'hit'),
    mode: nextMode,
  };
  if (bucket) bucket[id] = next;
  return next;
}

function attemptFrom(value) {
  if (value && typeof value === 'object') {
    const mode = value.mode === 'free' || value.mode === 'mc' ? value.mode : 'flash';
    let lastGrade = 'miss';
    if (value.lastGrade === 'hit') lastGrade = 'hit';
    else if (value.lastGrade === 'partial') lastGrade = 'partial';
    return {
      missCount: Number(value.missCount) || 0,
      lastGrade,
      mode,
    };
  }
  return value === 'got_it'
    ? { missCount: 0, lastGrade: 'hit', mode: 'flash' }
    : { missCount: 1, lastGrade: 'miss', mode: 'flash' };
}

export function mergeAttemptGrades(terms, results) {
  const map = results && typeof results === 'object' ? results : {};
  return (Array.isArray(terms) ? terms : []).map((t) => {
    const attempt = map[t.id];
    if (attempt == null) return t;
    const { missCount, lastGrade, mode } = attemptFrom(attempt);
    return {
      ...t,
      seen: true,
      srs: { ...emptySrs(), ...t.srs, missCount, lastGrade, lastMode: mode },
    };
  });
}

export function applyLastLookResults(terms, results) {
  const map = results && typeof results === 'object' ? results : {};
  return (Array.isArray(terms) ? terms : []).map((t) => {
    const attempt = map[t.id];
    if (attempt == null) return t;
    const { lastGrade, mode } = attemptFrom(attempt);
    return {
      ...t,
      seen: true,
      pile: lastGrade === 'miss' ? 'shaky' : t.pile,
      srs: {
        ...emptySrs(),
        ...t.srs,
        lastGrade,
        lastMode: mode,
      },
    };
  });
}

export function unclearedIds(queue, results) {
  return (Array.isArray(queue) ? queue : []).filter((id) => {
    const attempt = results?.[id];
    if (!attempt) return true;
    const grade = attemptFrom(attempt);
    return grade.lastGrade !== 'hit' && grade.lastGrade !== 'partial';
  });
}

export function pickupLine(left) {
  return `Picking up where you left off (${Math.max(0, Number(left) || 0)} left).`;
}

export function shakyDelta(before, after, recognized = 0) {
  const n = Math.max(0, Number(recognized) || 0);
  if (!n) return `Shaky: ${Number(before) || 0} -> ${Number(after) || 0}`;
  return `${Number(after) || 0} still shaky, ${n} of them recognized (one recall locks them in)`;
}

export function hasTestFormatCards(modeIds, testType) {
  const type = normalizeExamType(testType);
  if (type === 'short_answer') return (modeIds?.freeIds || []).length > 0;
  if (type === 'mcq' || type === 'mixed') return (modeIds?.mcIds || []).length > 0;
  return false;
}

export function countLearned(terms) {
  return (Array.isArray(terms) ? terms : []).filter((t) => t?.srs?.introduced).length;
}

export function recapCopy({ sittingNumber = 1, learned = 0, shakyBefore = 0, shakyAfter = 0, recognized = 0 } = {}) {
  if (Number(sittingNumber) <= 1) {
    return { text: `${Number(learned) || 0} learned, ${Number(shakyAfter) || 0} shaky`, slip: false };
  }
  if (Number(shakyAfter) > Number(shakyBefore)) {
    return { text: SLIP_LINE, slip: true };
  }
  return { text: shakyDelta(shakyBefore, shakyAfter, recognized), slip: false };
}

export function recognizedFromResults(results) {
  const ids = [];
  Object.entries(results && typeof results === 'object' ? results : {}).forEach(([id, attempt]) => {
    const grade = attemptFrom(attempt);
    if (grade.lastGrade === 'partial' && grade.mode === 'mc') ids.push(id);
  });
  return ids;
}

export function reminderMode({ native = false, canNotify = false } = {}) {
  if (native) return 'native';
  if (canNotify) return 'web';
  return 'off';
}

export function shouldPersistSession({ clockAt = null, clockOffset = 0 } = {}) {
  if (Number.isFinite(clockAt)) return false;
  if (clockOffset) return false;
  return true;
}

export function hitAttempts(results) {
  const out = {};
  if (!results || typeof results !== 'object') return out;
  Object.entries(results).forEach(([id, attempt]) => {
    const grade = attemptFrom(attempt);
    if (grade.lastGrade === 'hit') out[id] = grade;
  });
  return out;
}

export function settledAttempts(results) {
  const out = {};
  if (!results || typeof results !== 'object') return out;
  Object.entries(results).forEach(([id, attempt]) => {
    const grade = attemptFrom(attempt);
    if (grade.lastGrade === 'hit' || grade.lastGrade === 'partial') out[id] = grade;
  });
  return out;
}

export function savedAttemptForMiss(term) {
  if (term?.srs?.lastGrade !== 'miss') return '';
  return String(term?.freeAttempt || '').trim();
}

export function settleResume(nextSpaced, prevSpaced, terms, now = Date.now()) {
  const hadResume = Array.isArray(prevSpaced?.resumeIds) && prevSpaced.resumeIds.length > 0;
  const kept = Array.isArray(nextSpaced?.resumeIds) && nextSpaced.resumeIds.length > 0;
  const grades = prevSpaced?.pendingGrades;
  const hasGrades = grades && typeof grades === 'object' && Object.keys(grades).length > 0;
  if (hadResume && !kept && hasGrades) {
    return {
      spaced: { ...nextSpaced, pendingGrades: {} },
      terms: applySittingResults(terms, grades, {
        at: Number.isFinite(now) ? now : Date.now(),
        wakeTime: prevSpaced?.wakeTime,
        sleepTime: prevSpaced?.stopTime,
      }),
    };
  }
  return { spaced: nextSpaced, terms };
}

export function shakyTermNames(terms) {
  return (Array.isArray(terms) ? terms : [])
    .filter((t) => t?.srs?.introduced && termPile(t) === 'shaky')
    .map((t) => t.term)
    .filter(Boolean);
}

export function planEndGlance(terms) {
  const introduced = (Array.isArray(terms) ? terms : []).filter((t) => t?.srs?.introduced);
  const shaky = introduced.filter((t) => termPile(t) === 'shaky');
  const solid = introduced.filter((t) => termPile(t) === 'solid');
  return {
    solid: solid.length,
    shaky: shaky.length,
    shakyTerms: shaky.map((t) => t.term).filter(Boolean),
  };
}

export function offerReminder(finishedSittingNumber) {
  return Number(finishedSittingNumber) === 1;
}

export function countdownLabel(due, now = Date.now()) {
  const diff = Math.max(0, (Number(due) || 0) - now);
  const total = Math.ceil(diff / 1000);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(mins)}:${pad(secs)}`;
  return `${mins}:${pad(secs)}`;
}

export function cardEstimateSeconds(mode) {
  if (mode === 'mc_term') return MC_TERM_SECONDS;
  if (mode === 'mc_def') return MC_DEF_SECONDS;
  return CARD_SECONDS;
}

export function sittingEstimate(cardCount, { mcCards = 0, mcTermCards = 0, mcDefCards = 0 } = {}) {
  const cards = Math.max(0, Number(cardCount) || 0);
  if (!cards) return { cards: 0, minutes: 0, seconds: 0, line: '' };
  let def = Math.max(0, Number(mcDefCards) || 0);
  let term = Math.max(0, Number(mcTermCards) || 0);
  if (!def && !term) term = Math.max(0, Number(mcCards) || 0);
  def = Math.min(cards, def);
  term = Math.min(Math.max(0, cards - def), term);
  const seconds = (cards - term - def) * CARD_SECONDS + term * MC_TERM_SECONDS + def * MC_DEF_SECONDS;
  const minutes = Math.max(1, Math.min(MAX_SITTING_MINUTES, Math.round(seconds / 60)));
  return { cards, minutes, seconds, line: `~${minutes} min, ${cards} cards` };
}

export function applySittingResults(terms, results, context = {}) {
  const map = results && typeof results === 'object' ? results : {};
  const at = Number.isFinite(context.at) ? context.at : Date.now();
  return (Array.isArray(terms) ? terms : []).map((t) => {
    const attempt = map[t.id];
    if (attempt == null) return t;
    const grade = attemptFrom(attempt);
    const { missCount, lastGrade, mode } = grade;
    const shaky = sittingEndedShaky({ missCount, lastGrade: lastGrade === 'partial' ? 'hit' : lastGrade });
    if (lastGrade === 'partial' && !shaky) {
      return {
        ...t,
        seen: true,
        pile: termPile(t) === 'solid' ? 'solid' : 'shaky',
        srs: {
          ...emptySrs(),
          ...t.srs,
          introduced: true,
          lastGrade: 'partial',
          lastMode: 'mc',
          mcCredit: 0.5,
          missCount: 0,
          solidStreak: Number(t.srs?.solidStreak) || 0,
          solidFinishes: finishList(t.srs?.solidFinishes),
        },
      };
    }
    const prevStreak = Number(t.srs?.solidStreak) || 0;
    const prevFinishes = shaky ? [] : finishList(t.srs?.solidFinishes);
    const afterSleep = !shaky && prevFinishes.length
      ? crossedSleep(prevFinishes[prevFinishes.length - 1].at, at, context.wakeTime, context.sleepTime)
      : false;
    const solidFinishes = shaky ? [] : [...prevFinishes, { at, afterSleep }];
    return {
      ...t,
      seen: true,
      pile: shaky ? 'shaky' : 'solid',
      srs: {
        ...emptySrs(),
        ...t.srs,
        introduced: true,
        lastGrade,
        lastMode: mode,
        mcCredit: 0,
        missCount: 0,
        solidStreak: shaky ? 0 : prevStreak + 1,
        solidFinishes,
      },
    };
  });
}

export function nextNewStep(spaced, schedule) {
  const chunkCount = schedule?.chunks?.length || 1;
  const chunkIndex = spaced?.chunkIndex || 0;
  const subPhase = spaced?.subPhase || 'new';
  if (subPhase === 'new') {
    if (chunkCount > 1) {
      return { kind: 'mini_rev', chunkIndex, subPhase: 'mini_rev' };
    }
    return { kind: 'sitting_done' };
  }
  const nextChunk = chunkIndex + 1;
  if (nextChunk < chunkCount) {
    return { kind: 'next_chunk', chunkIndex: nextChunk, subPhase: 'new' };
  }
  return { kind: 'sitting_done' };
}

export function countUnseen(terms) {
  return (Array.isArray(terms) ? terms : []).filter((t) => !t.srs?.introduced).length;
}

export function countShaky(terms) {
  return (Array.isArray(terms) ? terms : []).filter((t) => t?.srs?.introduced && termPile(t) === 'shaky').length;
}

export function planProgress(schedule, spaced, terms) {
  const last = lastSittingIndex(schedule);
  const sittingN = spaced?.sittingIndex || 1;
  const examOver = !!spaced?.examOver;
  const finishedAll = examOver || sittingN > last;
  const sitting = sittingByIndex(schedule, sittingN);
  const sittingsDone = finishedAll ? last : Math.max(0, sittingN - 1);
  const sittingsLeft = finishedAll ? 0 : Math.max(0, last - sittingN + 1);
  const chunks = schedule?.chunks || [];
  const chunkCount = chunks.length || 1;
  const chunkIndex = spaced?.chunkIndex || 0;
  const inMiniRev = spaced?.subPhase === 'mini_rev';
  const leftoverChunks = sitting?.type === SESSION_TYPE.NEW
    ? chunks.slice(inMiniRev ? chunkIndex + 1 : chunkIndex)
    : [];
  const chunksLeft = leftoverChunks.length;
  const chunkTermsLeft = leftoverChunks.reduce((n, c) => n + (c.terms?.length || 0), 0);
  const unseen = countUnseen(terms);
  const shaky = countShaky(terms);
  const termCount = schedule?.large
    ? (schedule.coreCount || schedule?.termCount || 0)
    : (schedule?.termCount || (Array.isArray(terms) ? terms.length : 0));
  const described = finishedAll ? null : describeSittingQueue(terms, spaced, schedule);

  const hereLine = examOver
    ? 'Plan complete'
    : finishedAll
      ? 'Sittings done'
      : `Sitting ${sittingN} of ${last}`;
  const nextLine = finishedAll ? '' : `Next: ${nextSittingName(sitting?.type)}`;

  let leftLine;
  if (finishedAll) {
    leftLine = 'No sittings left.';
  } else if (sitting?.type === SESSION_TYPE.NEW && chunkCount > 1) {
    const chunkN = chunkIndex + 1;
    const termsBit = `${chunkTermsLeft} term${chunkTermsLeft === 1 ? '' : 's'} still to learn`;
    if (inMiniRev) {
      leftLine = chunksLeft
        ? `Mixed review of chunk ${chunkN}, then ${chunksLeft} chunk${chunksLeft === 1 ? '' : 's'} left · ${termsBit}`
        : `Mixed review of chunk ${chunkN} · last new chunk`;
    } else {
      leftLine = `Chunk ${chunkN} of ${chunkCount} · ${chunksLeft} chunk${chunksLeft === 1 ? '' : 's'} left · ${termsBit}`;
    }
  } else if (sitting?.type === SESSION_TYPE.NEW) {
    const n = unseen || termCount;
    leftLine = `${n} term${n === 1 ? '' : 's'} in this first pass · ${sittingsLeft} sitting${sittingsLeft === 1 ? '' : 's'} left`;
  } else {
    const shakyBit = shaky ? `${shaky} still shaky` : 'none marked shaky';
    leftLine = `${sittingsLeft} sitting${sittingsLeft === 1 ? '' : 's'} left · ${termCount} term${termCount === 1 ? '' : 's'} · ${shakyBit}`;
  }

  const chunkFraction =
    !finishedAll && sitting?.type === SESSION_TYPE.NEW && chunkCount > 1
      ? (chunkIndex + (inMiniRev ? 0.5 : 0)) / chunkCount
      : 0;
  const sittingPct = last ? Math.round(((sittingsDone + chunkFraction) / last) * 100) : 0;

  return {
    hereLine,
    nextLine,
    leftLine,
    sittingN,
    last,
    sittingsDone,
    sittingsLeft,
    chunkCount,
    chunkIndex,
    chunksLeft,
    chunkTermsLeft,
    unseen,
    shaky,
    finishedAll,
    sittingPct,
    skipLine: described?.skipLine || '',
  };
}
