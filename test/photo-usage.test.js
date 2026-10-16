import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleAi } from '../worker/src/ai.js';
import { enforceImageModeration } from '../worker/src/moderation.js';
import { PHOTO_UNAVAILABLE } from '../worker/src/photoAccess.js';
import {
  PHOTO_PAUSED,
  reservePhotoUsage,
  usageAlertText,
  usageCaps,
} from '../worker/src/photoUsage.js';
import { getUserRow, markPhotoUnlocked, upsertUser } from '../worker/src/users.js';
import moderationConfig from '../config/moderation.json' with { type: 'json' };

const SECRET = 'stage6-test-secret-not-a-real-key!!';
const UID = 'usage-user';
const OTHER = 'usage-other';
const IMAGE = 'data:image/jpeg;base64,YQ==';
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

function testEnv() {
  const db = memoryD1(sqlite);
  const env = {
    APP: db,
    PHOTO_FEATURE_ENABLED: 'true',
    PHOTO_CODE_SECRET: SECRET,
    OPENAI_API_KEY: 'test-openai-key',
    GOOGLE_VISION_API_KEY: 'test-vision-key',
    MODERATION_ALERT_WEBHOOK: 'https://alerts.invalid/hook',
    FREE_AI_QUOTA: '5',
    PRO_AI_QUOTA: '30',
  };
  for (const binding of ['USER_00', 'USER_01', 'USER_02', 'USER_03', 'USER_04', 'USER_05', 'USER_06', 'USER_07']) {
    env[binding] = db;
  }
  return env;
}

const env = testEnv();

function withCaps(check = {}, vision = {}) {
  return {
    ...moderationConfig,
    caps: {
      check: { ...moderationConfig.caps.check, ...check },
      vision: { ...moderationConfig.caps.vision, ...vision },
    },
  };
}

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function providerFetch(calls) {
  return async (url) => {
    const href = String(url);
    if (href.includes('/moderations')) {
      calls.moderation += 1;
      return responseJson({ results: [{ flagged: false, categories: {}, category_scores: {} }] });
    }
    if (href.includes('vision.googleapis.com')) {
      calls.vision += 1;
      return responseJson({
        responses: [{
          safeSearchAnnotation: {
            adult: 'UNLIKELY',
            racy: 'UNLIKELY',
            violence: 'UNLIKELY',
            medical: 'UNLIKELY',
            spoof: 'UNLIKELY',
          },
        }],
      });
    }
    if (href.includes('/chat/completions')) {
      calls.chat += 1;
      return responseJson({}, 500);
    }
    if (href === env.MODERATION_ALERT_WEBHOOK) return responseJson({ ok: true });
    throw new Error(`unexpected request ${href}`);
  };
}

async function messageOf(response) {
  const body = await response.json();
  return { status: response.status, message: body?.error?.message || '' };
}

async function countOf(kind, bucket) {
  const row = await env.APP.prepare(
    'SELECT count FROM photo_usage WHERE kind = ? AND bucket = ?',
  ).bind(kind, bucket).first();
  return Number(row?.count) || 0;
}

async function clearUsage() {
  await env.APP.prepare('DELETE FROM photo_usage').run().catch(() => {});
  await env.APP.prepare('DELETE FROM photo_usage_alerts').run().catch(() => {});
}

function aiRequest(image) {
  return new Request('https://app.test/v1/ai/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Read this page',
      ...(image ? { image } : {}),
      feature: 'extract',
    }),
  });
}

test.before(async () => {
  await upsertUser(env, { uid: 'setup-user', email: 'setup@example.com', name: 'Setup' });
});

test.beforeEach(async () => {
  await env.APP.prepare('DELETE FROM users').run();
  await clearUsage();
  await upsertUser(env, { uid: UID, email: 'student@example.com', name: 'Student' });
  await upsertUser(env, { uid: OTHER, email: 'other@example.com', name: 'Other' });
  await markPhotoUnlocked(env, UID);
  await markPhotoUnlocked(env, OTHER);
});

test('configured caps are the six defaults', () => {
  assert.deepEqual(usageCaps(), {
    check: { globalDaily: 300, perUserDaily: 60, globalMonthly: 5000 },
    vision: { globalDaily: 300, perUserDaily: 100, globalMonthly: 5000 },
  });
  assert.equal(usageCaps({}).vision.perUserDaily, 100);
  assert.equal(usageCaps({}).check.perUserDaily, 60);
});

test('each cap blocks the next request once its bucket is at the limit', async () => {
  const cases = [
    ['check', 'global_daily_cap', 'day:2026-10-15'],
    ['check', 'per_user_daily_cap', 'user:usage-user:day:2026-10-15'],
    ['check', 'global_monthly_cap', 'month:2026-10'],
    ['vision', 'global_daily_cap', 'day:2026-10-15'],
    ['vision', 'per_user_daily_cap', 'user:usage-user:day:2026-10-15'],
    ['vision', 'global_monthly_cap', 'month:2026-10'],
  ];
  for (const [kind, key, bucket] of cases) {
    await clearUsage();
    const config = withCaps(
      kind === 'check' ? { [key]: 1 } : {},
      kind === 'vision' ? { [key]: 1 } : {},
    );
    const first = await reservePhotoUsage(env, UID, kind, { config, now: '2026-10-15T00:00:00.000Z' });
    const second = await reservePhotoUsage(env, UID, kind, { config, now: '2026-10-15T01:00:00.000Z' });
    assert.equal(first.allowed, true, key);
    assert.equal(second.allowed, false, key);
    assert.equal(second.reason, 'cap', key);
    assert.equal(await countOf(kind, bucket), 1, bucket);
  }
});

