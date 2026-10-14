import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleAi } from '../worker/src/ai.js';
import {
  combineProviderResults,
  enforceImageModeration,
  imageRejectedMessage,
  judgeOpenAi,
  judgeSafeSearch,
  moderateBytes,
} from '../worker/src/moderation.js';
import { PHOTO_UNAVAILABLE, requirePhotoAccess, strikeLimitMessage } from '../worker/src/photoAccess.js';
import {
  getUserRow,
  markPhotoUnlocked,
  setUserSuspended,
  upsertUser,
} from '../worker/src/users.js';
import moderationConfig from '../config/moderation.json' with { type: 'json' };

const SECRET = 'stage2-test-secret-not-a-real-key!!';
const UID = 'moderation-user';
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
    SUPPORT_EMAIL: 'support@example.com',
    FREE_AI_QUOTA: '5',
    PRO_AI_QUOTA: '30',
  };
  for (const binding of ['USER_00', 'USER_01', 'USER_02', 'USER_03', 'USER_04', 'USER_05', 'USER_06', 'USER_07']) {
    env[binding] = db;
  }
  return env;
}

const env = testEnv();

function responseJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function openAiBody({ categories = {}, scores = {} } = {}) {
  return {
    results: [{
      flagged: Object.values(categories).some(Boolean),
      categories,
      category_scores: scores,
    }],
  };
}

function safeBody(annotation) {
  return { responses: [{ safeSearchAnnotation: annotation }] };
}

function cleanAnnotation() {
  return {
    adult: 'UNLIKELY',
    racy: 'UNLIKELY',
    violence: 'UNLIKELY',
    medical: 'UNLIKELY',
    spoof: 'UNLIKELY',
  };
}

function fetchRouter({ openai, safesearch, chat, alerts, hang = false, fail = null }) {
  return async (url, init) => {
    const href = String(url);
    assert.equal(href.includes('test-vision-key'), false);
    assert.equal(href.includes('test-openai-key'), false);
    if (hang && (href.includes('/moderations') || href.includes('vision.googleapis.com'))) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(responseJson({})), 1000);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }
    if (href.includes('/moderations')) {
      if (fail === 'openai') return responseJson({ error: { message: 'nope' } }, 500);
      return responseJson(openai);
    }
    if (href.includes('vision.googleapis.com')) {
      if (fail === 'safesearch') return responseJson({ error: { message: 'nope' } }, 500);
      return responseJson(safesearch);
    }
    if (href.includes('/chat/completions')) {
      chat.count += 1;
      return responseJson({}, 500);
    }
    if (href === env.MODERATION_ALERT_WEBHOOK) {
      alerts.push(JSON.parse(init.body));
      return responseJson({ ok: true });
    }
    throw new Error(`unexpected request ${href}`);
  };
}

async function messageOf(response) {
  const body = await response.json();
  return { status: response.status, message: body?.error?.message || '', body };
}

test.before(async () => {
  sqlite.exec('CREATE TABLE sentinel (id TEXT PRIMARY KEY, body TEXT)');
  sqlite.prepare("INSERT INTO sentinel (id, body) VALUES ('keep', 'leave-this-row')").run();
  await upsertUser(env, { uid: 'setup-user', email: 'setup@example.com', name: 'Setup' });
});

test.beforeEach(async () => {
  await env.APP.prepare('DELETE FROM users').run();
  await env.APP.prepare('DELETE FROM moderation_events').run().catch(() => {});
  await upsertUser(env, { uid: UID, email: 'student@example.com', name: 'Student' });
  await markPhotoUnlocked(env, UID);
});

