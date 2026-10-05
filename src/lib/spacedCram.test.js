import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AHEAD_LINE,
  START_EARLY_LINE,
  WAIT_WHY,
  applyLastLookResults,
  applySittingResults,
  buildReviewQueue,
  buildSpacedSchedule,
  catchUpPlan,
  changePlanTimes,
  countdownLabel,
  currentTime,
  describeReviewQueue,
  describeSittingQueue,
  emptySpacedState,
  examClockSet,
  generatePlan,
  lastLookQueue,
  loadSavedClock,
  mergeKeptSittings,
  migrateStudyTerms,
  offerReminder,
  openSpacedSession,
  pickupLine,
  planEndGlance,
  planProgress,
  recapCopy,
  recordAttempt,
  reminderMode,
  saveSavedClock,
  savedAttemptForMiss,
  settleResume,
  shouldPersistSession,
  shakyDelta,
  shouldAutoComplete,
  sittingEndedShaky,
  sittingEstimate,
  splitCorePlan,
  termIsLocked,
  unclearedIds,
  welcomeBackLine,
} from './spacedCram.js';

function at(y, m, d, h, min) {
  return new Date(y, m, d, h, min, 0, 0).getTime();
}

function terms(n, patch) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`,
    term: `Term ${i}`,
    definition: `Def ${i}`,
    tier: 'core',
    confidence: 'shaky',
    srs: { introduced: false, missCount: 0, solidStreak: 0 },
    ...patch,
  }));
}

function introduced(n, streak = 1) {
  return terms(n).map((t) => ({
    ...t,
    pile: 'solid',
    srs: { introduced: true, missCount: 0, solidStreak: streak, lastGrade: 'hit' },
  }));
}

function minutesOf(ms) {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function assertAwake(sitting, wakeMin, sleepMin) {
  const mins = minutesOf(sitting.at);
  assert.ok(
    mins >= wakeMin && mins < sleepMin,
    `${sitting.timing} at ${mins} is outside ${wakeMin}-${sleepMin}`
  );
}

test('short night collapses middle sittings and stays inside waking hours', () => {
  const now = at(2026, 9, 4, 21, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(40),
  });
  assert.deepEqual(plan.sittings.map((s) => s.type), ['new', 'rev', 'rev', 'rev_plus']);
  assert.deepEqual(plan.sittings.map((s) => s.role), ['start', 'gap', 'before_bed', 'morning']);
  assert.equal(plan.sittings.at(-1).at, at(2026, 9, 5, 7, 30));
  plan.sittings.forEach((s) => {
    assert.ok(s.at < exam);
    assert.ok(s.at >= now);
    const day = new Date(s.at).getDate();
    if (day === 4) assertAwake(s, 21 * 60, 23 * 60);
    else assertAwake(s, 7 * 60, 9 * 60);
  });
  assert.match(plan.summaryLine, /^4 sittings, ~\d+ min each$/);
  assert.equal(plan.sittings.some((s) => s.light), false);
});

test('late start waits until wake and does not schedule overnight', () => {
  const now = at(2026, 9, 5, 1, 30);
  const exam = at(2026, 9, 5, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  assert.equal(plan.sittings.length, 1);
  assert.equal(plan.sittings[0].at, at(2026, 9, 5, 7, 30));
  assert.equal(plan.sittings[0].role, 'morning');
  assert.ok(plan.sittings[0].at >= at(2026, 9, 5, 7, 0));
  assert.match(plan.summaryLine, /^1 sitting, ~/);
});

test('skipped day rebuilds as a tomorrow plan and does not relearn introduced terms', () => {
  const now = at(2026, 9, 5, 20, 0);
  const exam = at(2026, 9, 6, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: introduced(40),
  });
  assert.ok(plan.sittings.length >= 3 && plan.sittings.length <= 6);
  assert.ok(plan.sittings.every((s) => s.type !== 'new'));
  assert.equal(plan.sittings[0].type, 'rev');
  assert.equal(plan.sittings.at(-1).role, 'morning');
  assert.ok(plan.sittings.some((s) => s.role === 'before_bed'));
  assert.equal(plan.sittings.at(-1).at, at(2026, 9, 6, 7, 30));
});

test('large deck gets more sittings than a small deck', () => {
  const now = at(2026, 9, 4, 14, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const large = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(60),
  });
  const small = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(8),
  });
  assert.equal(large.sittings.length, 6);
  assert.equal(small.sittings.length, 4);
  assert.deepEqual(large.sittings.map((s) => s.type), ['new', 'rev', 'rev_plus', 'free', 'rev', 'rev_plus']);
  assert.deepEqual(small.sittings.map((s) => s.role), ['start', 'gap', 'before_bed', 'morning']);
  assert.equal(small.sittings[1].at - small.sittings[0].at, 25 * 60 * 1000);
  assert.match(large.summaryLine, /^6 sittings, ~/);
  assert.match(small.summaryLine, /^4 sittings, ~/);
  large.sittings.forEach((s) => assertAwake(s, 7 * 60, 23 * 60));

  const twoDay = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: at(2026, 9, 6, 9, 0),
    terms: terms(60),
  });
  assert.equal(twoDay.sittings.length, 8);
  assert.deepEqual(
    twoDay.sittings.map((s) => s.role),
    ['start', 'gap', 'gap', 'before_bed', 'wake', 'midday', 'before_bed', 'morning']
  );
  assert.equal(twoDay.sittings[5].type, 'free');
  assert.equal(twoDay.sittings[5].shakyOnly, true);
  assert.equal(twoDay.sittings[3].at, at(2026, 9, 4, 22, 40));
  assert.equal(twoDay.sittings[4].at, at(2026, 9, 5, 7, 0));
  assert.equal(twoDay.sittings.at(-1).at, at(2026, 9, 6, 7, 30));
});

test('exam before wake uses the evening and skips a morning pass', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 6, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(40),
  });
  assert.ok(plan.sittings.length >= 3);
  assert.equal(plan.sittings[0].type, 'new');
  assert.ok(plan.sittings.some((s) => s.role === 'before_bed'));
  assert.ok(plan.sittings.every((s) => s.role !== 'morning'));
  plan.sittings.forEach((s) => {
    assert.ok(s.at < at(2026, 9, 4, 23, 0));
    assertAwake(s, 16 * 60, 23 * 60);
  });
});

test('small two-day plan still reviews about 25 minutes after New', () => {
  const now = at(2026, 9, 4, 14, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: at(2026, 9, 6, 9, 0),
    terms: terms(12),
  });
  assert.equal(plan.sittings[0].type, 'new');
  assert.equal(plan.sittings[1].type, 'rev');
  assert.equal(plan.sittings[1].at - plan.sittings[0].at, 25 * 60 * 1000);
});

test('a long gap after waking adds a short shaky review', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 16, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  const light = plan.sittings.find((s) => s.light);
  const morning = plan.sittings.find((s) => s.role === 'morning');
  assert.ok(light);
  assert.equal(light.type, 'rev');
  assert.equal(light.shakyOnly, true);
  assert.equal(light.minutes, 3);
  assert.equal(light.at, at(2026, 9, 5, 7, 0));
  assert.equal(morning.at, at(2026, 9, 5, 14, 30));
  assert.ok(morning.at - light.at > 3 * 60 * 60 * 1000);
  const queue = buildReviewQueue(introduced(30), light, 4);
  assert.ok(queue.length > 0 && queue.length <= 8);
});

test('returning keeps sitting numbers and does not offer a finished sitting', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(40),
  });
  const thirdAt = plan.sittings[2].at;
  const done = plan.sittings.map((s, i) => (i < 2 ? { ...s, done: true } : s));
  const opened = openSpacedSession({
    stopTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    phase: 'plan',
    sittingIndex: 3,
    sittings: done,
    lastFinishedAt: thirdAt - 20 * 60 * 1000,
    nextDueAt: thirdAt,
  }, terms(40), currentTime(Date.now(), thirdAt + 10 * 60 * 1000));
  assert.equal(opened.sittingIndex, 3);
  assert.equal(opened.sittings.length, plan.sittings.length);
  assert.equal(opened.sittings[0].sitting, 1);
  assert.equal(opened.sittings[2].sitting, 3);
  assert.equal(opened.sittings[2].at, thirdAt);
  assert.equal(opened.sittings.find((s) => s.sitting === 3).done, false);
  assert.ok(opened.sittings.filter((s) => s.sitting < 3).every((s) => s.done));
  const progress = planProgress({ sittings: opened.sittings }, opened, terms(40));
  assert.equal(progress.hereLine, `Sitting 3 of ${plan.sittings.length}`);
  assert.equal(progress.nextLine, 'Next: Review');
});

test('sleep and wake can be remembered and exam time starts unset', () => {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  };
  try {
    assert.deepEqual(loadSavedClock(), { sleep: '', wake: '' });
    assert.equal(examClockSet(''), false);
    assert.equal(examClockSet('09:00'), true);
    saveSavedClock('23:15', '06:40');
    assert.deepEqual(loadSavedClock(), { sleep: '23:15', wake: '06:40' });
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test('pre-exam pass clamps to a few minutes after wake', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 7, 20);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  const morning = plan.sittings.find((s) => s.role === 'morning');
  assert.ok(morning);
  assert.equal(morning.at, at(2026, 9, 5, 7, 5));
  assert.ok(morning.at > at(2026, 9, 5, 7, 0));
  assert.ok(morning.at < exam);
  assert.equal(morning.short, true);
  assert.equal(morning.minutes, 3);
  const queue = buildReviewQueue(introduced(30), morning, 4);
  assert.ok(queue.length > 0 && queue.length <= 8);
});

test('labels say Today or Tomorrow and gaps stay real across the November clock change', () => {
  const now = new Date(2026, 9, 31, 20, 0, 0, 0).getTime();
  const exam = new Date(2026, 10, 1, 9, 0, 0, 0).getTime();
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(30),
  });
  const morning = plan.sittings.find((s) => s.role === 'morning');
  const rev = plan.sittings.find((s) => s.role === 'gap' && s.type === 'rev');
  assert.equal(morning.at, new Date(2026, 10, 1, 7, 30, 0, 0).getTime());
  assert.match(plan.sittings[0].timing, /Today/);
  assert.match(morning.timing, /Tomorrow/);
  assert.equal(rev.at - plan.sittings[0].at, 25 * 60 * 1000);
});

test('old fixed-timeline sessions migrate without throwing', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const oldTerms = [
    { id: 'a', term: 'Alpha', definition: 'a', srs: { introduced: true, lastGrade: 'miss' } },
    { id: 'b', term: 'Beta', definition: 'b' },
  ];
  const oldSittings = [
    { sitting: 1, timing: 'Start', type: 'new', gap: 'short' },
    { sitting: 2, timing: '+20–30 min', type: 'rev', gap: 'medium' },
    { sitting: 3, timing: '+1–2 hrs after last', type: 'rev_plus', gap: 'long' },
  ];
  const old = {
    sittingIndex: 4,
    phase: 'plan',
    stopTime: '22:30',
    queue: ['a'],
    sittings: oldSittings,
  };
  let plan;
  let schedule;
  assert.doesNotThrow(() => {
    plan = generatePlan({
      now,
      sleepTime: old.stopTime,
      wakeTime: undefined,
      examTime: exam,
      terms: oldTerms,
    });
    generatePlan({ terms: null, examTime: 'nope', sleepTime: null, wakeTime: 7 });
    schedule = buildSpacedSchedule({
      terms: oldTerms,
      sittings: oldSittings,
      sleepTime: '22:30',
      wakeTime: '07:00',
      examTime: exam,
      now,
    });
  });
  assert.ok(plan.sittings.every((s) => Number.isFinite(s.at)));
  assert.ok(schedule.sittings.every((s) => Number.isFinite(s.at)));
  assert.ok(schedule.sittings.every((s) => !['short', 'medium', 'long'].includes(s.gap)));
  const opened = openSpacedSession({ ...old, wakeTime: '07:00', examTime: exam }, oldTerms, now);
  assert.ok(opened.sittings.every((s) => Number.isFinite(s.at)));
  assert.equal(opened.sittingIndex, opened.sittings[0].sitting);
  const drilling = openSpacedSession({
    ...old,
    phase: 'drill',
    queue: ['a'],
    wakeTime: '07:00',
    examTime: exam,
  }, oldTerms, now);
  assert.equal(drilling.phase, 'drill');
  assert.deepEqual(drilling.queue, ['a']);
  assert.equal(drilling.sittings, null);
});

test('sittingEndedShaky is two misses or a final miss', () => {
  assert.equal(sittingEndedShaky({ missCount: 0, lastGrade: 'hit' }), false);
  assert.equal(sittingEndedShaky({ missCount: 1, lastGrade: 'hit' }), false);
  assert.equal(sittingEndedShaky({ missCount: 2, lastGrade: 'hit' }), true);
  assert.equal(sittingEndedShaky({ missCount: 1, lastGrade: 'miss' }), true);
});

test('a hit after one miss ends solid and increments solidStreak', () => {
  const bucket = {};
  recordAttempt(bucket, 'a', 'missed');
  recordAttempt(bucket, 'a', 'got_it');
  const [term] = applySittingResults([
    { id: 'a', srs: { introduced: true, missCount: 0, solidStreak: 2, lastGrade: 'hit' } },
  ], bucket);
  assert.equal(bucket.a.missCount, 1);
  assert.equal(bucket.a.lastGrade, 'hit');
  assert.equal(term.pile, 'solid');
  assert.equal(term.srs.solidStreak, 3);
  assert.equal(term.srs.missCount, 0);
  assert.equal(term.srs.lastGrade, 'hit');
  assert.equal(term.srs.introduced, true);
});

test('two misses then a hit ends shaky and resets solidStreak', () => {
  const bucket = {};
  recordAttempt(bucket, 'a', 'missed');
  recordAttempt(bucket, 'a', 'missed');
  recordAttempt(bucket, 'a', 'got_it');
  const [term] = applySittingResults([
    { id: 'a', pile: 'solid', srs: { introduced: true, solidStreak: 4, lastGrade: 'hit' } },
  ], bucket);
  assert.equal(term.pile, 'shaky');
  assert.equal(term.srs.solidStreak, 0);
  assert.equal(term.srs.missCount, 0);
  assert.equal(term.srs.lastGrade, 'hit');
});

test('a final miss ends shaky', () => {
  const [term] = applySittingResults([
    { id: 'a', pile: 'solid', srs: { introduced: true, solidStreak: 1, lastGrade: 'hit' } },
  ], { a: { missCount: 1, lastGrade: 'miss' } });
  assert.equal(term.pile, 'shaky');
  assert.equal(term.srs.solidStreak, 0);
  assert.equal(term.srs.missCount, 0);
});

function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function assertNoStackedWakes(plan) {
  const byDay = new Map();
  plan.sittings.forEach((s) => {
    if (s.role !== 'wake' && s.role !== 'wake_light' && s.role !== 'morning') return;
    const list = byDay.get(dayKey(s.at)) || [];
    list.push(s);
    byDay.set(dayKey(s.at), list);
  });
  byDay.forEach((list) => {
    const wakes = list.filter((s) => s.role === 'wake' || s.role === 'wake_light');
    assert.ok(wakes.length <= 1, 'two wake reviews on the same morning');
    const morning = list.find((s) => s.role === 'morning');
    if (morning && wakes.length) {
      assert.ok(Math.abs(morning.at - wakes[0].at) >= 15 * 60 * 1000);
    }
  });
}

test('light wake review does not stack with the day-2 wake or the exam pass', () => {
  const now = at(2026, 9, 4, 14, 0);
  const afternoon = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: at(2026, 9, 6, 16, 0),
    terms: terms(60),
  });
  const light = afternoon.sittings.find((s) => s.light);
  const day2 = afternoon.sittings.find((s) => s.role === 'wake');
  const morning = afternoon.sittings.find((s) => s.role === 'morning');
  assert.ok(light);
  assert.equal(light.role, 'wake_light');
  assert.ok(day2);
  assert.ok(morning);
  assert.notEqual(day2.at, light.at);
  assert.ok(Math.abs(day2.at - light.at) >= 15 * 60 * 1000);
  assert.ok(morning.at - light.at >= 15 * 60 * 1000);
  assert.equal(afternoon.sittings.filter((s) => s.role === 'wake').length, 1);
  assert.equal(afternoon.sittings.filter((s) => s.role === 'wake_light').length, 1);
  assertNoStackedWakes(afternoon);

  const earlyExam = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: at(2026, 9, 6, 9, 0),
    terms: terms(60),
  });
  assert.equal(earlyExam.sittings.filter((s) => s.light || s.role === 'wake_light').length, 0);
  const wake = earlyExam.sittings.find((s) => s.role === 'wake');
  const pass = earlyExam.sittings.find((s) => s.role === 'morning');
  assert.ok(wake && pass);
  assert.ok(Math.abs(wake.at - pass.at) >= 15 * 60 * 1000);
  assertNoStackedWakes(earlyExam);
});

test('migrating an old timeline keeps introduced terms introduced', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const oldSittings = [
    { sitting: 1, timing: 'Start', type: 'new', gap: 'short' },
    { sitting: 2, timing: '+20–30 min', type: 'rev', gap: 'medium' },
  ];
  const oldTerms = [
    { id: 'a', term: 'Alpha', definition: 'a', tier: 'core', confidence: 'shaky', srs: { introduced: true, lastGrade: 'hit' } },
    { id: 'b', term: 'Beta', definition: 'b', tier: 'core', confidence: 'blank', srs: { introduced: true, lastGrade: 'miss' } },
  ];
  const kept = migrateStudyTerms(oldTerms);
  assert.equal(kept[0].srs.introduced, true);
  assert.equal(kept[1].srs.introduced, true);
  assert.equal(oldTerms[0].srs.introduced, true);
  const opened = openSpacedSession({
    sittingIndex: 2,
    phase: 'plan',
    stopTime: '22:30',
    wakeTime: '07:00',
    examTime: exam,
    queue: ['a'],
    sittings: oldSittings,
  }, kept, now);
  assert.ok(opened.sittings.every((s) => s.type !== 'new'));
  assert.equal(kept[0].srs.introduced, true);
  assert.equal(kept[1].srs.introduced, true);

  const mixed = migrateStudyTerms([
    oldTerms[0],
    { id: 'c', term: 'Gamma', definition: 'c', tier: 'core', confidence: 'blank', srs: { introduced: false } },
  ]);
  assert.equal(mixed[0].srs.introduced, true);
  assert.equal(mixed[1].srs.introduced, false);
  const schedule = buildSpacedSchedule({
    terms: mixed,
    sittings: oldSittings,
    sleepTime: '22:30',
    wakeTime: '07:00',
    examTime: exam,
    now,
  });
  const chunkIds = schedule.chunks.flatMap((c) => c.terms.map((t) => t.id));
  assert.ok(chunkIds.includes('c'));
  assert.ok(!chunkIds.includes('a'));
  assert.equal(mixed[0].srs.introduced, true);
});

test('a late New folds the 25-min review into a sitting that stays on the plan', () => {
  const now = at(2026, 9, 4, 22, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: at(2026, 9, 5, 9, 0),
    terms: terms(20),
  });
  const host = plan.sittings.find((s) => s.includesShortRev);
  assert.ok(host);
  assert.equal(
    plan.foldNote,
    host.role === 'before_bed'
      ? 'The 25-min review is part of the before-bed sitting.'
      : 'The 25-min review is part of the first sitting.'
  );
  plan.sittings.forEach((s, i) => assert.equal(s.sitting, i + 1));
  assert.equal(plan.sittings.filter((s) => s.role === 'gap' && s.type === 'rev').length, 0);
  assert.ok(plan.sittings.includes(host));
  const early = generatePlan({
    now: at(2026, 9, 4, 16, 0),
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: at(2026, 9, 5, 9, 0),
    terms: terms(20),
  });
  assert.equal(early.foldNote, '');
  assert.equal(early.sittings[1].at - early.sittings[0].at, 25 * 60 * 1000);
});

function solidPair(start, gapMin, afterSleep = false) {
  return [
    { at: start, afterSleep: false },
    { at: start + gapMin * 60 * 1000, afterSleep },
  ];
}

test('a term locks only after two solid finishes far enough apart or across sleep', () => {
  const evening = at(2026, 9, 4, 20, 0);
  const close = {
    id: 'close',
    pile: 'solid',
    srs: { introduced: true, solidStreak: 2, solidFinishes: solidPair(evening, 20) },
  };
  const apart = {
    id: 'apart',
    pile: 'solid',
    srs: { introduced: true, solidStreak: 2, solidFinishes: solidPair(evening, 90) },
  };
  const slept = {
    id: 'slept',
    pile: 'solid',
    srs: {
      introduced: true,
      solidStreak: 2,
      solidFinishes: solidPair(at(2026, 9, 5, 7, 0), 20, true),
    },
  };
  assert.equal(termIsLocked(close), false);
  assert.equal(termIsLocked(apart), true);
  assert.equal(termIsLocked(slept), true);
  assert.equal(termIsLocked({ id: 'once', srs: { solidStreak: 1, solidFinishes: [{ at: evening, afterSleep: false }] } }), false);

  const first = applySittingResults([
    { id: 'a', srs: { introduced: true, solidStreak: 0, solidFinishes: [] } },
  ], { a: { missCount: 0, lastGrade: 'hit' } }, {
    at: at(2026, 9, 4, 22, 0),
    wakeTime: '07:00',
    sleepTime: '23:00',
  });
  const second = applySittingResults(first, { a: { missCount: 0, lastGrade: 'hit' } }, {
    at: at(2026, 9, 5, 7, 20),
    wakeTime: '07:00',
    sleepTime: '23:00',
  });
  assert.equal(second[0].srs.solidFinishes.length, 2);
  assert.equal(second[0].srs.solidFinishes[1].afterSleep, true);
  assert.equal(termIsLocked(second[0]), true);
  const sameEvening = applySittingResults(first, { a: { missCount: 0, lastGrade: 'hit' } }, {
    at: at(2026, 9, 4, 22, 20),
    wakeTime: '07:00',
    sleepTime: '23:00',
  });
  assert.equal(sameEvening[0].srs.solidFinishes[1].afterSleep, false);
  assert.equal(termIsLocked(sameEvening[0]), false);

  const cleared = applySittingResults(second, { a: { missCount: 2, lastGrade: 'hit' } }, {
    at: at(2026, 9, 5, 9, 0),
    wakeTime: '07:00',
    sleepTime: '23:00',
  });
  assert.equal(cleared[0].pile, 'shaky');
  assert.deepEqual(cleared[0].srs.solidFinishes, []);
  assert.equal(termIsLocked(cleared[0]), false);
});

test('middle sittings skip locked terms and the final pass keeps them', () => {
  const lockedFinishes = solidPair(at(2026, 9, 4, 12, 0), 120);
  const deck = [
    { id: 'locked', pile: 'solid', tier: 'critical', confidence: 'blank', srs: { introduced: true, solidStreak: 3, lastGrade: 'hit', solidFinishes: lockedFinishes } },
    { id: 'solidOnce', pile: 'solid', tier: 'core', confidence: 'know', srs: { introduced: true, solidStreak: 1, lastGrade: 'hit', solidFinishes: [{ at: at(2026, 9, 4, 16, 0), afterSleep: false }] } },
    { id: 'shakyLow', pile: 'shaky', tier: 'passive', confidence: 'know', srs: { introduced: true, solidStreak: 0, lastGrade: 'miss' } },
    { id: 'shakyHigh', pile: 'shaky', tier: 'critical', confidence: 'blank', srs: { introduced: true, solidStreak: 0, lastGrade: 'miss' } },
  ];
  const middle = describeReviewQueue(deck, { type: 'rev', role: 'gap' }, 8);
  assert.deepEqual(middle.queue.map((t) => t.id), ['shakyHigh', 'shakyLow', 'solidOnce']);
  assert.equal(middle.skipLine, "Skipping 1 term you've already locked in.");
  const morning = buildReviewQueue(deck, { type: 'rev_plus', role: 'morning', shakyOnly: true, fast: true }, 8);
  assert.ok(morning.some((t) => t.id === 'locked'));
  assert.equal(morning[0].id, 'shakyHigh');
  assert.equal(describeReviewQueue(deck, { type: 'rev_plus', role: 'morning' }, 8).skipLine, '');
  const overCap = introduced(10, 2).map((t, i) => ({
    ...t,
    srs: {
      ...t.srs,
      solidFinishes: solidPair(at(2026, 9, 4, 8, 0) + i, 120),
    },
  }));
  const shortMorning = buildReviewQueue(overCap, { role: 'morning', type: 'rev_plus', short: true }, 1);
  assert.equal(shortMorning.length, 10);
  const skipped = describeReviewQueue(overCap, { role: 'before_bed', type: 'rev' }, 1);
  assert.equal(skipped.queue.length, 0);
  assert.equal(skipped.skipLine, "Skipping 10 terms you've already locked in.");
});

test('review sittings are capped by time and leftovers roll forward', () => {
  const deck = introduced(40, 0).map((t) => ({ ...t, pile: 'shaky' }));
  const schedule = {
    hours: 3,
    termCount: 40,
    sittings: [
      { sitting: 1, type: 'rev', role: 'gap', at: 1 },
      { sitting: 2, type: 'rev', role: 'before_bed', at: 2 },
    ],
  };
  const first = describeSittingQueue(deck, { sittingIndex: 1, carryIds: [] }, schedule);
  assert.equal(first.queue.length, 22);
  assert.equal(first.leftoverIds.length, 18);
  const second = describeSittingQueue(deck, { sittingIndex: 2, carryIds: first.leftoverIds }, schedule);
  assert.equal(second.queue[0].id, first.leftoverIds[0]);
  assert.ok(second.queue.slice(0, 18).every((t, i) => t.id === first.leftoverIds[i]));
});

test('large decks split a core plan from an optional bonus pass', () => {
  const deck = Array.from({ length: 60 }, (_, i) => ({
    id: `t${i}`,
    tier: i < 5 ? 'critical' : i < 40 ? 'core' : 'passive',
    confidence: i % 5 === 0 ? 'blank' : 'know',
    pile: 'shaky',
    srs: { introduced: true, solidStreak: 0, lastGrade: 'miss' },
  }));
  const split = splitCorePlan(deck);
  assert.equal(split.large, true);
  assert.equal(split.coreIds.length + split.bonusIds.length, 60);
  assert.ok(split.bonusIds.length > 0);
  assert.ok(split.coreIds.length >= 27);
  assert.ok(split.coreIds.length < 60);
  deck.filter((t) => t.tier === 'critical').forEach((t) => {
    assert.ok(split.coreIds.includes(t.id));
  });
  const queue = buildReviewQueue(deck, { type: 'rev', role: 'gap' }, 4, { ...split });
  assert.ok(queue.length > 0 && queue.length <= 22);
  assert.ok(queue.every((t) => split.coreIds.includes(t.id)));
  const bonus = buildReviewQueue(deck, { role: 'bonus', type: 'rev' }, 4, { ...split, bonus: true });
  assert.ok(bonus.length > 0 && bonus.length <= 22);
  assert.ok(bonus.every((t) => split.bonusIds.includes(t.id)));
  const schedule = buildSpacedSchedule({
    terms: deck,
    hours: 4,
    sittings: [{ sitting: 1, type: 'new', role: 'start', at: 1 }],
  });
  const chunkIds = schedule.chunks.flatMap((c) => c.terms.map((t) => t.id));
  assert.ok(chunkIds.every((id) => split.coreIds.includes(id)));
  assert.equal(schedule.coreCount, split.coreIds.length);
  assert.equal(schedule.bonusCount, split.bonusIds.length);
});

function planBase(sittings, extra = {}) {
  return {
    phase: 'plan',
    stopTime: '23:00',
    wakeTime: '07:00',
    examTime: extra.examTime,
    sittingIndex: extra.sittingIndex || 1,
    sittings,
    lastFinishedAt: extra.lastFinishedAt || 0,
    coreOnly: false,
    ...extra,
  };
}

test('large decks give bonus terms a new exposure and a later review', () => {
  assert.equal(emptySpacedState().coreOnly, false);
  const now = at(2026, 9, 4, 14, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const deck = terms(60);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: deck,
  });
  const split = splitCorePlan(deck);
  assert.ok(plan.sittings.some((s) => s.type === 'new' && s.includesBonus));
  assert.ok(plan.sittings.some((s) => s.includesBonusReview && s.role !== 'morning'));
  assert.equal(plan.sittings.filter((s) => s.role === 'bonus').length, 0);
  const schedule = buildSpacedSchedule({
    terms: deck,
    hours: 4,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    now,
    sittings: plan.sittings,
    coreOnly: false,
  });
  const chunkIds = schedule.chunks.flatMap((c) => c.terms.map((t) => t.id));
  assert.ok(split.bonusIds.some((id) => chunkIds.includes(id)));
  assert.ok(split.coreIds.some((id) => chunkIds.includes(id)));
  const seen = new Set();
  let carry = [];
  for (const sitting of plan.sittings.filter((s) => s.type !== 'new')) {
    const built = describeReviewQueue(deck, sitting, 8, { ...split, coreOnly: false, carryIds: carry });
    assert.ok(built.queue.length <= 27);
    assert.ok(sittingEstimate(built.queue.length).minutes <= 10);
    built.queue.forEach((t) => {
      if (split.bonusIds.includes(t.id)) seen.add(t.id);
    });
    carry = built.leftoverIds;
  }
  assert.equal(seen.size, split.bonusIds.length);
  const coreOnly = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: deck,
    coreOnly: true,
  });
  assert.ok(coreOnly.sittings.every((s) => !s.includesBonus && !s.includesBonusReview));
});

test('an empty middle sitting is ready to auto-complete', () => {
  const locked = introduced(4, 2).map((t) => ({
    ...t,
    srs: { ...t.srs, solidFinishes: solidPair(at(2026, 9, 4, 8, 0), 120) },
  }));
  const sitting = { sitting: 2, type: 'rev', role: 'gap', done: false };
  const built = describeReviewQueue(locked, sitting, 4);
  assert.equal(built.queue.length, 0);
  assert.equal(shouldAutoComplete(sitting, built.queue.length), true);
  assert.equal(shouldAutoComplete({ ...sitting, role: 'morning' }, 0), false);
  assert.equal(AHEAD_LINE, "Nothing needed here. You're ahead of plan.");
});

test('overdue sittings stay available and earlier ones are not redone', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  const sittings = plan.sittings.map((s, i) => (i === 0 ? { ...s, done: true } : s));
  const due = plan.sittings[1].at;
  const opened = catchUpPlan(planBase(sittings, {
    examTime: exam,
    sittingIndex: 2,
    lastFinishedAt: now + 20 * 60 * 1000,
    nextDueAt: due,
  }), terms(20), currentTime(Date.now(), due + 20 * 60 * 1000));
  assert.equal(opened.welcomeLine, '');
  assert.equal(opened.sittingIndex, 2);
  assert.equal(opened.sittings[0].done, true);
  assert.equal(opened.sittings[0].sitting, 1);
  assert.equal(opened.sittings[1].at, plan.sittings[1].at);
  assert.equal(opened.nextDueAt, 0);
});

test('a 12 hour gap makes the next sitting a full review', () => {
  const now = at(2026, 9, 4, 14, 0);
  const exam = at(2026, 9, 5, 16, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  const sittings = plan.sittings.map((s, i) => (i === 0 ? { ...s, done: true } : s));
  const later = currentTime(Date.now(), now + 13 * 60 * 60 * 1000);
  const opened = catchUpPlan(planBase(sittings, {
    examTime: exam,
    sittingIndex: 2,
    lastFinishedAt: later - 60 * 60 * 1000,
    nextDueAt: later - 13 * 60 * 60 * 1000,
  }), terms(20), later);
  const next = opened.sittings.find((s) => s.sitting === opened.sittingIndex);
  assert.equal(next.fullRev, true);
  assert.equal(next.type, 'rev');
  assert.notEqual(opened.sittingIndex, 1);
  assert.equal(opened.sittings[0].sitting, 1);
  assert.equal(opened.sittings[0].done, true);
  assert.equal(opened.welcomeLine, welcomeBackLine(opened.sittings.filter((s) => !s.done).length));
  const locked = {
    id: 'locked',
    pile: 'solid',
    tier: 'core',
    confidence: 'know',
    srs: { introduced: true, solidStreak: 2, solidFinishes: solidPair(now, 120) },
  };
  const shaky = {
    id: 'shaky',
    pile: 'shaky',
    tier: 'critical',
    confidence: 'blank',
    srs: { introduced: true, solidStreak: 0, lastGrade: 'miss' },
  };
  const queue = buildReviewQueue([locked, shaky], next, 4);
  assert.ok(queue.some((t) => t.id === 'locked'));
  assert.equal(queue[0].id, 'shaky');
});

test('a skipped before-bed folds into the morning pass', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  const morningAfter = at(2026, 9, 5, 7, 10);
  const opened = catchUpPlan(planBase(plan.sittings, {
    examTime: exam,
    lastFinishedAt: now + 30 * 60 * 1000,
  }), terms(20), morningAfter);
  assert.ok(opened.sittings.filter((s) => !s.done).every((s) => s.role !== 'before_bed'));
  const morning = opened.sittings.find((s) => !s.done && s.foldedBed);
  assert.ok(morning);
  const shaky = { id: 'shaky', pile: 'shaky', tier: 'core', confidence: 'shaky', srs: { introduced: true, solidStreak: 0, lastGrade: 'miss' } };
  const solid = { id: 'solid', pile: 'solid', tier: 'core', confidence: 'know', srs: { introduced: true, solidStreak: 1, lastGrade: 'hit' } };
  const queue = buildReviewQueue([shaky, solid], morning, 4);
  assert.equal(queue[0].id, 'shaky');
  assert.ok(queue.some((t) => t.id === 'solid'));
  assert.match(opened.welcomeLine, /^Welcome back\. Updated your plan: \d+ sittings? left\.$/);
});

test('last look is a short shaky pass and plan complete waits for the exam', () => {
  const shaky = introduced(12, 0).map((t, i) => ({ ...t, pile: i < 12 ? 'shaky' : 'solid' }));
  const solid = { id: 'solid', pile: 'solid', tier: 'critical', confidence: 'blank', srs: { introduced: true, solidStreak: 1, lastGrade: 'hit' } };
  const look = lastLookQueue([...shaky, solid]);
  assert.ok(look.length > 0 && look.length <= 10);
  assert.ok(look.every((t) => t.pile === 'shaky'));
  const exam = at(2026, 9, 5, 9, 0);
  const done = catchUpPlan(planBase([{ sitting: 1, type: 'rev', role: 'morning', at: exam - 60 * 60 * 1000, done: true }], {
    examTime: exam,
    sittingIndex: 2,
    lastFinishedAt: exam - 2 * 60 * 60 * 1000,
  }), terms(4), exam - 30 * 60 * 1000);
  assert.equal(done.examOver, false);
  assert.notEqual(done.phase, 'complete');
  const after = catchUpPlan(done, terms(4), currentTime(Date.now(), exam + 60 * 1000));
  assert.equal(after.phase, 'complete');
  assert.equal(after.examOver, true);
  assert.equal(after.welcomeLine, '');
});

test('a skipped day becomes a tomorrow plan without resetting sitting numbers', () => {
  const now = at(2026, 9, 4, 14, 0);
  const exam = at(2026, 9, 6, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: introduced(30),
  });
  assert.ok(plan.sittings.some((s) => s.role === 'wake' || s.role === 'midday'));
  const sittings = plan.sittings.map((s, i) => (i === 0 ? { ...s, done: true } : s));
  const mondayEvening = at(2026, 9, 5, 20, 0);
  const opened = catchUpPlan(planBase(sittings, {
    examTime: exam,
    sittingIndex: 2,
    lastFinishedAt: now + 40 * 60 * 1000,
  }), introduced(30), mondayEvening);
  assert.equal(opened.sittings[0].sitting, 1);
  assert.equal(opened.sittings[0].done, true);
  assert.notEqual(opened.sittingIndex, 1);
  assert.ok(opened.sittingIndex > 1);
  assert.ok(opened.sittings.filter((s) => !s.done).every((s) => s.role !== 'wake' && s.role !== 'midday'));
  assert.ok(opened.sittings.every((s) => s.type !== 'new'));
  assert.equal(introduced(30)[0].srs.introduced, true);
  const again = catchUpPlan(opened, introduced(30), mondayEvening + 60 * 1000);
  assert.equal(again.sittings.length, opened.sittings.length);
  assert.equal(again.sittingIndex, opened.sittingIndex);
});

test('very little time leaves one prioritized pass', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  const sittings = plan.sittings.map((s, i) => (i === 0 ? { ...s, done: true } : s));
  const late = exam - 20 * 60 * 1000;
  const opened = catchUpPlan(planBase(sittings, {
    examTime: exam,
    sittingIndex: 2,
    lastFinishedAt: now + 30 * 60 * 1000,
  }), terms(20), late);
  const pending = opened.sittings.filter((s) => !s.done);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].prioritized, true);
  assert.notEqual(pending[0].sitting, 1);
  assert.equal(opened.sittings[0].done, true);
  const cards = [
    { id: 'shakyLow', pile: 'shaky', tier: 'passive', confidence: 'know', srs: { introduced: true, solidStreak: 0 } },
    { id: 'shakyHigh', pile: 'shaky', tier: 'critical', confidence: 'blank', srs: { introduced: true, solidStreak: 0 } },
    { id: 'solidHigh', pile: 'solid', tier: 'critical', confidence: 'blank', srs: { introduced: true, solidStreak: 1 } },
  ];
  const queue = buildReviewQueue(cards, pending[0], 1);
  assert.deepEqual(queue.map((t) => t.id), ['shakyHigh', 'shakyLow', 'solidHigh']);
});

test('changing times keeps completed sitting numbers', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  const sittings = plan.sittings.map((s, i) => (i < 2 ? { ...s, done: true } : s));
  const changed = changePlanTimes(planBase(sittings, {
    examTime: exam,
    sittingIndex: 3,
  }), terms(20), {
    sleepTime: '22:00',
    wakeTime: '06:30',
    examTime: at(2026, 9, 5, 10, 0),
    examClock: '10:00',
    now: now + 3 * 60 * 60 * 1000,
  });
  assert.equal(changed.sittings[0].sitting, 1);
  assert.equal(changed.sittings[0].done, true);
  assert.equal(changed.sittings[1].sitting, 2);
  assert.equal(changed.sittings[1].done, true);
  assert.notEqual(changed.sittingIndex, 1);
  assert.equal(changed.welcomeLine, '');
  assert.equal(changed.stopTime, '22:00');
  assert.equal(changed.wakeTime, '06:30');
  const merged = mergeKeptSittings(
    [{ sitting: 4, done: true, type: 'rev', role: 'gap', at: now }],
    [{ sitting: 1, type: 'rev', role: 'morning', at: exam - 90 * 60 * 1000 }],
    now
  );
  assert.equal(merged.sittingIndex, 5);
  assert.equal(merged.sittings[0].sitting, 4);
});

test('terms that were not in the sitting keep their streak', () => {
  const other = { id: 'b', pile: 'solid', srs: { introduced: true, solidStreak: 2, missCount: 0, lastGrade: 'hit' } };
  const [term] = applySittingResults([other], { a: { missCount: 0, lastGrade: 'hit' } });
  assert.equal(term, other);
});

test('a sitting overdue by 30 minutes rebuilds on the same day, and only once', () => {
  const now = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const plan = generatePlan({
    now,
    sleepTime: '23:00',
    wakeTime: '07:00',
    examTime: exam,
    terms: terms(20),
  });
  const due = plan.sittings[1].at;
  const late = currentTime(Date.now(), due + 40 * 60 * 1000);
  const sittings = plan.sittings.map((s, i) => (i === 0 ? { ...s, done: true } : s));
  const opened = catchUpPlan(planBase(sittings, {
    examTime: exam,
    sittingIndex: 2,
    lastFinishedAt: due - 20 * 60 * 1000,
    nextDueAt: due,
  }), terms(20), late);
  assert.notEqual(opened.welcomeLine, '');
  assert.equal(opened.sittings[0].done, true);
  assert.equal(opened.sittings[0].sitting, 1);
  assert.notEqual(opened.sittingIndex, 1);
  const again = catchUpPlan(opened, terms(20), late);
  assert.equal(again.sittings.length, opened.sittings.length);
  assert.equal(again.sittingIndex, opened.sittingIndex);
  assert.equal(again.catchUpKey, opened.catchUpKey);
});

test('a long sleep does not trigger a full review', () => {
  const evening = at(2026, 9, 4, 18, 0);
  const due = at(2026, 9, 5, 7, 30);
  const exam = at(2026, 9, 5, 11, 0);
  const wakeUp = currentTime(Date.now(), at(2026, 9, 5, 8, 0));
  const sittings = [
    { sitting: 1, type: 'rev', role: 'before_bed', at: evening, done: true },
    { sitting: 2, type: 'rev_plus', role: 'morning', at: due, done: false },
  ];
  const opened = catchUpPlan(planBase(sittings, {
    examTime: exam,
    sittingIndex: 2,
    lastFinishedAt: evening,
    nextDueAt: due,
  }), terms(12), wakeUp);
  assert.ok(wakeUp - evening > 12 * 60 * 60 * 1000);
  assert.ok(opened.sittings.filter((s) => !s.done).every((s) => !s.fullRev));
});

test('last look updates shaky state without counting as a sitting', () => {
  const finishes = solidPair(at(2026, 9, 4, 8, 0), 120);
  const term = {
    id: 'a',
    term: 'Alpha',
    pile: 'solid',
    srs: { introduced: true, solidStreak: 2, lastGrade: 'hit', solidFinishes: finishes, missCount: 0 },
  };
  const missed = applyLastLookResults([term], { a: { missCount: 1, lastGrade: 'miss' } })[0];
  assert.equal(missed.pile, 'shaky');
  assert.equal(missed.srs.lastGrade, 'miss');
  assert.equal(missed.srs.solidStreak, 2);
  assert.deepEqual(missed.srs.solidFinishes, finishes);
  const hit = applyLastLookResults([missed], { a: { missCount: 0, lastGrade: 'hit' } })[0];
  assert.equal(hit.pile, 'shaky');
  assert.equal(hit.srs.lastGrade, 'hit');
  assert.equal(hit.srs.solidStreak, 2);
  assert.deepEqual(hit.srs.solidFinishes, finishes);
});

test('leaving mid-sitting keeps only uncleared terms', () => {
  const left = unclearedIds(['a', 'b', 'c'], {
    a: { lastGrade: 'hit', missCount: 0 },
    b: { lastGrade: 'miss', missCount: 1 },
  });
  assert.deepEqual(left, ['b', 'c']);
  const deck = ['a', 'b', 'c'].map((id) => ({ id, term: id, srs: { introduced: true } }));
  const built = describeSittingQueue(deck, {
    sittingIndex: 2,
    resumeSitting: 2,
    resumeIds: left,
    pendingCarry: [],
  }, {
    sittings: [{ sitting: 2, type: 'rev', role: 'gap', done: false, at: 1 }],
    hours: 4,
  });
  assert.deepEqual(built.queue.map((t) => t.id), ['b', 'c']);
  assert.equal(pickupLine(left.length), 'Picking up where you left off (2 left).');
});

test('progress copy is a plain shaky delta with a wait countdown', () => {
  assert.equal(shakyDelta(11, 5), 'Shaky: 11 -> 5');
  assert.equal(WAIT_WHY, 'Your memory needs this gap to stick');
  assert.equal(START_EARLY_LINE, "Fine to start early. It'll feel easier than it really is.");
  assert.equal(offerReminder(1), true);
  assert.equal(offerReminder(2), false);
  const due = at(2026, 9, 5, 8, 0);
  assert.equal(countdownLabel(due, due - (90 * 60 + 5) * 1000), '1:30:05');
  const glance = planEndGlance([
    { term: 'Kept', pile: 'shaky', srs: { introduced: true } },
    { term: 'Calm', pile: 'solid', srs: { introduced: true } },
    { term: 'New', pile: 'shaky', srs: { introduced: false } },
  ]);
  assert.deepEqual(glance, { solid: 1, shaky: 1, shakyTerms: ['Kept'] });
  assert.equal(sittingEstimate(22).line, '~8 min, 22 cards');
  assert.equal(recapCopy({ sittingNumber: 1, learned: 12, shakyAfter: 4 }).text, '12 learned, 4 shaky');
  assert.equal(recapCopy({ sittingNumber: 1, learned: 12, shakyAfter: 4 }).text.includes('->'), false);
  assert.equal(recapCopy({ sittingNumber: 2, shakyBefore: 11, shakyAfter: 5 }).text, 'Shaky: 11 -> 5');
  assert.equal(
    recapCopy({ sittingNumber: 2, shakyBefore: 5, shakyAfter: 8 }).text,
    'Some slipping overnight is normal. This pass is what fixes it.'
  );
  assert.equal(reminderMode({ native: true, canNotify: false }), 'native');
  assert.equal(reminderMode({ native: false, canNotify: true }), 'web');
  assert.equal(reminderMode({ native: false, canNotify: false }), 'off');
  assert.equal(shouldPersistSession({ clockAt: null, clockOffset: 0 }), true);
  assert.equal(shouldPersistSession({ clockAt: at(2026, 9, 5, 8, 0), clockOffset: 0 }), false);
  assert.equal(shouldPersistSession({ clockAt: null, clockOffset: 60000 }), false);
});

test('the morning pass keeps shaky first and caps locked terms at 12', () => {
  const shaky = {
    id: 'shaky',
    term: 'Shaky',
    pile: 'shaky',
    tier: 'critical',
    confidence: 'blank',
    srs: { introduced: true, solidStreak: 0, lastGrade: 'miss' },
  };
  const locked = Array.from({ length: 60 }, (_, i) => ({
    id: `l${i}`,
    term: `Locked ${i}`,
    pile: 'solid',
    tier: 'core',
    confidence: 'know',
    srs: {
      introduced: true,
      solidStreak: i < 12 ? 1 : 4,
      lastGrade: 'hit',
      solidFinishes: solidPair(at(2026, 9, 1, 8, 0) + i * 60 * 1000, 120),
    },
  }));
  const queue = buildReviewQueue([shaky, ...locked], { role: 'morning', type: 'rev_plus' }, 8);
  assert.equal(queue[0].id, 'shaky');
  assert.deepEqual(queue.slice(1).map((t) => t.id), Array.from({ length: 12 }, (_, i) => `l${i}`));
});

test('a dropped half-finished queue records the cleared grades', () => {
  const due = at(2026, 9, 4, 16, 0);
  const exam = at(2026, 9, 5, 9, 0);
  const late = currentTime(Date.now(), due + 40 * 60 * 1000);
  const deck = introduced(4, 1);
  const prev = planBase([{ sitting: 1, type: 'rev', role: 'gap', at: due, done: false }], {
    examTime: exam,
    sittingIndex: 1,
    nextDueAt: due,
    resumeIds: ['t1', 't2'],
    resumeSitting: 50,
    pendingGrades: { t0: { missCount: 0, lastGrade: 'hit' } },
  });
  const next = catchUpPlan(prev, deck, late);
  const settled = settleResume(next, prev, deck, late);
  assert.equal(settled.spaced.resumeIds.length, 0);
  assert.deepEqual(settled.spaced.pendingGrades, {});
  const cleared = settled.terms.find((t) => t.id === 't0');
  assert.equal(cleared.pile, 'solid');
  assert.equal(cleared.srs.solidStreak, 2);
  assert.equal(cleared.srs.lastGrade, 'hit');
  assert.equal(settled.terms.find((t) => t.id === 't1').srs.solidStreak, 1);
});

test('partly counts as shaky and a saved attempt shows only after a miss', () => {
  const bucket = {};
  recordAttempt(bucket, 'a', 'partly');
  assert.equal(bucket.a.lastGrade, 'miss');
  assert.equal(sittingEndedShaky(bucket.a), true);
  const [term] = applySittingResults(
    [{ id: 'a', pile: 'solid', srs: { introduced: true, solidStreak: 2, lastGrade: 'hit' } }],
    bucket
  );
  assert.equal(term.pile, 'shaky');
  assert.equal(term.srs.solidStreak, 0);
  assert.equal(savedAttemptForMiss({ srs: { lastGrade: 'hit' }, freeAttempt: 'old' }), '');
  assert.equal(savedAttemptForMiss({ srs: { lastGrade: 'miss' }, freeAttempt: ' mitochondria ' }), 'mitochondria');
});
