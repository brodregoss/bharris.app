import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleAi } from '../worker/src/ai.js';
import { handleCreateNote, handleGetNotePage } from '../worker/src/notes.js';
import {
  CODE_REJECTED,
  PHOTO_INVITE_ONLY,
  PHOTO_TERMS_REQUIRED,
  PHOTO_TERMS_VERSION,
  PHOTO_UNAVAILABLE,
  canonicalAccessCode,
  enforceSuspension,
  generateAccessCode,
  handleRedeemPhotoAccess,
  hashAccessCode,
  photoFeatureEnabled,
  requirePhotoAccess,
  revokeAccessCode,
  storeAccessCode,
  strikeLimit,
  strikeLimitMessage,
  suspensionMessage,
} from '../worker/src/photoAccess.js';
import {
  addPhotoStrike,
  getUserRow,
  setPhotoRevoked,
  setUserSuspended,
  toPublicUser,
  upsertUser,
} from '../worker/src/users.js';
import moderationConfig from '../config/moderation.json' with { type: 'json' };

const SECRET = 'stage1-test-secret-not-a-real-key!!';
const UID = 'photo-user-a';
const OTHER = 'photo-user-b';
const NOW = Date.parse('2026-10-13T18:00:00.000Z');

const sqlite = new DatabaseSync(':memory:');

function memoryD1(db) {
  return {
    prepare(sql) {
      const runWith = (params) => ({
        async first() {
          return db.prepare(sql).get(...params) ?? null;
        },
        async all() {
          return { results: db.prepare(sql).all(...params) };
        },
        async run() {
          const info = db.prepare(sql).run(...params);
          return { success: true, meta: { changes: Number(info?.changes) || 0 } };
        },
      });
      const statement = runWith([]);
      statement.bind = (...params) => runWith(params);
      return statement;
    },
  };
}

function testEnv(overrides = {}) {
  const db = memoryD1(sqlite);
  const env = {
    APP: db,
    PHOTO_FEATURE_ENABLED: 'false',
    PHOTO_CODE_SECRET: SECRET,
    SUPPORT_EMAIL: '',
    FREE_AI_QUOTA: '5',
    PRO_AI_QUOTA: '30',
  };
  for (const binding of ['USER_00', 'USER_01', 'USER_02', 'USER_03', 'USER_04', 'USER_05', 'USER_06', 'USER_07']) {
    env[binding] = db;
  }
  return { ...env, ...overrides };
}

const env = testEnv();

function redeemRequest(code, ip = '203.0.113.10', extra = {}) {
  return new Request('https://app.test/v1/notes/photo-access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': ip,
    },
    body: JSON.stringify({
      code,
      acceptPhotoTerms: extra.acceptPhotoTerms !== false,
    }),
  });
}

async function bodyOf(response) {
  return response.json();
}

async function messageOf(response) {
  const body = await bodyOf(response);
  return { status: response.status, message: body?.error?.message || '' };
}

test.before(async () => {
  sqlite.exec('CREATE TABLE sentinel (id TEXT PRIMARY KEY, body TEXT)');
  sqlite.prepare("INSERT INTO sentinel (id, body) VALUES ('keep', 'leave-this-row')").run();
  await upsertUser(env, { uid: 'setup-user', email: 'setup@example.com', name: 'Setup' });
  await storeAccessCode(env, { code: generateAccessCode() });
});

test.beforeEach(async () => {
  await env.APP.prepare('DELETE FROM users').run();
  await env.APP.prepare('DELETE FROM photo_access_codes').run();
  await env.APP.prepare('DELETE FROM photo_access_redemptions').run();
  await env.APP.prepare('DELETE FROM photo_redeem_lockouts').run();
  env.PHOTO_FEATURE_ENABLED = 'false';
  env.PHOTO_CODE_SECRET = SECRET;
  env.SUPPORT_EMAIL = '';
  delete env.NOTES;
});

async function user(uid, email = 'student@example.com') {
  return upsertUser(env, { uid, email, name: 'Student' });
}

test('photo import is off unless the flag is the string true', () => {
  assert.equal(photoFeatureEnabled({}), false);
  assert.equal(photoFeatureEnabled({ PHOTO_FEATURE_ENABLED: 'false' }), false);
  assert.equal(photoFeatureEnabled({ PHOTO_FEATURE_ENABLED: '1' }), false);
  assert.equal(photoFeatureEnabled({ PHOTO_FEATURE_ENABLED: 'true' }), true);
  assert.equal(strikeLimit(), moderationConfig.strike_limit);
});