test('severity follows the config thresholds', () => {
  assert.equal(imageRejectedMessage(), moderationConfig.messages.rejected_image);
  assert.equal(judgeOpenAi({
    categories: { 'sexual/minors': true, sexual: false },
    category_scores: { 'sexual/minors': 0.2, sexual: 0 },
  }).severity, 'severe');
  assert.equal(judgeOpenAi({
    categories: { sexual: true },
    category_scores: { sexual: 0.9 },
  }).severity, 'severe');
  assert.equal(judgeOpenAi({
    categories: { sexual: false },
    category_scores: { sexual: 0.9 },
  }).severity, 'severe');
  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), adult: 'VERY_LIKELY' }).severity, 'severe');

  for (const name of ['violence', 'violence/graphic', 'self-harm', 'self-harm/intent', 'self-harm/instructions']) {
    assert.equal(judgeOpenAi({
      categories: { [name]: true },
      category_scores: { [name]: 0.2 },
    }).severity, 'mild', name);
  }
  assert.equal(judgeOpenAi({
    categories: { sexual: true },
    category_scores: { sexual: 0.89 },
  }).severity, 'mild');
  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), adult: 'LIKELY' }).severity, 'mild');
  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), racy: 'VERY_LIKELY' }).severity, 'mild');
  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), violence: 'VERY_LIKELY' }).severity, 'mild');

  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), medical: 'VERY_LIKELY' }).severity, 'none');
  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), spoof: 'VERY_LIKELY' }).severity, 'none');
  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), racy: 'POSSIBLE' }).severity, 'none');
  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), medical: 'POSSIBLE' }).severity, 'none');
  assert.equal(judgeSafeSearch({ ...cleanAnnotation(), violence: 'LIKELY' }).severity, 'log');

  const mixed = combineProviderResults([
    judgeOpenAi({ categories: { violence: true }, category_scores: { violence: 0.2 } }),
    judgeSafeSearch({ ...cleanAnnotation(), adult: 'VERY_LIKELY' }),
  ]);
  assert.equal(mixed.severity, 'severe');
  assert.equal(mixed.suspend, true);
  assert.equal(mixed.strike, false);
});

test('a severe flag suspends, alerts, and does not call the model or delete data', async () => {
  const chat = { count: 0 };
  const alerts = [];
  const original = globalThis.fetch;
  globalThis.fetch = fetchRouter({
    openai: openAiBody({
      categories: { 'sexual/minors': true, sexual: false },
      scores: { 'sexual/minors': 0.4, sexual: 0 },
    }),
    safesearch: safeBody(cleanAnnotation()),
    chat,
    alerts,
  });
  try {
    const response = await handleAi(new Request('https://app.test/v1/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Read this page', image: IMAGE, feature: 'extract' }),
    }), env, { uid: UID }, 'extract');
    const body = await messageOf(response);
    assert.equal(body.status, 400);
    assert.equal(body.message, imageRejectedMessage());
    assert.equal(chat.count, 0);
  } finally {
    globalThis.fetch = original;
  }
  const account = await getUserRow(env, UID);
  assert.equal(Number(account.suspended), 1);
  assert.equal(Number(account.photo_strikes) || 0, 0);
  assert.equal(sqlite.prepare("SELECT body FROM sentinel WHERE id = 'keep'").get().body, 'leave-this-row');
  assert.equal(account.email, 'student@example.com');
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].text, 'SEVERE moderation flag');
  assert.equal(alerts[0].severity, 'severe');
  assert.deepEqual(alerts[0].categories, ['sexual/minors']);
  assert.equal(JSON.stringify(alerts[0]).includes('YQ=='), false);
  assert.equal(Object.hasOwn(alerts[0], 'image'), false);
  const events = sqlite.prepare('SELECT * FROM moderation_events').all();
  assert.equal(events.length, 1);
  assert.match(events[0].image_sha256, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(events).includes('YQ=='), false);
  assert.equal(JSON.stringify(events).includes(IMAGE), false);
  await setUserSuspended(env, UID, false);
  assert.equal(await requirePhotoAccess(env, { uid: UID }), null);
});

