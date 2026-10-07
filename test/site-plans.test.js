import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutDestination, planMarks } from '../scripts/plan-marks.js';
import {
  canCancelWebsitePlan,
  cancelPlanNote,
  cancelPlanQuestion,
  managePlanLines,
  ownsWebsitePlan,
  planPriceLabel,
  trialRemainingLabel,
} from '../scripts/account-plan.js';
import { safeAuthReturn } from '../src/lib/authReturn.js';

test('a beta code opens the thank you page instead of Stripe checkout', () => {
  assert.equal(checkoutDestination('solo', { granted: true, trialDays: 7 }), '/thanks/');
  assert.equal(
    checkoutDestination('partner', { granted: true, user: { billingPlan: 'partner' } }),
    '/thanks/?plan=partner',
  );
  assert.equal(
    checkoutDestination('solo', { url: 'https://checkout.stripe.com/c/pay_123' }),
    'https://checkout.stripe.com/c/pay_123',
  );
  assert.equal(checkoutDestination('solo', {}), '');
});

test('a signed-out visitor has no current plan', () => {
  const marks = planMarks({ billingPlan: 'solo', subscriptionTier: 'pro' }, false);
  assert.equal(marks.currentStudy, false);
  assert.equal(marks.currentPartner, false);
});

test('Study and Partner study are marked current for the plan that was purchased', () => {
  assert.deepEqual(planMarks({ billingPlan: 'solo' }, true), {
    currentStudy: true,
    currentPartner: false,
  });
  assert.deepEqual(planMarks({ billingPlan: 'partner' }, true), {
    currentStudy: false,
    currentPartner: true,
  });
  assert.deepEqual(planMarks({ billingPlan: 'guest' }, true), {
    currentStudy: false,
    currentPartner: true,
  });
  assert.deepEqual(planMarks({ subscriptionTier: 'pro' }, true), {
    currentStudy: false,
    currentPartner: false,
  });
});

test('a free account is not marked current', () => {
  assert.deepEqual(planMarks({ billingPlan: '', subscriptionTier: 'free' }, true), {
    currentStudy: false,
    currentPartner: false,
  });
});

test('a website plan can be canceled from the account', () => {
  const study = {
    billingPlan: 'solo',
    subscriptionStatus: 'active',
    periodEndsAt: '2026-04-06T18:00:00.000Z',
  };
  assert.equal(canCancelWebsitePlan(study), true);
  assert.equal(cancelPlanNote(study), '');
  assert.match(cancelPlanQuestion(study), /^Cancel Study\?/);
  assert.match(cancelPlanQuestion(study), /won't be billed again/);

  const partner = { ...study, billingPlan: 'partner' };
  assert.match(cancelPlanQuestion(partner), /^Cancel Partner study\?/);
  assert.match(cancelPlanQuestion(partner), /friend loses access/);
});

test('a plan already set to end stays open until that date', () => {
  const user = {
    billingPlan: 'partner',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: true,
    periodEndsAt: '2026-04-06T18:00:00.000Z',
  };
  assert.equal(canCancelWebsitePlan(user), false);
  assert.match(cancelPlanNote(user), /won't be billed again/);
  assert.match(cancelPlanNote(user), /friend loses access/);
});

test('the manage page says when a plan bills next and how long a trial lasts', () => {
  const trial = {
    billingPlan: 'solo',
    subscriptionStatus: 'trialing',
    trialEndsAt: '2026-04-12T18:00:00.000Z',
    periodEndsAt: '2026-04-12T18:00:00.000Z',
  };
  const lines = managePlanLines(trial);
  assert.match(lines[0], /free trial/);
  assert.match(lines.join(' '), /You'll be billed on/);
  assert.match(trialRemainingLabel('2099-01-02T18:00:00.000Z'), /free trial/);

  const partner = {
    billingPlan: 'partner',
    subscriptionStatus: 'active',
    periodEndsAt: '2026-05-01T18:00:00.000Z',
  };
  assert.match(managePlanLines(partner).join(' '), /Next billing date/);
  assert.match(managePlanLines(partner).join(' '), /friend/);
});

test('a beta week shows the time left and cancel ends it now', () => {
  const user = {
    billingPlan: 'partner',
    billingPromo: 'beta',
    subscriptionStatus: 'trialing',
    trialEndsAt: '2099-01-08T18:00:00.000Z',
    periodEndsAt: '2099-01-08T18:00:00.000Z',
  };
  const lines = managePlanLines(user).join(' ');
  assert.match(lines, /free trial/);
  assert.match(lines, /won't be charged/);
  assert.match(lines, /free week for you and your friend/);
  assert.match(cancelPlanQuestion(user), /free week ends now/);
  assert.match(cancelPlanQuestion(user), /friend loses access/);
  assert.equal(canCancelWebsitePlan(user), true);
});

test('Study without a website bill explains where to cancel', () => {
  const lines = managePlanLines({ billingPlan: '', subscriptionTier: 'pro' });
  assert.match(lines.join(' '), /not billed on the website/);
  assert.match(lines.join(' '), /Apple ID/);
});

test('website plan prices show only for the account that pays', () => {
  assert.equal(planPriceLabel({ billingPlan: 'solo' }), '$8 / month');
  assert.equal(planPriceLabel({ billingPlan: 'partner' }), '$12 / month');
  assert.equal(planPriceLabel({ billingPlan: 'guest' }), '');
  assert.equal(ownsWebsitePlan({ billingPlan: 'solo' }), true);
  assert.equal(ownsWebsitePlan({ billingPlan: 'partner' }), true);
  assert.equal(ownsWebsitePlan({ billingPlan: 'guest' }), false);
  assert.equal(ownsWebsitePlan({ subscriptionTier: 'pro' }), false);
});

test('a free account and a guest cannot cancel the plan', () => {
  assert.equal(canCancelWebsitePlan({ billingPlan: '', subscriptionTier: 'free' }), false);
  assert.equal(canCancelWebsitePlan({ billingPlan: 'guest', subscriptionStatus: 'active' }), false);
  assert.equal(cancelPlanNote({ billingPlan: 'guest', cancelAtPeriodEnd: true }), '');
});

test('sign-in returns only to a page on this site', () => {
  assert.equal(safeAuthReturn('/'), '/');
  assert.equal(safeAuthReturn('/plans'), '/plans/');
  assert.equal(safeAuthReturn('/manage'), '/manage/');
  assert.equal(safeAuthReturn('/account'), '/account/');
  assert.equal(safeAuthReturn('/privacy/'), '/privacy/');
  assert.equal(safeAuthReturn('/terms'), '/terms/');
  assert.equal(safeAuthReturn('/thanks/'), '/thanks/');
  assert.equal(safeAuthReturn('/contact'), '/contact/');
  assert.equal(safeAuthReturn('/thanks/?plan=partner'), '/thanks/?plan=partner');
  assert.equal(safeAuthReturn('/thanks/?plan=solo'), '');
  assert.equal(safeAuthReturn('https://evil.example'), '');
  assert.equal(safeAuthReturn('//evil.example'), '');
  assert.equal(safeAuthReturn('/plans/?next=https://evil.example'), '');
});
