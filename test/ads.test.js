import test from 'node:test';
import assert from 'node:assert/strict';
import { adsEnabledFor } from '../src/lib/adAccess.js';

test('free accounts see ads', () => {
  assert.equal(adsEnabledFor(null), true);
  assert.equal(adsEnabledFor({}), true);
  assert.equal(adsEnabledFor({ billingPlan: '', subscriptionTier: 'free' }), true);
});

test('paid accounts skip ads', () => {
  assert.equal(adsEnabledFor({ billingPlan: 'solo' }), false);
  assert.equal(adsEnabledFor({ billingPlan: 'partner' }), false);
  assert.equal(adsEnabledFor({ billingPlan: 'guest' }), false);
  assert.equal(adsEnabledFor({ subscriptionTier: 'pro' }), false);
});
