import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginSocialSignup,
  cancelSocialSignup,
  settleSocialSignup,
  stageSignupProfile,
  readSignupProfile,
  usernamePromptPending,
} from './signupProfile.js';

function memoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

test('Apple or Google signup asks for a username after the account exists', () => {
  const previous = globalThis.sessionStorage;
  globalThis.sessionStorage = memoryStorage();
  try {
    stageSignupProfile({ birthDate: '2000-01-01', username: 'ada' });
    beginSocialSignup();
    assert.equal(readSignupProfile(), null);
    assert.equal(usernamePromptPending(), false);

    settleSocialSignup({ username: '' });
    assert.equal(usernamePromptPending(), true);

    beginSocialSignup();
    settleSocialSignup({ username: 'ada' });
    assert.equal(usernamePromptPending(), false);

    beginSocialSignup();
    cancelSocialSignup();
    settleSocialSignup({ username: '' });
    assert.equal(usernamePromptPending(), false);
  } finally {
    globalThis.sessionStorage = previous;
  }
});
