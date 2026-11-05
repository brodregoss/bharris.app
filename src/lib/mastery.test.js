import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTERY,
  bumpFromPractice,
  cramGroupsAfterMastery,
  practiceBand,
  seedCramMastery,
} from './mastery.js';

test('cram seed matches the known and work split', () => {
  const seeded = seedCramMastery(
    [
      { id: 'missed', mastery: 0 },
      { id: 'known-low', mastery: 1 },
      { id: 'known-solid', mastery: 3 },
      { id: 'flagged-solid', mastery: 4 },
      { id: 'flagged-middle', mastery: 2 },
    ],
    { flaggedTermIds: ['missed', 'flagged-solid', 'flagged-middle'], coveredIds: ['missed', 'known-low', 'known-solid', 'flagged-solid', 'flagged-middle'] }
  );
  const byId = Object.fromEntries(seeded.map((term) => [term.id, term.mastery]));
  assert.equal(byId.missed, MASTERY.NONE);
  assert.equal(byId['known-low'], MASTERY.SOLID);
  assert.equal(byId['known-solid'], MASTERY.SOLID);
  assert.equal(byId['flagged-solid'], MASTERY.GUESS);
  assert.equal(byId['flagged-middle'], MASTERY.PARTIAL);
});

test('one correct answer steps a term up a single list', () => {
  const flagged = ['alpha'];
  const covered = ['alpha', 'beta'];

  const afterFirst = bumpFromPractice(MASTERY.GUESS, { correct: true });
  assert.equal(afterFirst, MASTERY.PARTIAL);
  assert.equal(practiceBand(afterFirst), 'middle');
  const stillWorking = cramGroupsAfterMastery(flagged, covered, 'alpha', afterFirst);
  assert.deepEqual(stillWorking.flaggedTermIds, ['alpha']);

  const afterSecond = bumpFromPractice(afterFirst, { correct: true });
  assert.equal(afterSecond, MASTERY.SOLID);
  assert.equal(practiceBand(afterSecond), 'known');
  const known = cramGroupsAfterMastery(stillWorking.flaggedTermIds, stillWorking.coveredIds, 'alpha', afterSecond);
  assert.deepEqual(known.flaggedTermIds, []);

  const dropped = bumpFromPractice(MASTERY.SOLID, { correct: false });
  assert.equal(practiceBand(dropped), 'middle');
  const back = cramGroupsAfterMastery(known.flaggedTermIds, known.coveredIds, 'beta', dropped);
  assert.deepEqual(back.flaggedTermIds, ['beta']);
  assert.ok(back.coveredIds.includes('beta'));
});

test('explain-it can mark a term known or send it back to work', () => {
  const known = cramGroupsAfterMastery(['alpha'], ['alpha'], 'alpha', MASTERY.SOLID);
  assert.deepEqual(known.flaggedTermIds, []);

  const work = cramGroupsAfterMastery(known.flaggedTermIds, known.coveredIds, 'alpha', MASTERY.GUESS);
  assert.deepEqual(work.flaggedTermIds, ['alpha']);
});
