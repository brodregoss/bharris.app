import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatScanPasswordHash,
  handleScanKill,
  handleDevUnlock,
  handleScanPassword,
  handleScanUnlock,
  nextScanFailure,
  parseStoredScanHash,
  requireScanToken,
  scanLockConfigured,
  signScanToken,
  verifyNotesScanPassword,
  verifyScanToken,
} from '../worker/src/notesScanLock.js';

const PASSWORD = 'correct-horse-battery';
const SECRET = 'token-secret-with-at-least-32-characters';

test('notes scan password matches only the stored hash', async () => {
  const stored = await formatScanPasswordHash(PASSWORD, { iterations: 100_000 });
  assert.equal(await verifyNotesScanPassword(stored, PASSWORD), true);
  assert.equal(await verifyNotesScanPassword(stored, 'wrong-horse-battery'), false);
  assert.equal(await verifyNotesScanPassword(stored, ''), false);
  assert.equal(await verifyNotesScanPassword(stored, PASSWORD + ' '), false);
  assert.equal(parseStoredScanHash('pbkdf2-sha256$1000$aa$bb'), null);
  assert.equal(scanLockConfigured({
    NOTES_SCAN_PASSWORD_HASH: stored,
    NOTES_SCAN_TOKEN_SECRET: SECRET,
  }), true);
  assert.equal(scanLockConfigured({ NOTES_SCAN_PASSWORD_HASH: stored }), false);
});

test('notes scan token is bound to one account and expires', async () => {
  const now = 1_700_000_000_000;
  const token = await signScanToken(SECRET, 'user-a', now + 60_000);
  assert.equal(await verifyScanToken(SECRET, token, 'user-a', 0, now), true);
  assert.equal(await verifyScanToken(SECRET, token, 'user-b', 0, now), false);
  assert.equal(await verifyScanToken(SECRET, token, 'user-a', 0, now + 60_000), false);
  assert.equal(await verifyScanToken(SECRET, token, 'user-a', 1, now), false);
  assert.equal(await verifyScanToken('short', token, 'user-a', 0, now), false);
  const [payload, sig] = token.split('.');
  assert.equal(await verifyScanToken(SECRET, `${payload}.${sig.slice(0, -1)}A`, 'user-a', 0, now), false);
  assert.equal(await verifyScanToken(SECRET, payload, 'user-a', 0, now), false);
});

test('notes scan lockout trips after repeated misses', () => {
  const now = 1_000;
  let state = { fails: 0, lockedUntil: 0 };
  for (let i = 0; i < 4; i += 1) {
    state = nextScanFailure(state, now);
    assert.equal(state.locked, false);
    assert.equal(state.fails, i + 1);
  }
  state = nextScanFailure(state, now);
  assert.equal(state.locked, true);
  assert.equal(state.fails, 0);
  assert.equal(state.lockedUntil, now + 15 * 60 * 1000);
  const during = nextScanFailure(state, now + 1000);
  assert.equal(during.locked, true);
  assert.equal(during.lockedUntil, state.lockedUntil);
});

function jsonRequest(body) {
  return new Request('https://app.test/v1/notes/scan-unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function lockEnv(hash) {
  let state = { fails: 0, lockedUntil: 0 };
  let devState = { fails: 0, lockedUntil: 0 };
  const stub = {
    async scanLockState() {
      return state;
    },
    async recordScanFailure(now) {
      state = nextScanFailure(state, now);
      return state;
    },
    async clearScanFailures() {
      state = { fails: 0, lockedUntil: 0 };
    },
    async devLockState() {
      return devState;
    },
    async recordDevFailure(now) {
      devState = nextScanFailure(devState, now);
      return devState;
    },
    async clearDevFailures() {
      devState = { fails: 0, lockedUntil: 0 };
    },
  };
  return {
    NOTES_SCAN_PASSWORD_HASH: hash,
    NOTES_SCAN_TOKEN_SECRET: 'x'.repeat(40),
    USER_STUDY: {
      idFromName() {
        return 'id';
      },
      get() {
        return stub;
      },
    },
  };
}

test('photo upload stays closed until the password checks out', async () => {
  const password = 'scan-password-ok';
  const hash = await formatScanPasswordHash(password, { iterations: 100_000 });
  const env = lockEnv(hash);
  const identity = { uid: 'user-a' };

  assert.equal((await handleScanUnlock(jsonRequest({}), env, identity)).status, 401);
  const opened = await handleScanUnlock(jsonRequest({ password }), env, identity);
  assert.equal(opened.status, 200);
  const { token } = await opened.json();
  const missing = await requireScanToken(new Request('https://app.test/v1/notes'), env, identity);
  assert.equal(missing.status, 401);
  const allowed = await requireScanToken(new Request('https://app.test/v1/notes', {
    headers: { 'X-Notes-Scan-Token': token },
  }), env, identity);
  assert.equal(allowed, null);
  const otherAccount = await requireScanToken(new Request('https://app.test/v1/notes', {
    headers: { 'X-Notes-Scan-Token': token },
  }), env, { uid: 'user-b' });
  assert.equal(otherAccount.status, 401);

  const bare = lockEnv(hash);
  delete bare.NOTES_SCAN_PASSWORD_HASH;
  assert.equal((await handleScanUnlock(jsonRequest({ password }), bare, identity)).status, 503);
});

function memoryApp() {
  const store = new Map();
  return {
    prepare(sql) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      const statement = {
        bind(...params) {
          return {
            async run() {
              if (text.startsWith('INSERT')) store.set(params[0], params[1]);
              return { success: true };
            },
            async first() {
              if (!text.includes('app_settings')) return null;
              const value = store.get(params[0]);
              return value == null ? null : { value };
            },
          };
        },
        async run() {
          return statement.bind().run();
        },
      };
      return statement;
    },
  };
}

