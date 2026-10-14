import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleAi } from '../worker/src/ai.js';
import { handleCreateNote, handleGetNotePage } from '../worker/src/notes.js';
import { inspectImagePayload, reserveExtract } from '../worker/src/imageGuard.js';
import { runLlm } from '../worker/src/llm.js';
import { markPhotoUnlocked, upsertUser } from '../worker/src/users.js';
import { listNoteImages } from '../scripts/list-note-images.mjs';
import { prepareStoredNotes } from '../src/lib/noteRecord.js';
import moderationConfig from '../config/moderation.json' with { type: 'json' };

const SECRET = 'stage3-test-secret-not-a-real-key!!';
const UID = 'storage-user';
const JPEG = 'data:image/jpeg;base64,YQ==';
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
    FREE_AI_QUOTA: '5',
    PRO_AI_QUOTA: '30',
    OPENAI_API_KEY: 'test-openai-key',
  };
  for (const binding of ['USER_00', 'USER_01', 'USER_02', 'USER_03', 'USER_04', 'USER_05', 'USER_06', 'USER_07']) {
    env[binding] = db;
  }
  return env;
}

const env = testEnv();
const calls = { put: 0, delete: 0, get: 0, fetch: 0 };

function notesBucket() {
  return {
    async put() { calls.put += 1; },
    async delete() { calls.delete += 1; },
    async get() { calls.get += 1; return null; },
    async list() { return { objects: [], truncated: false }; },
  };
}

async function messageOf(response) {
  const body = await response.json();
  return { status: response.status, message: body?.error?.message || '', note: body?.note };
}

test.before(async () => {
  await upsertUser(env, { uid: UID, email: 'student@example.com', name: 'Student' });
});

test.beforeEach(async () => {
  calls.put = 0;
  calls.delete = 0;
  calls.get = 0;
  calls.fetch = 0;
  env.NOTES = notesBucket();
  env.PHOTO_FEATURE_ENABLED = 'true';
  env.PHOTO_CODE_SECRET = SECRET;
  await env.APP.prepare('DELETE FROM photo_extract_windows').run().catch(() => {});
  await markPhotoUnlocked(env, UID);
});

test('a note keeps terms and does not write image bytes', async () => {
  let saved = null;
  env.USER_STUDY = {
    idFromName() { return { toString() { return 'id'; } }; },
    get() {
      return {
        async putNote(note) {
          saved = note;
          return { id: note.id, title: note.title, transcript: note.transcript, pages: [] };
        },
      };
    },
  };
  const created = await handleCreateNote(new Request('https://app.test/v1/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Psych',
      terms: [{ term: 'Hippocampus', definition: 'Memory' }],
    }),
  }), env, { uid: UID });
  const body = await messageOf(created);
  assert.equal(created.status, 201);
  assert.equal(body.note.title, 'Psych');
  assert.match(saved.transcript, /Hippocampus/);
  assert.equal(saved.r2OriginalKey, null);
  assert.deepEqual(saved.pages, []);
  assert.equal(JSON.stringify(saved).includes('data:image'), false);
  assert.equal(calls.put, 0);
  assert.equal(calls.delete, 0);

  const rejected = await messageOf(await handleCreateNote(new Request('https://app.test/v1/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [JPEG, JPEG] }),
  }), env, { uid: UID }));
  assert.equal(rejected.status, 400);
  assert.equal(rejected.message, 'Photos are not stored.');
  const page = await messageOf(await handleGetNotePage(env, { uid: UID }, 'note-1', '0'));
  assert.equal(page.status, 404);
  assert.equal(calls.put, 0);
  assert.equal(calls.get, 0);
  assert.equal(calls.delete, 0);
});

test('extract rejects a non-image, an oversized photo, and too many photos', async () => {
  const original = global.fetch;
  global.fetch = async () => {
    calls.fetch += 1;
    throw new Error('fetch should not run');
  };
  try {
    const wrongType = await messageOf(await handleAi(new Request('https://app.test/v1/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Read this', image: 'data:image/svg+xml;base64,YQ==', feature: 'extract' }),
    }), env, { uid: UID }, 'extract'));
    assert.equal(wrongType.message, 'Photo must be an image');
    const tooBig = inspectImagePayload(
      { image: `data:image/jpeg;base64,${'A'.repeat(30)}` },
      { maxImages: 2, maxChars: 20 },
    );
    assert.equal(tooBig.message, 'Photo is too large');
    const huge = `data:image/jpeg;base64,${'A'.repeat(moderationConfig.extract.max_image_chars)}`;
    const oversized = await messageOf(await handleAi(new Request('https://app.test/v1/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Read this', image: huge, feature: 'extract' }),
    }), env, { uid: UID }, 'extract'));
    assert.equal(oversized.message, 'Photo is too large');
    const many = await messageOf(await handleAi(new Request('https://app.test/v1/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Read this', images: [JPEG, JPEG, JPEG], feature: 'extract' }),
    }), env, { uid: UID }, 'extract'));
    assert.equal(many.message, 'You can attach up to 2 photos.');
    assert.equal(calls.fetch, 0);
  } finally {
    global.fetch = original;
  }
});

