import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountAge,
  assessAge,
  normalizeReferral,
  showsGuardianPrompt,
} from './age.js';

const NOW = new Date(Date.UTC(2026, 9, 18));

test('birthday gate blocks under 13 and asks 13 to 17 for permission', () => {
  assert.equal(assessAge('', { now: NOW }).message, 'Enter your birthday.');
  assert.equal(assessAge('2013-02-31', { now: NOW }).code, 'invalid');
  assert.equal(assessAge('2026-10-19', { now: NOW }).code, 'invalid');
  assert.equal(assessAge('1900-01-01', { now: NOW }).code, 'invalid');

  const child = assessAge('2013-10-19', { now: NOW });
  assert.equal(child.code, 'under_13');
  assert.equal(child.age, 12);

  const teen = assessAge('2013-10-18', { now: NOW });
  assert.equal(teen.code, 'guardian');
  assert.equal(teen.age, 13);
  assert.equal(showsGuardianPrompt('2008-10-19', NOW), true);

  const permitted = assessAge('2008-10-19', { guardianConsent: true, now: NOW });
  assert.equal(permitted.ok, true);
  assert.equal(permitted.band, 'teen');

  const adult = assessAge('2008-10-18', { now: NOW });
  assert.equal(adult.ok, true);
  assert.equal(adult.band, 'adult');
  assert.equal(adult.age, 18);
});

test('a stored birthday stays valid after the teen turns 18', () => {
  assert.deepEqual(
    accountAge({ birth_date: '2008-10-19', guardian_consent_at: '2026-01-01T00:00:00.000Z' }, NOW),
    { status: 'ok', band: 'teen' },
  );
  assert.deepEqual(
    accountAge({ birth_date: '2008-10-19', guardian_consent_at: '2026-01-01T00:00:00.000Z' }, new Date(Date.UTC(2026, 9, 19))),
    { status: 'ok', band: 'adult' },
  );
  assert.deepEqual(accountAge({ birth_date: '' }, NOW), { status: 'missing', band: '' });
  assert.equal(normalizeReferral(' TikTok '), 'tiktok');
  assert.equal(normalizeReferral('email blast'), '');
});