test('killing the notes code stops old passwords and tokens', async () => {
  const password = 'scan-password-ok';
  const hash = await formatScanPasswordHash(password, { iterations: 100_000 });
  const env = {
    ...lockEnv(hash),
    ADMIN_EMAIL: 'owner@example.com',
    APP: memoryApp(),
  };
  const owner = { uid: 'owner-kill', email: 'owner@example.com' };
  const student = { uid: 'student-kill', email: 'student@example.com' };
  const opened = await handleScanUnlock(jsonRequest({ password }), env, student);
  assert.equal(opened.status, 200);
  const { token } = await opened.json();

  assert.equal((await handleScanKill(new Request('https://app.test/kill'), env, student)).status, 403);
  const killed = await handleScanKill(new Request('https://app.test/kill'), env, owner);
  assert.equal(killed.status, 200);
  assert.equal((await killed.json()).killed, true);

  assert.equal((await handleScanUnlock(jsonRequest({ password }), env, student)).status, 401);
  assert.equal((await requireScanToken(new Request('https://app.test/v1/notes', {
    headers: { 'X-Notes-Scan-Token': token },
  }), env, student)).status, 401);

  assert.equal((await handleScanPassword(jsonRequest({ password: 'short' }), env, student)).status, 403);
  assert.equal((await handleScanPassword(jsonRequest({ password: 'short' }), env, owner)).status, 400);
  const nextCode = 'fresh-notes-code';
  const saved = await handleScanPassword(jsonRequest({ password: nextCode }), env, owner);
  assert.equal(saved.status, 200);
  assert.equal((await handleScanUnlock(jsonRequest({ password }), env, student)).status, 401);
  const again = await handleScanUnlock(jsonRequest({ password: nextCode }), env, student);
  assert.equal(again.status, 200);
  const { token: nextToken } = await again.json();
  assert.equal((await requireScanToken(new Request('https://app.test/v1/notes', {
    headers: { 'X-Notes-Scan-Token': token },
  }), env, student)).status, 401);
  assert.equal(await requireScanToken(new Request('https://app.test/v1/notes', {
    headers: { 'X-Notes-Scan-Token': nextToken },
  }), env, student), null);
});

test('dev code opens the kill switch and the old pin does not', async () => {
  const devCode = 'river-candle-moonlight';
  const notesPassword = 'scan-password-ok';
  const env = {
    ...lockEnv(await formatScanPasswordHash(notesPassword, { iterations: 100_000 })),
    DEV_TOOLS_CODE_HASH: await formatScanPasswordHash(devCode, { iterations: 100_000 }),
    APP: memoryApp(),
  };
  const user = { uid: 'dev-user', email: 'dev@example.com' };

  assert.equal((await handleDevUnlock(jsonRequest({ code: '95032' }), env, user)).status, 401);
  const opened = await handleDevUnlock(jsonRequest({ code: devCode }), env, user);
  assert.equal(opened.status, 200);
  const { token } = await opened.json();
  const killed = await handleScanKill(new Request('https://app.test/kill', {
    headers: { 'X-Dev-Tools-Token': token },
  }), env, user);
  assert.equal(killed.status, 200);
  assert.equal((await killed.json()).killed, true);

  const fresh = {
    ...lockEnv(await formatScanPasswordHash(notesPassword, { iterations: 100_000 })),
    DEV_TOOLS_CODE_HASH: env.DEV_TOOLS_CODE_HASH,
    APP: memoryApp(),
  };
  const scan = await handleScanUnlock(jsonRequest({ password: notesPassword }), fresh, user);
  const { token: scanToken } = await scan.json();
  assert.equal((await handleScanKill(new Request('https://app.test/kill', {
    headers: { 'X-Dev-Tools-Token': scanToken },
  }), fresh, user)).status, 403);
});