test('access codes are random base32 groups and are not stored as themselves', async () => {
  const source = readFileSync(new URL('../worker/src/photoAccess.js', import.meta.url), 'utf8');
  assert.equal(source.includes('Math.random'), false);
  const seen = new Set();
  for (let i = 0; i < 20; i += 1) {
    const code = generateAccessCode();
    assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){5}-[0-9A-HJKMNP-TV-Z]{2}$/);
    assert.equal(canonicalAccessCode(code).length, 26);
    assert.equal(seen.has(code), false);
    seen.add(code);
  }
  const code = generateAccessCode();
  await storeAccessCode(env, { code });
  const rows = sqlite.prepare('SELECT * FROM photo_access_codes').all();
  assert.equal(rows.length, 1);
  assert.match(rows[0].code_hash, /^[0-9a-f]{64}$/);
  const dumped = JSON.stringify(rows);
  assert.equal(dumped.includes(code), false);
  assert.equal(dumped.includes(canonicalAccessCode(code)), false);
  const hash = await hashAccessCode(env, code);
  assert.equal(rows[0].code_hash, hash);
  assert.notEqual(hash, code);
});

test('wrong, expired, used, and revoked codes return the same error', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  await user(UID);
  await user(OTHER);
  const wrong = await messageOf(await handleRedeemPhotoAccess(
    redeemRequest('not-a-valid-code'),
    env,
    { uid: UID },
    NOW,
  ));

  const expiredCode = generateAccessCode();
  await storeAccessCode(env, { code: expiredCode, expiresAt: '2020-01-01T00:00:00.000Z' });
  const expired = await messageOf(await handleRedeemPhotoAccess(
    redeemRequest(expiredCode),
    env,
    { uid: UID },
    NOW,
  ));

  const usedCode = generateAccessCode();
  await storeAccessCode(env, { code: usedCode, maxUses: 1 });
  const first = await handleRedeemPhotoAccess(redeemRequest(usedCode), env, { uid: UID }, NOW);
  assert.equal(first.status, 200);
  const used = await messageOf(await handleRedeemPhotoAccess(
    redeemRequest(usedCode, '203.0.113.11'),
    env,
    { uid: OTHER },
    NOW,
  ));

  const revokedCode = generateAccessCode();
  await storeAccessCode(env, { code: revokedCode });
  assert.equal(await revokeAccessCode(env, revokedCode), true);
  const revoked = await messageOf(await handleRedeemPhotoAccess(
    redeemRequest(revokedCode, '203.0.113.12'),
    env,
    { uid: OTHER },
    NOW,
  ));

  for (const result of [expired, used, revoked]) {
    assert.equal(result.status, wrong.status);
    assert.equal(result.message, wrong.message);
    assert.equal(result.message, CODE_REJECTED);
  }
  const stored = JSON.stringify(sqlite.prepare('SELECT * FROM photo_access_codes').all());
  assert.equal(stored.includes(usedCode), false);
  assert.equal(stored.includes(revokedCode), false);
});

test('a photo code is not used until the 18+ box is checked', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  await user(UID);
  const code = generateAccessCode();
  await storeAccessCode(env, { code });
  const blocked = await messageOf(await handleRedeemPhotoAccess(
    redeemRequest(code, '203.0.113.10', { acceptPhotoTerms: false }),
    env,
    { uid: UID },
    NOW,
  ));
  assert.equal(blocked.status, 400);
  assert.equal(blocked.message, PHOTO_TERMS_REQUIRED);
  assert.equal(Number(sqlite.prepare('SELECT use_count FROM photo_access_codes').get().use_count), 0);
  const before = await getUserRow(env, UID);
  assert.equal(before.photo_unlocked_at || '', '');
  assert.equal(before.photo_terms_version || '', '');

  const ok = await handleRedeemPhotoAccess(redeemRequest(code), env, { uid: UID }, NOW);
  assert.equal(ok.status, 200);
  const after = await getUserRow(env, UID);
  assert.ok(after.photo_unlocked_at);
  assert.equal(after.photo_terms_version, PHOTO_TERMS_VERSION);
  assert.ok(after.photo_terms_accepted_at);
  assert.equal(Number(sqlite.prepare('SELECT use_count FROM photo_access_codes').get().use_count), 1);
});

test('the account status reports whether photo import is enabled', async () => {
  sqlite.exec('CREATE TABLE IF NOT EXISTS admins (firebase_uid TEXT PRIMARY KEY)');
  await user('status-user');
  env.PHOTO_FEATURE_ENABLED = 'false';
  const off = await toPublicUser(env, await getUserRow(env, 'status-user'));
  assert.equal(off.photoFeatureEnabled, false);
  assert.equal(off.termsAccepted, false);
  env.PHOTO_FEATURE_ENABLED = 'true';
  const on = await toPublicUser(env, await getUserRow(env, 'status-user'));
  assert.equal(on.photoFeatureEnabled, true);
});