test('the extract rate limit blocks another read and a storage failure stays closed', async () => {
  const original = global.fetch;
  global.fetch = async () => {
    calls.fetch += 1;
    throw new Error('fetch should not run');
  };
  try {
    for (let i = 0; i < moderationConfig.extract.max_per_window; i += 1) {
      const slot = await reserveExtract(env, UID);
      assert.equal(slot.allowed, true);
    }
    const limited = await messageOf(await handleAi(new Request('https://app.test/v1/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Read this', image: JPEG, feature: 'extract' }),
    }), env, { uid: UID }, 'extract'));
    assert.equal(limited.status, 429);
    env.APP = { prepare() { throw new Error('database unavailable'); } };
    const closed = await messageOf(await handleAi(new Request('https://app.test/v1/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Read this', image: JPEG, feature: 'extract' }),
    }), env, { uid: UID }, 'extract'));
    assert.equal(closed.status, 503);
    assert.equal(closed.message, 'Try again in a moment.');
    assert.equal(calls.fetch, 0);
  } finally {
    env.APP = testEnv().APP;
    global.fetch = original;
  }
});

test('the study request sets store false', async () => {
  const original = global.fetch;
  let sent = null;
  global.fetch = async (url, init) => {
    sent = { url: String(url), body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  };
  try {
    const result = await runLlm(env, { prompt: 'Define one term' });
    assert.equal(result, 'ok');
    assert.equal(sent.body.store, false);
    assert.match(sent.url, /\/v1\/chat\/completions$/);
    assert.equal(JSON.stringify(sent.body).includes('test-openai-key'), false);
  } finally {
    global.fetch = original;
  }
});

test('the note list refuses a remote bucket unless asked', async () => {
  let fetches = 0;
  const lines = [];
  const errors = [];
  const blocked = await listNoteImages({
    argv: ['--uid', UID, '--bucket', 'studyapp-staging-notes'],
    env: { CLOUDFLARE_ACCOUNT_ID: 'account-test', CLOUDFLARE_API_TOKEN: 'test-token' },
    fetchImpl: async () => { fetches += 1; throw new Error('fetch should not run'); },
    write: (line) => lines.push(line),
    writeError: (line) => errors.push(line),
  });
  assert.equal(blocked, 1);
  assert.match(errors[0], /Refusing to list a remote R2 bucket/);
  assert.equal(fetches, 0);

  const listed = await listNoteImages({
    argv: ['--allow-remote', '--uid', UID, '--bucket', 'studyapp-staging-notes'],
    env: { CLOUDFLARE_ACCOUNT_ID: 'account-test', CLOUDFLARE_API_TOKEN: 'test-token' },
    fetchImpl: async (url, init) => {
      fetches += 1;
      assert.equal(init.method, 'GET');
      assert.equal(url.pathname.endsWith('/objects'), true);
      assert.equal(url.searchParams.get('prefix'), `notes/${UID}/`);
      assert.equal(String(url).includes('delete'), false);
      assert.equal(init.headers.Authorization, 'Bearer test-token');
      return new Response(JSON.stringify({
        success: true,
        result: [
          { key: `notes/${UID}/note/pages/001.jpg`, size: 12, uploaded: '2026-10-13T00:00:00Z', body: 'secret-bytes' },
          { key: 'notes/someone-else/page.jpg', size: 4, uploaded: '2026-10-13T00:00:00Z' },
        ],
        result_info: { is_truncated: false },
      }), { status: 200 });
    },
    write: (line) => lines.push(line),
    writeError: (line) => errors.push(line),
  });
  assert.equal(listed, 0);
  assert.equal(fetches, 1);
  assert.deepEqual(lines, [`notes/${UID}/note/pages/001.jpg\t12\t2026-10-13T00:00:00Z`]);
  assert.equal(lines.join('\n').includes('secret-bytes'), false);
});

test('saved notes drop image fields', () => {
  const prepared = prepareStoredNotes([{
    id: 'note-1',
    title: 'Psych',
    transcript: JSON.stringify({ terms: [{ term: 'Synapse' }] }),
    pages: [{ r2_key: `notes/${UID}/note-1/pages/001.jpg` }],
    image: JPEG,
  }]);
  assert.equal(prepared.changed, true);
  assert.equal(prepared.notes[0].title, 'Psych');
  assert.match(prepared.notes[0].transcript, /Synapse/);
  assert.equal(prepared.notes[0].pages, undefined);
  assert.equal(prepared.notes[0].image, undefined);
  assert.equal(JSON.stringify(prepared.notes).includes('data:image'), false);
  assert.equal(JSON.stringify(prepared.notes).includes('r2_key'), false);
});
