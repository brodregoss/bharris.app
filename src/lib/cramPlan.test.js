import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STUDY_MODE,
  buildCramPlan,
  continueStudyPath,
  firstLookAtTerms,
  normalizeStudyMode,
  rankModeSkimHint,
  recallTermCap,
  redoDeckPlan,
  sessionBudgetMs,
  RANK_MODE,
} from './studyUtils.js';

test('skim hints stay one short line', () => {
  const importance = rankModeSkimHint(RANK_MODE.IMPORTANCE);
  const difficulty = rankModeSkimHint(RANK_MODE.DIFFICULTY);
  assert.match(importance, /Must know/);
  assert.match(difficulty, /Hardest first/);
  assert.equal(importance.includes('Scroll through'), false);
  assert.equal(difficulty.includes('Scroll through'), false);
});

test('write-your-own-def stays hidden until a term has been seen', () => {
  assert.equal(firstLookAtTerms([{ id: 'a', seen: false, recallHistory: [] }]), true);
  assert.equal(firstLookAtTerms([{ id: 'a', seen: true }]), false);
  assert.equal(firstLookAtTerms([{ id: 'a', recallHistory: [{ result: 'missed' }] }]), false);
  assert.equal(firstLookAtTerms([{ id: 'a', ownDefinition: 'in my words' }]), false);
});

test('self practice continues on the practice page', () => {
  assert.equal(normalizeStudyMode(STUDY_MODE.SELF_PRACTICE), STUDY_MODE.SELF_PRACTICE);
  assert.equal(continueStudyPath({ studyMode: STUDY_MODE.SELF_PRACTICE }), '/practice');
  assert.equal(continueStudyPath({ studyMode: STUDY_MODE.ASSISTED }), '/study');
  assert.equal(continueStudyPath({ studyMode: STUDY_MODE.TRUE_CRAM }), '/true-cram');
  assert.equal(continueStudyPath({ studyMode: STUDY_MODE.SPACED_CRAM, examTiming: 'tomorrow' }), '/spaced-cram');
});

test('assisted plan names how many terms actually get reps', () => {
  const hours = 0.75;
  const count = 30;
  const plan = buildCramPlan({
    studyMode: STUDY_MODE.ASSISTED,
    hours,
    termCount: count,
    examType: 'multiple_choice',
    examTiming: 'today',
    title: 'Bio',
  });
  const drill = Math.min(count, recallTermCap(hours));
  assert.equal(plan.subject, 'Bio');
  assert.match(plan.facts.join(' '), /45 min/);
  assert.match(plan.lines[1], new RegExp(`${drill} of ${count}`));
  assert.match(plan.lines[2], /multiple-choice/);
  assert.equal(plan.lines.some((line) => /grade it yourself/i.test(line)), false);
});

test('short-answer assisted plan tells them to grade it', () => {
  const plan = buildCramPlan({
    studyMode: STUDY_MODE.ASSISTED,
    hours: 2,
    termCount: 8,
    examType: 'short_answer',
    examTiming: 'today',
  });
  assert.match(plan.lines.join(' '), /grade it yourself/i);
  assert.match(plan.lines[1], /All 8 terms/);
});

test('true cram plan is a partner pass through the set', () => {
  const plan = buildCramPlan({
    studyMode: STUDY_MODE.TRUE_CRAM,
    hours: 3,
    termCount: 80,
    examType: 'mixed',
    examTiming: 'today',
  });
  assert.match(plan.lines.join(' '), /partner/);
  assert.match(plan.lines.join(' '), /second pass/);
  assert.equal(plan.lines.join(' ').includes('sitting'), true);
});

test('spaced plan is short sittings until the exam', () => {
  const plan = buildCramPlan({
    studyMode: STUDY_MODE.SPACED_CRAM,
    hours: 4,
    termCount: 40,
    examType: 'short_answer',
    examTiming: 'tomorrow',
  });
  assert.match(plan.facts.join(' '), /tomorrow/);
  assert.match(plan.lines.join(' '), /Short sittings/);
  assert.match(plan.lines.join(' '), /10 minutes/);
  assert.match(plan.lines.join(' '), /grade the written answers yourself/);
});

test('a short cram counts down the time they set', () => {
  assert.equal(sessionBudgetMs(5 / 60), 5 * 60 * 1000);
  assert.equal(sessionBudgetMs(2), 2 * 3600 * 1000);
  assert.equal(sessionBudgetMs(0), 3600 * 1000);
  assert.equal(sessionBudgetMs(undefined), 3600 * 1000);
});

test('a short hard-term redo asks for enough extras to avoid a tiny loop', () => {
  const many = redoDeckPlan(['a'], ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(many.ask, true);
  assert.equal(many.required, 3);
  assert.deepEqual(many.lockedIds, ['a']);

  const enough = redoDeckPlan(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(enough.ask, false);
  assert.deepEqual(enough.startIds, ['a', 'b', 'c', 'd', 'e']);

  const noChoice = redoDeckPlan(['a', 'b'], ['a', 'b', 'c', 'd']);
  assert.equal(noChoice.ask, false);
  assert.deepEqual(noChoice.startIds, ['a', 'b', 'c', 'd']);

  const tiny = redoDeckPlan(['a'], ['a', 'b']);
  assert.equal(tiny.ask, false);
  assert.deepEqual(tiny.startIds, ['a', 'b']);

  const noneHard = redoDeckPlan([], ['a', 'b', 'c', 'd', 'e']);
  assert.equal(noneHard.ask, true);
  assert.equal(noneHard.required, 4);
});
