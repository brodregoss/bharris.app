import { parseUsername, usernameChangeReadyAt } from '../../src/lib/username.js';

const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
export const USERNAME_ATTEMPT_LIMIT = 8;

const tablesReady = new WeakMap();

async function migrateUsernameTables(env) {
  await env.APP.prepare(
    `CREATE TABLE IF NOT EXISTS usernames (
      username TEXT PRIMARY KEY,
      firebase_uid TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      renamed_at TEXT
    )`,
  ).run();
  try {
    await env.APP.prepare('ALTER TABLE usernames ADD COLUMN renamed_at TEXT').run();
  } catch (err) {
    const message = String(err?.message || err?.cause?.message || '');
    if (!/duplicate column/i.test(message)) throw err;
  }
  await env.APP.prepare(
    `CREATE TABLE IF NOT EXISTS username_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firebase_uid TEXT NOT NULL,
      attempted_at TEXT NOT NULL
    )`,
  ).run();
  await env.APP.prepare(
    'CREATE INDEX IF NOT EXISTS idx_username_attempts_uid ON username_attempts (firebase_uid, attempted_at)',
  ).run();
}

function ensureUsernameTables(env) {
  let pending = tablesReady.get(env);
  if (!pending) {
    pending = migrateUsernameTables(env).catch((err) => {
      tablesReady.delete(env);
      throw err;
    });
    tablesReady.set(env, pending);
  }
  return pending;
}

function uniqueFailure(err) {
  const message = String(err?.message || err?.cause?.message || '');
  if (message.includes('usernames.firebase_uid')) return 'uid';
  if (message.includes('UNIQUE constraint failed')) return 'name';
  return '';
}

async function tooManyAttempts(env, uid) {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const row = await env.APP.prepare(
    'SELECT COUNT(*) AS n FROM username_attempts WHERE firebase_uid = ? AND attempted_at > ?',
  )
    .bind(uid, since)
    .first();
  return Number(row?.n) >= USERNAME_ATTEMPT_LIMIT;
}

async function noteAttempt(env, uid) {
  const now = new Date().toISOString();
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  await env.APP.batch([
    env.APP.prepare('DELETE FROM username_attempts WHERE attempted_at <= ?').bind(since),
    env.APP.prepare('INSERT INTO username_attempts (firebase_uid, attempted_at) VALUES (?, ?)').bind(uid, now),
  ]);
}

const USERNAME_ROW_SQL = 'SELECT username, created_at, updated_at, renamed_at FROM usernames WHERE firebase_uid = ?';

export async function usernameRecord(env, uid) {
  if (!uid) return { username: '', changedAt: '' };
  await ensureUsernameTables(env);
  const row = await env.APP.prepare(USERNAME_ROW_SQL).bind(uid).first();
  return {
    username: row?.username || '',
    changedAt: row?.renamed_at || '',
  };
}

export async function usernameFor(env, uid) {
  const record = await usernameRecord(env, uid);
  return record.username;
}

export async function usernameAvailability(env, raw, uid = '') {
  const parsed = parseUsername(raw);
  if (parsed.error) return { error: parsed.error };
  await ensureUsernameTables(env);
  const row = await env.APP.prepare(
    'SELECT firebase_uid FROM usernames WHERE username = ?',
  )
    .bind(parsed.username)
    .first();
  const taken = !!row?.firebase_uid && row.firebase_uid !== uid;
  return { username: parsed.username, available: !taken };
}

export async function releaseUsername(env, uid) {
  if (!uid) return;
  await ensureUsernameTables(env);
  await env.APP.prepare('DELETE FROM usernames WHERE firebase_uid = ?').bind(uid).run();
  await env.APP.prepare('DELETE FROM username_attempts WHERE firebase_uid = ?').bind(uid).run();
}

export async function claimUsername(env, uid, raw) {
  const parsed = parseUsername(raw);
  if (parsed.error) return { error: { message: parsed.error, status: 400 } };
  await ensureUsernameTables(env);
  const current = await env.APP.prepare(USERNAME_ROW_SQL).bind(uid).first();
  if (current?.username === parsed.username) return { username: parsed.username };
  if (current?.username && usernameChangeReadyAt(current.renamed_at)) {
    return { error: { message: 'You can change your username once a day.', status: 429 } };
  }
  if (await tooManyAttempts(env, uid)) {
    return { error: { message: 'Too many tries. Wait an hour and try again.', status: 429 } };
  }
  await noteAttempt(env, uid);
  const now = new Date().toISOString();
  try {
    if (current?.username) {
      await env.APP.prepare(
        'UPDATE usernames SET username = ?, updated_at = ?, renamed_at = ? WHERE firebase_uid = ?',
      )
        .bind(parsed.username, now, now, uid)
        .run();
    } else {
      await env.APP.prepare(
        'INSERT INTO usernames (username, firebase_uid, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
        .bind(parsed.username, uid, now, now)
        .run();
    }
  } catch (err) {
    const failed = uniqueFailure(err);
    if (failed === 'uid') {
      const again = await usernameFor(env, uid);
      if (again === parsed.username) return { username: again };
      return { error: { message: 'Save that username again.', status: 409 } };
    }
    if (failed === 'name') return { error: { message: 'That username is taken.', status: 409 } };
    throw err;
  }
  return { username: parsed.username };
}
