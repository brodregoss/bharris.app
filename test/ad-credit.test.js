import test from 'node:test';
import assert from 'node:assert/strict';
import { AD_CREDIT_CALLS, adCreditGrant } from '../worker/src/adCredit.js';

test('a used-up free account gets 10 AI calls', () => {
  const grant = adCreditGrant({
    subscription_tier: 'free',
    billing_plan: '',
    ai_quota_used: 5,
    ai_quota_limit: 5,
  });
  assert.equal(AD_CREDIT_CALLS, 10);
  assert.equal(grant.ok, true);
  assert.equal(grant.granted, 10);
  assert.equal(grant.used, 5);
  assert.equal(grant.limit, 15);
});

test('an account that still has calls is not given another', () => {
  const grant = adCreditGrant({
    subscription_tier: 'free',
    billing_plan: '',
    ai_quota_used: 2,
    ai_quota_limit: 5,
  });
  assert.equal(grant.granted, 0);
  assert.equal(grant.used, 2);
});

test('paid plans do not get a credit from an ad', () => {
  for (const row of [
    { subscription_tier: 'pro', billing_plan: 'solo', ai_quota_used: 30, ai_quota_limit: 30 },
    { subscription_tier: 'free', billing_plan: 'partner', ai_quota_used: 30, ai_quota_limit: 30 },
    { subscription_tier: 'free', billing_plan: 'guest', ai_quota_used: 30, ai_quota_limit: 30 },
  ]) {
    const grant = adCreditGrant(row);
    assert.equal(grant.ok, false);
    assert.equal(grant.status, 403);
  }
});