test('a per-user cap leaves another account open, and a global cap closes it', async () => {
  const perUser = withCaps({ per_user_daily_cap: 1 }, { per_user_daily_cap: 1 });
  const now = '2026-10-15T00:00:00.000Z';
  assert.equal((await reservePhotoUsage(env, UID, 'check', { config: perUser, now })).allowed, true);
  assert.equal((await reservePhotoUsage(env, UID, 'check', { config: perUser, now })).reason, 'cap');
  assert.equal((await reservePhotoUsage(env, OTHER, 'check', { config: perUser, now })).allowed, true);

  await clearUsage();
  const globalDaily = withCaps({}, { global_daily_cap: 1 });
  assert.equal((await reservePhotoUsage(env, UID, 'vision', { config: globalDaily, now })).allowed, true);
  assert.equal((await reservePhotoUsage(env, OTHER, 'vision', { config: globalDaily, now })).reason, 'cap');
});

test('daily caps open on the next UTC day and monthly caps keep counting', async () => {
  const config = withCaps({ global_daily_cap: 1, global_monthly_cap: 2 }, { global_daily_cap: 1, global_monthly_cap: 2 });
  for (const kind of ['check', 'vision']) {
    await clearUsage();
    assert.equal((await reservePhotoUsage(env, UID, kind, { config, now: '2026-10-15T00:00:00.000Z' })).allowed, true);
    assert.equal((await reservePhotoUsage(env, UID, kind, { config, now: '2026-10-15T23:00:00.000Z' })).reason, 'cap');
    assert.equal((await reservePhotoUsage(env, UID, kind, { config, now: '2026-10-16T00:00:00.000Z' })).allowed, true);
    assert.equal(await countOf(kind, 'day:2026-10-16'), 1);
    assert.equal(await countOf(kind, 'month:2026-10'), 2);
    assert.equal((await reservePhotoUsage(env, UID, kind, { config, now: '2026-10-17T00:00:00.000Z' })).reason, 'cap');
  }
});

test('monthly caps open on the next UTC month', async () => {
  const config = withCaps({ global_monthly_cap: 1 }, { global_monthly_cap: 1 });
  for (const kind of ['check', 'vision']) {
    await clearUsage();
    assert.equal((await reservePhotoUsage(env, UID, kind, { config, now: '2026-10-31T00:00:00.000Z' })).allowed, true);
    assert.equal((await reservePhotoUsage(env, UID, kind, { config, now: '2026-10-31T12:00:00.000Z' })).reason, 'cap');
    assert.equal((await reservePhotoUsage(env, UID, kind, { config, now: '2026-11-01T00:00:00.000Z' })).allowed, true);
    assert.equal(await countOf(kind, 'month:2026-11'), 1);
    assert.equal(await countOf(kind, 'month:2026-10'), 1);
  }
});

test('a cap block skips providers and does not add a strike', async () => {
  const calls = { moderation: 0, vision: 0, chat: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = providerFetch(calls);
  const config = withCaps({ global_daily_cap: 1 }, { global_daily_cap: 1 });
  try {
    await reservePhotoUsage(env, UID, 'check', { config, now: '2026-10-15T00:00:00.000Z' });
    const blocked = await messageOf(await enforceImageModeration(env, { uid: UID }, IMAGE, {
      config,
      now: '2026-10-15T01:00:00.000Z',
    }));
    assert.equal(blocked.status, 403);
    assert.equal(blocked.message, PHOTO_PAUSED);
    assert.equal(calls.moderation, 0);
    assert.equal(calls.vision, 0);
    assert.equal(calls.chat, 0);
  } finally {
    globalThis.fetch = original;
  }
  const account = await getUserRow(env, UID);
  assert.equal(Number(account.photo_strikes) || 0, 0);
  assert.equal(Number(account.suspended) || 0, 0);
  assert.equal(await countOf('check', 'day:2026-10-15'), 1);
});

test('a counter read or write failure blocks before moderation and before the study model', async () => {
  const calls = { moderation: 0, vision: 0, chat: 0 };
  const originalFetch = globalThis.fetch;
  const originalPrepare = env.APP.prepare;
  globalThis.fetch = providerFetch(calls);
  env.APP.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (sql.startsWith('SELECT count FROM photo_usage')) {
      return { bind: () => ({ first: async () => { throw new Error('read failed'); } }) };
    }
    return statement;
  };
  try {
    const readFailed = await messageOf(await enforceImageModeration(env, { uid: UID }, IMAGE));
    assert.equal(readFailed.status, 403);
    assert.equal(readFailed.message, PHOTO_UNAVAILABLE);
    assert.equal(calls.moderation, 0);
    assert.equal(calls.vision, 0);
  } finally {
    env.APP.prepare = originalPrepare;
  }

  env.APP.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (!sql.startsWith('INSERT INTO photo_usage ')) return statement;
    return {
      bind(...params) {
        return {
          async run() {
            if (params[0] === 'vision') throw new Error('write failed');
            return statement.bind(...params).run();
          },
        };
      },
    };
  };
  try {
    const writeFailed = await messageOf(await handleAi(aiRequest(IMAGE), env, { uid: UID }, 'extract'));
    assert.equal(writeFailed.message, PHOTO_UNAVAILABLE);
    assert.equal(calls.chat, 0);
    assert.equal(calls.moderation, 1);
  } finally {
    env.APP.prepare = originalPrepare;
    globalThis.fetch = originalFetch;
  }
  const account = await getUserRow(env, UID);
  assert.equal(Number(account.photo_strikes) || 0, 0);
  assert.equal(Number(account.suspended) || 0, 0);
});

