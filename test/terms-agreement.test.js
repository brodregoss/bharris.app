import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAskForTerms } from '../src/lib/termsAgreement.js';

test('an account that already agreed is not asked again', () => {
  assert.equal(shouldAskForTerms({ termsAccepted: true }), false);
  assert.equal(shouldAskForTerms({ termsAccepted: true, deviceAccepted: false }), false);
});

test('a device that already agreed is not asked again', () => {
  assert.equal(shouldAskForTerms({ termsAccepted: false, deviceAccepted: true }), false);
});

test('a new account that has not agreed is asked once', () => {
  assert.equal(shouldAskForTerms({ termsAccepted: false, deviceAccepted: false }), true);
});

test('an unknown account is left alone until the server answers', () => {
  assert.equal(shouldAskForTerms({}), false);
  assert.equal(shouldAskForTerms({ termsAccepted: undefined }), false);
});