test('a redeemed code unlocks only that account and can be typed with dashes', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  await user(UID);
  let code = generateAccessCode();
  while (!canonicalAccessCode(code).includes('1') && !canonicalAccessCode(code).includes('0')) {
    code = generateAccessCode();
  }
  await storeAccessCode(env, { code });
  const typed = code.toLowerCase().replace(/1/g, 'I').replace(/0/g, 'O');
  const response = await handleRedeemPhotoAccess(redeemRequest(typed), env, { uid: UID }, NOW);
  assert.deepEqual(await bodyOf(response), { ok: true });
  assert.equal(response.status, 200);
  const row = await getUserRow(env, UID);
  assert.ok(row.photo_unlocked_at);
  assert.equal(await requirePhotoAccess(env, { uid: UID }), null);
  const again = await handleRedeemPhotoAccess(redeemRequest(code), env, { uid: UID }, NOW + 1000);
  assert.equal(again.status, 200);
  const saved = sqlite.prepare('SELECT use_count FROM photo_access_codes').get();
  assert.equal(Number(saved.use_count), 1);
});

test('repeated failures lock redemption without consuming a valid code', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  await user(UID);
  await user(OTHER);
  const code = generateAccessCode();
  const otherCode = generateAccessCode();
  await storeAccessCode(env, { code });
  await storeAccessCode(env, { code: otherCode });
  for (let i = 0; i < moderationConfig.access_code.max_failures; i += 1) {
    const missed = await messageOf(await handleRedeemPhotoAccess(
      redeemRequest(`wrong-code-${i}`),
      env,
      { uid: UID },
      NOW,
    ));
    assert.equal(missed.message, CODE_REJECTED);
    assert.equal(missed.status, 400);
  }
  const locked = await messageOf(await handleRedeemPhotoAccess(
    redeemRequest(code),
    env,
    { uid: UID },
    NOW + 1000,
  ));
  assert.equal(locked.message, CODE_REJECTED);
  assert.equal(locked.status, 400);
  const blockedOther = await messageOf(await handleRedeemPhotoAccess(
    redeemRequest(otherCode),
    env,
    { uid: OTHER },
    NOW + 1000,
  ));
  assert.equal(blockedOther.message, CODE_REJECTED);
  const counts = sqlite.prepare('SELECT COALESCE(SUM(use_count), 0) AS used FROM photo_access_codes').get();
  assert.equal(Number(counts.used), 0);
  const later = await handleRedeemPhotoAccess(
    redeemRequest(code),
    env,
    { uid: UID },
    NOW + moderationConfig.access_code.lockout_ms + 2000,
  );
  assert.equal(later.status, 200);
});

test('the kill switch blocks photo upload, page reads, and extract', async () => {
  env.PHOTO_FEATURE_ENABLED = 'false';
  await user(UID);
  let writes = 0;
  let reads = 0;
  env.NOTES = {
    async put() { writes += 1; },
    async get() { reads += 1; return null; },
  };
  const upload = await handleCreateNote(new Request('https://app.test/v1/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: ['data:image/jpeg;base64,YQ=='] }),
  }), env, { uid: UID });
  const uploadBody = await messageOf(upload);
  assert.equal(uploadBody.status, 403);
  assert.equal(uploadBody.message, PHOTO_UNAVAILABLE);
  const page = await handleGetNotePage(env, { uid: UID }, 'note', '0');
  assert.equal((await messageOf(page)).message, PHOTO_UNAVAILABLE);
  const extract = await handleAi(new Request('https://app.test/v1/ai/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Read this', image: 'data:image/jpeg;base64,YQ==', feature: 'extract' }),
  }), env, { uid: UID }, 'extract');
  assert.equal((await messageOf(extract)).message, PHOTO_UNAVAILABLE);
  assert.equal(writes, 0);
  assert.equal(reads, 0);

  env.PHOTO_FEATURE_ENABLED = 'true';
  env.PHOTO_CODE_SECRET = 'too-short';
  const missingSecret = await requirePhotoAccess(env, { uid: UID });
  assert.equal((await messageOf(missingSecret)).message, PHOTO_UNAVAILABLE);
});

test('a missing or short photo code secret fails closed and does not consume a code', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  await user(UID);
  const code = generateAccessCode();
  await storeAccessCode(env, { code });
  for (const secret of ['', 'short-secret', 'x'.repeat(31)]) {
    env.PHOTO_CODE_SECRET = secret;
    const gate = await messageOf(await requirePhotoAccess(env, { uid: UID }));
    const redeem = await messageOf(await handleRedeemPhotoAccess(
      redeemRequest(code),
      env,
      { uid: UID },
      NOW,
    ));
    assert.equal(gate.status, 403);
    assert.equal(gate.message, PHOTO_UNAVAILABLE);
    assert.equal(redeem.status, 403);
    assert.equal(redeem.message, PHOTO_UNAVAILABLE);
    const body = JSON.stringify(gate) + JSON.stringify(redeem);
    assert.equal(body.includes(code), false);
    assert.equal(body.includes('PHOTO_CODE_SECRET'), false);
  }
  const saved = sqlite.prepare('SELECT use_count, redeemed_uid FROM photo_access_codes').get();
  assert.equal(Number(saved.use_count), 0);
  assert.equal(saved.redeemed_uid, null);
});

