import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_FRESH_MS,
  billingCheckedRecently,
  shouldAwaitBilling,
} from '../worker/src/stripeBilling.js';

const now = Date.parse('2026-10-07T17:00:00.000Z');

test('a recent billing check is reused', () => {
  const row = { billing_checked_at: new Date(now - 60_000).toISOString() };
  assert.equal(billingCheckedRecently(row, now), true);
  assert.equal(billingCheckedRecently(row, now, 15_000), false);
});

test('opening an account does not wait on Stripe', () => {
  assert.equal(shouldAwaitBilling({ billing_plan: '' }, { fresh: false, now }), false);
  assert.equal(
    shouldAwaitBilling({ billing_plan: 'solo', billing_checked_at: '' }, { fresh: true, now }),
    false,
  );
});

test('a checkout return waits once when the plan is not on file yet', () => {
  const row = { billing_plan: '', subscription_tier: 'free' };
  assert.equal(shouldAwaitBilling(row, { fresh: true, now }), true);
  const checked = { ...row, billing_checked_at: new Date(now - 5_000).toISOString() };
  assert.equal(shouldAwaitBilling(checked, { fresh: true, now }), false);
  const stale = { ...row, billing_checked_at: new Date(now - BILLING_FRESH_MS - 1000).toISOString() };
  assert.equal(billingCheckedRecently(stale, now), false);
});
