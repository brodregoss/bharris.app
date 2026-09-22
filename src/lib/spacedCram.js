import { priority } from '@/lib/studyUtils';

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
    meaning: 'Write the definition from just the term — no flip-card recognition.',
  },
};

const TOMORROW_SITTINGS = [
  { sitting: 1, timing: 'Start', type: SESSION_TYPE.NEW, gap: 'short' },
  { sitting: 2, timing: '+20–30 min', type: SESSION_TYPE.REV, gap: 'medium' },
  { sitting: 3, timing: '+1–2 hrs after last', type: SESSION_TYPE.REV_PLUS, gap: 'long' },
  { sitting: 4, timing: '+2–3 hrs after last', type: SESSION_TYPE.FREE, gap: 'bedtime' },
  { sitting: 5, timing: 'Right before bed', type: SESSION_TYPE.REV, gap: 'morning' },
  { sitting: 6, timing: 'Test morning', type: SESSION_TYPE.REV_PLUS, gap: null, shakyOnly: true, fast: true },
];

const TWO_DAY_SITTINGS = [
  { sitting: 1, timing: 'Start', type: SESSION_TYPE.NEW, gap: 'short' },
  { sitting: 2, timing: '+20–30 min', type: SESSION_TYPE.REV, gap: 'medium' },
  { sitting: 3, timing: '+1–2 hrs after last', type: SESSION_TYPE.REV_PLUS, gap: 'long' },
  { sitting: 4, timing: '+2–3 hrs after last', type: SESSION_TYPE.FREE, gap: 'bedtime' },
  { sitting: 5, timing: 'Right before bed', type: SESSION_TYPE.REV, gap: 'morning' },
  { sitting: 6, timing: 'Day 2, on waking', type: SESSION_TYPE.REV_PLUS, gap: 'day2' },
  { sitting: 7, timing: '+2–4 hrs after last', type: SESSION_TYPE.REV_PLUS, gap: 'bedtime' },
  { sitting: 8, timing: 'Evening, before bed', type: SESSION_TYPE.REV, gap: 'morning' },
  { sitting: 9, timing: 'Test morning', type: SESSION_TYPE.REV_PLUS, gap: null, shakyOnly: true, fast: true },
];

const GAP_MS = {
  short: 25 * 60 * 1000,
  medium: 90 * 60 * 1000,
  long: 150 * 60 * 1000,
  day2: 3 * 60 * 60 * 1000,
};