test('80% and 100% alerts fire once per global bucket and contain counts and time', async () => {
  const alerts = [];
  const fetchImpl = async (url, init) => {
    assert.equal(String(url), env.MODERATION_ALERT_WEBHOOK);
    alerts.push(JSON.parse(init.body));
    return responseJson({ ok: true });
  };
  const cases = [
    ['check', { global_daily_cap: 10, global_monthly_cap: 1000 }, 'day'],
    ['check', { global_daily_cap: 1000, global_monthly_cap: 10 }, 'month'],
    ['vision', { global_daily_cap: 10, global_monthly_cap: 1000 }, 'day'],
    ['vision', { global_daily_cap: 1000, global_monthly_cap: 10 }, 'month'],
  ];
  for (const [kind, limits, period] of cases) {
    await clearUsage();
    alerts.length = 0;
    const config = withCaps(kind === 'check' ? limits : {}, kind === 'vision' ? limits : {});
    const now = '2026-10-15T03:00:00.000Z';
    for (let i = 0; i < 10; i += 1) {
      const result = await reservePhotoUsage(env, UID, kind, { config, now, fetchImpl });
      assert.equal(result.allowed, true, `${kind} ${period} ${i}`);
    }
    const extra = await reservePhotoUsage(env, UID, kind, { config, now, fetchImpl });
    assert.equal(extra.reason, 'cap');
    const mine = alerts.filter((alert) => (
      alert.text.includes(`kind=${kind}`) && alert.text.includes(`period=${period}`)
    ));
    assert.equal(mine.length, 2, `${kind} ${period}`);
    assert.deepEqual(Object.keys(mine[0]), ['text']);
    assert.match(mine[0].text, /count=8 cap=10/);
    assert.match(mine[1].text, /count=10 cap=10/);
    assert.match(mine[0].text, new RegExp(`time=${now}`));
    assert.equal(JSON.stringify(mine).includes(UID), false);
    assert.equal(JSON.stringify(mine).includes('@'), false);
    assert.equal(alerts.length, 2, `${kind} ${period} extra`);
  }

  const quiet = [];
  const perUser = withCaps({ per_user_daily_cap: 1 }, {});
  const perUserFetch = async (_url, init) => {
    quiet.push(JSON.parse(init.body));
    return responseJson({ ok: true });
  };
  await clearUsage();
  assert.equal((await reservePhotoUsage(env, UID, 'check', {
    config: perUser,
    now: '2026-10-15T04:00:00.000Z',
    fetchImpl: perUserFetch,
  })).allowed, true);
  assert.equal(quiet.length, 0);

  const body = usageAlertText({
    kind: 'check',
    period: 'day',
    count: 8,
    cap: 10,
    time: '2026-10-15T03:00:00.000Z',
  });
  assert.equal(body, 'Photo usage kind=check period=day count=8 cap=10 time=2026-10-15T03:00:00.000Z');
  assert.equal(body.includes(UID), false);
  assert.equal(body.includes('@'), false);
});

test('two image study requests count two vision calls and a text request counts neither', async () => {
  const calls = { moderation: 0, vision: 0, chat: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = providerFetch(calls);
  try {
    await handleAi(aiRequest(IMAGE), env, { uid: UID }, 'extract');
    await handleAi(aiRequest(IMAGE), env, { uid: UID }, 'extract');
    const text = await handleAi(
      new Request('https://app.test/v1/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Define one term', feature: 'complete' }),
      }),
      env,
      { uid: UID },
      'complete',
    );
    assert.notEqual(text.status, 403);
  } finally {
    globalThis.fetch = original;
  }
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(calls.chat, 3);
  assert.equal(await countOf('vision', `day:${day}`), 2);
  assert.equal(await countOf('check', `day:${day}`), 2);
  const account = await getUserRow(env, UID);
  assert.equal(Number(account.photo_strikes) || 0, 0);
});
