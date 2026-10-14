import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXTRACT_CALL_MS,
  DEFINE_CALL_MS,
  addExtractPass,
  formatExtractRemaining,
  planDefinitions,
  playWhileWorking,
  snapshotExtractProgress,
  startExtractProgress,
} from '../src/lib/extractProgress.js';

test('one photo starts with one read and one definition batch', () => {
  const state = startExtractProgress(1, 0);
  assert.equal(state.expectedMs, EXTRACT_CALL_MS + DEFINE_CALL_MS);
  const snap = snapshotExtractProgress(state, 9000);
  assert.equal(snap.remainingMs, EXTRACT_CALL_MS + DEFINE_CALL_MS - 9000);
  assert.ok(snap.fraction > 0.3 && snap.fraction < 0.4);
});

test('the bar does not jump backward when another read is needed', () => {
  const state = startExtractProgress(1, 0);
  const first = snapshotExtractProgress(state, 9000);
  const longer = addExtractPass(state);
  const second = snapshotExtractProgress(longer, 9000);
  assert.ok(second.fraction >= first.fraction);
  assert.ok(second.remainingMs > first.remainingMs);
});

test('more definition batches extend the remaining time', () => {
  let state = startExtractProgress(1, 0);
  state = planDefinitions(state, 30, 20000);
  assert.equal(state.expectedMs, 20000 + 3 * DEFINE_CALL_MS);
  const snap = snapshotExtractProgress(state, 20000);
  assert.equal(snap.remainingMs, 3 * DEFINE_CALL_MS);
});

test('remaining copy describes the notes, not the ad', () => {
  assert.equal(formatExtractRemaining(null), 'Reading your notes…');
  assert.equal(formatExtractRemaining(19000), 'About 19 seconds until your notes are ready');
  assert.equal(formatExtractRemaining(3000), 'Your notes are almost ready');
  assert.equal(formatExtractRemaining(60000), 'About 1 minute until your notes are ready');
});

test('ads keep playing until the notes finish, past a second ad', async () => {
  const full = [];
  let working = true;
  await playWhileWorking(() => working, async () => {
    full.push('ad');
    if (full.length === 3) working = false;
    return true;
  });
  assert.deepEqual(full, ['ad', 'ad', 'ad']);

  const stopped = [];
  working = true;
  await playWhileWorking(() => working, async () => {
    stopped.push('ad');
    working = false;
    return true;
  });
  assert.deepEqual(stopped, ['ad']);

  const closed = [];
  await playWhileWorking(() => true, async () => {
    closed.push('ad');
    return false;
  });
  assert.deepEqual(closed, ['ad']);
});