export function emptySrs() {
  return { introduced: false };
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

function sittingsFor(examTiming) {
  return examTiming === '2days' ? TWO_DAY_SITTINGS : TOMORROW_SITTINGS;
}

function timelineFor(examTiming) {
  const sittings = sittingsFor(examTiming);
  const items = [];
  sittings.forEach((sitting) => {
    items.push({ kind: 'sitting', ...sitting });
    if (sitting.gap === 'morning') {
      items.push({ kind: 'sleep', label: 'Sleep' });
    }
  });
  return items;
}

function summaryCopy(termCount, hours, examTiming) {
  const when = examTiming === '2days' ? 'over the next two days' : 'before tomorrow’s exam';
  const h = Number(hours);
  const hoursBit = Number.isFinite(h) && h > 0 ? `${h} hour${h === 1 ? '' : 's'}` : null;
  const n = Number(termCount) || 0;
  const termsBit = `${n} term${n === 1 ? '' : 's'}`;
  return hoursBit ? `${termsBit}, ${hoursBit} ${when}.` : `${termsBit} ${when}.`;
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
    return sitting.gap === 'morning'
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

export function buildSpacedSchedule({ examTiming, hours, terms } = {}) {
  const list = (Array.isArray(terms) ? terms : []).map(ensureSpacedTerm).sort(byPriority);
  const chunkSize = chunkSizeFor(hours, list.length);
  const rawChunks = chunkTerms(list, chunkSize);
  const sittings = sittingsFor(examTiming);
  return {
    examTiming,
    hours: Number(hours) || 0,
    termCount: list.length,
    chunkSize,
    chunks: rawChunks.map((chunkTermsList, index) => ({ index, terms: chunkTermsList })),
    sittings,
    items: timelineFor(examTiming),
    summaryLine: summaryCopy(list.length, hours, examTiming),
    whyLine:
      examTiming === '2days'
        ? 'Expanding retrieval over two days, with sleep before the two highest-stakes reviews.'
        : 'Expanding retrieval compressed into today and tomorrow morning — each gap longer than the last.',
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
  let h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

export function clockToMs(hhmm, now = Date.now()) {
  const d = new Date(now);
  const [h, m] = String(hhmm || '22:30').split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 22, Number.isFinite(m) ? m : 30, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function upcomingMorningMs(now = Date.now(), hour = 7) {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function nextDueAfterSitting(sitting, { stopTime, now = Date.now() } = {}) {
  if (!sitting?.gap) return 0;
  if (sitting.gap === 'bedtime') return clockToMs(stopTime, now);
  if (sitting.gap === 'morning') return upcomingMorningMs(now);
  return now + (GAP_MS[sitting.gap] || GAP_MS.short);
}

export function sittingIsReady(spaced, now = Date.now()) {
  const nextDueAt = Number(spaced?.nextDueAt) || 0;
  if (!nextDueAt) return true;
  if (!(Number(spaced?.lastFinishedAt) > 0) && (spaced?.sittingIndex || 1) === 1) return true;
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

function queueCap(hours, type) {
  const h = Number(hours);
  if (type === SESSION_TYPE.REV_PLUS) {
    if (Number.isFinite(h) && h <= 2) return 12;
    if (Number.isFinite(h) && h <= 4) return 20;
    return 36;
  }
  if (Number.isFinite(h) && h <= 2) return 16;
  return 0;
}

function capQueue(queue, cap) {
  if (!cap || queue.length <= cap) return queue;
  return queue.slice(0, cap);
}

export function buildReviewQueue(terms, sitting, hours) {
  const introduced = introducedTerms(terms);
  const pool = introduced.length ? introduced : (Array.isArray(terms) ? terms : []);
  if (!pool.length) return [];
  if (sitting?.type === SESSION_TYPE.REV || sitting?.type === SESSION_TYPE.FREE) {
    return capQueue(shuffle(pool), queueCap(hours, sitting.type));
  }
  const shaky = pool.filter((t) => termPile(t) === 'shaky');
  const solid = pool.filter((t) => termPile(t) !== 'shaky');
  if (sitting?.shakyOnly) {
    const focus = shaky.length ? shaky : pool;
    return shuffle(focus);
  }
  const h = Number(hours);
  const reps = Number.isFinite(h) && h <= 2 ? 2 : 3;
  const weighted = [];
  shuffle(shaky.length ? shaky : pool).forEach((t) => {
    for (let i = 0; i < reps; i += 1) weighted.push(t);
  });
  const solidTake = Math.max(1, Math.round(weighted.length * 0.25));
  const solidSlice = shuffle(solid).slice(0, Number.isFinite(h) && h <= 2 ? Math.min(solidTake, 4) : solidTake);
  return capQueue(shuffle([...weighted, ...solidSlice]), queueCap(hours, SESSION_TYPE.REV_PLUS));
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

export function planSittingQueue(terms, spaced, schedule) {
  const sitting = sittingByIndex(schedule, spaced?.sittingIndex || 1);
  if (!sitting) return [];
  if (sitting.type === SESSION_TYPE.NEW) {
    if (spaced?.subPhase === 'mini_rev') {
      const learned = learnedChunkTerms(schedule, spaced.chunkIndex || 0);
      const ids = new Set(learned.map((t) => t.id));
      return shuffle((Array.isArray(terms) ? terms : []).filter((t) => ids.has(t.id)));
    }
    const chunk = newChunkTerms(schedule, spaced.chunkIndex || 0);
    const ids = new Set(chunk.map((t) => t.id));
    return (Array.isArray(terms) ? terms : []).filter((t) => ids.has(t.id));
  }
  return buildReviewQueue(terms, sitting, schedule?.hours);
}

export function markTermsIntroduced(terms, ids) {
  const set = ids instanceof Set ? ids : new Set(ids || []);
  return (Array.isArray(terms) ? terms : []).map((t) =>
    set.has(t.id) ? { ...t, srs: { ...emptySrs(), ...t.srs, introduced: true } } : t
  );
}

export function applySittingResults(terms, results) {
  const map = results && typeof results === 'object' ? results : {};
  return (Array.isArray(terms) ? terms : []).map((t) => {
    const last = map[t.id];
    if (last == null) return t;
    const correct = last === 'got_it';
    return {
      ...t,
      seen: true,
      pile: correct ? 'solid' : 'shaky',
      srs: { ...emptySrs(), ...t.srs, introduced: true, lastGrade: correct ? 'hit' : 'miss' },
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
  const finishedAll = sittingN > last || spaced?.phase === 'complete';
  const sitting = sittingByIndex(schedule, sittingN);
  const typeLabel = SESSION_TYPE_META[sitting?.type]?.label;
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
  const termCount = schedule?.termCount || (Array.isArray(terms) ? terms.length : 0);

  const hereLine = finishedAll
    ? 'Plan complete'
    : `Sitting ${sittingN} of ${last}${typeLabel ? ` · ${typeLabel}` : ''}`;

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
  };
}