test('mild flags add one strike and the fifth blocks only photo import', async () => {
  const chat = { count: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = fetchRouter({
    openai: openAiBody({ categories: { sexual: true }, scores: { sexual: 0.4 } }),
    safesearch: safeBody({ ...cleanAnnotation(), racy: 'POSSIBLE', medical: 'VERY_LIKELY' }),
    chat,
    alerts: [],
  });
  try {
    for (let i = 0; i < 5; i += 1) {
      const response = await enforceImageModeration(env, { uid: UID }, IMAGE);
      const body = await messageOf(response);
      assert.equal(body.message, imageRejectedMessage());
    }
    assert.equal(chat.count, 0);
  } finally {
    globalThis.fetch = original;
  }
  const account = await getUserRow(env, UID);
  assert.equal(Number(account.photo_strikes), 5);
  assert.equal(Number(account.suspended) || 0, 0);
  const paused = await messageOf(await requirePhotoAccess(env, { uid: UID }));
  assert.equal(paused.message, strikeLimitMessage(env));
  env.OPENAI_API_KEY = '';
  const study = await handleAi(new Request('https://app.test/v1/ai/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Define one term', feature: 'complete' }),
  }), env, { uid: UID }, 'complete');
  env.OPENAI_API_KEY = 'test-openai-key';
  assert.notEqual(study.status, 403);
});

test('a provider error or timeout blocks without a strike', async () => {
  const chat = { count: 0 };
  const original = globalThis.fetch;
  globalThis.fetch = fetchRouter({
    openai: openAiBody(),
    safesearch: safeBody(cleanAnnotation()),
    chat,
    alerts: [],
    fail: 'openai',
  });
  try {
    const errored = await messageOf(await enforceImageModeration(env, { uid: UID }, IMAGE));
    assert.equal(errored.status, 403);
    assert.equal(errored.message, PHOTO_UNAVAILABLE);
    assert.equal(chat.count, 0);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(Number((await getUserRow(env, UID)).photo_strikes) || 0, 0);

  globalThis.fetch = fetchRouter({
    openai: openAiBody(),
    safesearch: safeBody(cleanAnnotation()),
    chat,
    alerts: [],
    hang: true,
  });
  try {
    const timedOut = await messageOf(await enforceImageModeration(env, { uid: UID }, IMAGE, {
      config: { ...moderationConfig, timeout_ms: 20 },
    }));
    assert.equal(timedOut.message, PHOTO_UNAVAILABLE);
    assert.equal(chat.count, 0);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(Number((await getUserRow(env, UID)).photo_strikes) || 0, 0);
  assert.equal(Number((await getUserRow(env, UID)).suspended) || 0, 0);
});

test('clean providers reach the model and an enabled stub fails closed', async () => {
  const chat = { count: 0 };
  const alerts = [];
  const original = globalThis.fetch;
  globalThis.fetch = fetchRouter({
    openai: openAiBody({
      categories: { sexual: false, violence: false },
      scores: { sexual: 0, violence: 0 },
    }),
    safesearch: safeBody(cleanAnnotation()),
    chat,
    alerts,
  });
  try {
    const response = await handleAi(new Request('https://app.test/v1/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Read this page', image: IMAGE, feature: 'extract' }),
    }), env, { uid: UID }, 'extract');
    assert.equal(response.status, 502);
    assert.equal(chat.count, 1);
    assert.equal(alerts.length, 0);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(Number((await getUserRow(env, UID)).photo_strikes) || 0, 0);

  const stubbed = await moderateBytes(new Uint8Array([1, 2, 3]), 'image/jpeg', env, {
    config: {
      ...moderationConfig,
      providers: { ...moderationConfig.providers, photodna: true },
    },
    fetchImpl: fetchRouter({
      openai: openAiBody(),
      safesearch: safeBody(cleanAnnotation()),
      chat,
      alerts: [],
    }),
  });
  assert.equal(stubbed.block, true);
  assert.equal(stubbed.strike, false);
  assert.equal(stubbed.suspend, false);
});