test('an unlocked account still cannot use photos while the kill switch is off', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  await user(UID);
  const code = generateAccessCode();
  await storeAccessCode(env, { code });
  assert.equal((await handleRedeemPhotoAccess(redeemRequest(code), env, { uid: UID }, NOW)).status, 200);
  env.PHOTO_FEATURE_ENABLED = 'false';
  const denied = await requirePhotoAccess(env, { uid: UID });
  assert.equal((await messageOf(denied)).message, PHOTO_UNAVAILABLE);
});

test('locked accounts are rejected and strikes block only photo import', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  await user(UID);
  const locked = await requirePhotoAccess(env, { uid: UID });
  assert.equal((await messageOf(locked)).message, PHOTO_INVITE_ONLY);
  const code = generateAccessCode();
  await storeAccessCode(env, { code });
  await handleRedeemPhotoAccess(redeemRequest(code), env, { uid: UID }, NOW);
  for (let i = 0; i < strikeLimit() - 1; i += 1) await addPhotoStrike(env, UID);
  assert.equal(await requirePhotoAccess(env, { uid: UID }), null);
  await addPhotoStrike(env, UID);
  env.SUPPORT_EMAIL = 'support@example.com';
  const paused = await messageOf(await requirePhotoAccess(env, { uid: UID }));
  assert.equal(paused.status, 403);
  assert.equal(paused.message, strikeLimitMessage(env));
  const notes = await enforceSuspension(env, { uid: UID }, ['v1', 'notes'], 'GET');
  assert.equal(notes, null);
  const study = await handleAi(new Request('https://app.test/v1/ai/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Define one term', feature: 'complete' }),
  }), env, { uid: UID }, 'complete');
  assert.notEqual(study.status, 403);
});

test('suspension blocks the app except account status and does not delete stored rows', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  env.SUPPORT_EMAIL = 'support@example.com';
  await user(UID);
  const code = generateAccessCode();
  await storeAccessCode(env, { code });
  await handleRedeemPhotoAccess(redeemRequest(code), env, { uid: UID }, NOW);
  await setUserSuspended(env, UID, true);
  const home = await enforceSuspension(env, { uid: UID }, ['v1', 'users', 'me'], 'GET');
  const update = await enforceSuspension(env, { uid: UID }, ['v1', 'users', 'me'], 'POST');
  const remove = await enforceSuspension(env, { uid: UID }, ['v1', 'users', 'me'], 'DELETE');
  assert.equal(home, null);
  assert.equal(update, null);
  assert.equal(remove, null);
  const blocked = await messageOf(await enforceSuspension(env, { uid: UID }, ['v1', 'notes'], 'GET'));
  assert.equal(blocked.status, 403);
  assert.equal(blocked.message, suspensionMessage(env));
  const redeem = await messageOf(await handleRedeemPhotoAccess(
    redeemRequest(generateAccessCode()),
    env,
    { uid: UID },
    NOW,
  ));
  assert.equal(redeem.message, suspensionMessage(env));
  const kept = sqlite.prepare("SELECT body FROM sentinel WHERE id = 'keep'").get();
  const account = await getUserRow(env, UID);
  assert.equal(kept.body, 'leave-this-row');
  assert.equal(account.email, 'student@example.com');
  assert.equal(Number(account.suspended), 1);
  await setUserSuspended(env, UID, false);
  const restored = await enforceSuspension(env, { uid: UID }, ['v1', 'notes'], 'GET');
  assert.equal(restored, null);
  assert.equal(await requirePhotoAccess(env, { uid: UID }), null);
});

test('revoked photo access stays locked and does not consume a new code', async () => {
  env.PHOTO_FEATURE_ENABLED = 'true';
  await user(UID);
  await setPhotoRevoked(env, UID, true);
  const code = generateAccessCode();
  await storeAccessCode(env, { code });
  const response = await messageOf(await handleRedeemPhotoAccess(redeemRequest(code), env, { uid: UID }, NOW));
  assert.equal(response.message, PHOTO_INVITE_ONLY);
  const saved = sqlite.prepare('SELECT use_count FROM photo_access_codes').get();
  assert.equal(Number(saved.use_count), 0);
  const denied = await messageOf(await requirePhotoAccess(env, { uid: UID }));
  assert.equal(denied.message, PHOTO_INVITE_ONLY);
});
