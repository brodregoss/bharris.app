import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { enforceImageModeration, imageRejectedMessage } from '../worker/src/moderation.js';
import { postSlackAlert, slackAlertBody } from '../worker/src/slackAlert.js';
import { getUserRow, upsertUser } from '../worker/src/users.js';

const WEBHOOK = 'https://hooks.slack.com/services/T000/B000/secret-token';
const UID = 'slack-user';
const EMAIL = 'student@example.com';
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
    PHOTO_CODE_SECRET: 'stage7-test-secret-not-a-real-key!!',
    OPENAI_API_KEY: 'test-openai-key',
    GOOGLE_VISION_API_KEY: 'test-vision-key',
    MODERATION_ALERT_WEBHOOK: WEBHOOK,
  };
  for (const binding of ['USER_00', 'USER_01', 'USER_02', 'USER_03', 'USER_04', 'USER_05', 'USER_06', 'USER_07']) {
    env[binding] = db;
  }
  return env;
}

const env = testEnv();

function silenceConsole() {
  const logs = [];
  const methods = ['log', 'info', 'debug', 'warn', 'error'];
  const previous = {};
  for (const method of methods) {
    previous[method] = console[method];
    console[method] = (...args) => {
      logs.push(args.map((item) => String(item)).join(' '));
    };
  }
  return {
    logs,
    restore() {
      for (const method of methods) console[method] = previous[method];
    },
  };
}

function leaked(value) {
  const text = String(value || '');
  return text.includes(WEBHOOK)
    || text.includes('data:image')
    || text.includes(EMAIL)
    || text.includes('secret-token');
}

test.before(async () => {
  await upsertUser(env, { uid: UID, email: EMAIL, name: 'Student' });
});

test('slack alerts post a text payload and a missing or failed webhook does not leak or block', async () => {
  const posts = [];
  await postSlackAlert(
    { MODERATION_ALERT_WEBHOOK: WEBHOOK },
    'SEVERE moderation flag userId=slack-user severity=severe categories=sexual/minors time=2026-10-15T00:00:00.000Z',
    async (url, init) => {
      posts.push({ url: String(url), init });
      return new Response('ok', { status: 200 });
    },
    1000,
  );
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, WEBHOOK);
  assert.equal(posts[0].init.method, 'POST');
  assert.equal(posts[0].init.headers['Content-Type'], 'application/json');
  const body = JSON.parse(posts[0].init.body);
  assert.deepEqual(body, slackAlertBody(body.text));
  assert.deepEqual(Object.keys(body), ['text']);
  assert.match(body.text, /userId=slack-user/);
  assert.equal(body.text.includes(EMAIL), false);
  assert.equal(body.text.includes('data:image'), false);

  const missed = [];
  await postSlackAlert({}, 'userId=slack-user', async () => {
    missed.push('called');
    return new Response('ok');
  });
  await postSlackAlert({ MODERATION_ALERT_WEBHOOK: '   ' }, 'userId=slack-user', async () => {
    missed.push('called');
    return new Response('ok');
  });
  assert.deepEqual(missed, []);

  const quiet = silenceConsole();
  try {
    await postSlackAlert({ MODERATION_ALERT_WEBHOOK: WEBHOOK }, 'userId=slack-user', async () => {
      throw new Error(`post failed ${WEBHOOK} data:image/jpeg;base64,AAAA ${EMAIL}`);
    });
    await postSlackAlert({ MODERATION_ALERT_WEBHOOK: WEBHOOK }, 'userId=slack-user', async () => (
      new Response(`bad ${WEBHOOK} data:image/jpeg;base64,AAAA ${EMAIL}`, { status: 500 })
    ));
  } finally {
    quiet.restore();
  }
  assert.deepEqual(quiet.logs, []);

  const seen = [];
  const fetchImpl = async (url, init) => {
    const href = String(url);
    if (href === WEBHOOK) {
      seen.push(JSON.parse(init.body));
      throw new Error(`post failed ${href} data:image/jpeg;base64,AAAA ${EMAIL}`);
    }
    if (href.includes('/moderations')) {
      return new Response(JSON.stringify({
        results: [{
          flagged: true,
          categories: { 'sexual/minors': true },
          category_scores: { 'sexual/minors': 0.4 },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (href.includes('vision.googleapis.com')) {
      return new Response(JSON.stringify({
        responses: [{
          safeSearchAnnotation: {
            adult: 'UNLIKELY',
            racy: 'UNLIKELY',
            violence: 'UNLIKELY',
            medical: 'UNLIKELY',
            spoof: 'UNLIKELY',
          },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected request ${href}`);
  };

  const during = silenceConsole();
  let response;
  try {
    response = await enforceImageModeration(env, { uid: UID }, IMAGE, { fetchImpl });
  } finally {
    during.restore();
  }
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.error.message, imageRejectedMessage());
  assert.equal(leaked(payload.error.message), false);
  assert.equal(during.logs.some((line) => leaked(line)), false);
  assert.equal(seen.length, 1);
  assert.deepEqual(Object.keys(seen[0]), ['text']);
  assert.match(seen[0].text, /userId=slack-user/);
  assert.equal(seen[0].text.includes(EMAIL), false);
  const account = await getUserRow(env, UID);
  assert.equal(Number(account.suspended), 1);
  assert.equal(account.email, EMAIL);

  seen.length = 0;
  env.MODERATION_ALERT_WEBHOOK = '';
  const duringMissing = silenceConsole();
  let missing;
  try {
    missing = await enforceImageModeration(env, { uid: UID }, IMAGE, { fetchImpl });
  } finally {
    duringMissing.restore();
    env.MODERATION_ALERT_WEBHOOK = WEBHOOK;
  }
  const missingBody = await missing.json();
  assert.equal(missing.status, 400);
  assert.equal(missingBody.error.message, imageRejectedMessage());
  assert.equal(seen.length, 0);
  assert.equal(duringMissing.logs.some((line) => leaked(line)), false);
});
