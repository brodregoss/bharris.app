import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPoint, normalizeIncoming } from '../worker/src/events.js';

test('the app can log the funnel events and not a fake purchase', () => {
  assert.equal(normalizeIncoming({ name: 'cram_started', feature: 'true_cram', detail: 'sess-1' }).name, 'cram_started');
  assert.equal(normalizeIncoming({ name: 'cap_hit', feature: 'extract' }).feature, 'extract');
  assert.equal(normalizeIncoming({ name: 'pass_bought' }).error, 'Unknown event.');
  assert.equal(normalizeIncoming({ name: 'cram_started', detail: 'notes about mitochondria' }).detail, 'notesaboutmitochondria');
});

test('a dashboard point names the event and keeps token counts', () => {
  assert.deepEqual(analyticsPoint({ name: 'cap_hit', feature: 'extract' }), {
    indexes: ['cap_hit'],
    blobs: ['cap_hit', 'extract'],
    doubles: [1],
  });
  assert.deepEqual(analyticsPoint({
    name: 'ai_tokens',
    feature: 'grade',
    doubles: [10, 4, 14],
  }), {
    indexes: ['ai_tokens'],
    blobs: ['ai_tokens', 'grade'],
    doubles: [10, 4, 14],
  });
});
