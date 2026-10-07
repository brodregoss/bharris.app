import { SHARD_BINDINGS, VIRTUAL_BUCKETS } from './util.js';

export async function uidToBucket(uid) {
  const bytes = new TextEncoder().encode(String(uid));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const n = new DataView(digest).getUint32(0, false);
  return n % VIRTUAL_BUCKETS;
}

const DEFAULT_RANGES = [
  ['USER_00', 'studyapp-user-00', 0, 8191],
  ['USER_01', 'studyapp-user-01', 8192, 16383],
  ['USER_02', 'studyapp-user-02', 16384, 24575],
  ['USER_03', 'studyapp-user-03', 24576, 32767],
  ['USER_04', 'studyapp-user-04', 32768, 40959],
  ['USER_05', 'studyapp-user-05', 40960, 49151],
  ['USER_06', 'studyapp-user-06', 49152, 57343],
  ['USER_07', 'studyapp-user-07', 57344, 65535],
];

let appSchemaReady = null;
const shardByUid = new Map();
const SHARD_CACHE_MAX = 500;

async function migrateAppSchema(env) {
  await env.APP.prepare(
    'CREATE TABLE IF NOT EXISTS shard_ranges (shard_binding TEXT PRIMARY KEY, database_name TEXT NOT NULL, bucket_start INTEGER NOT NULL, bucket_end INTEGER NOT NULL)',
  ).run();
  await env.APP.prepare(
    'CREATE TABLE IF NOT EXISTS bucket_overrides (firebase_uid TEXT PRIMARY KEY, shard_binding TEXT NOT NULL)',
  ).run();
  await env.APP.prepare(
    'CREATE TABLE IF NOT EXISTS admins (firebase_uid TEXT PRIMARY KEY, email TEXT)',
  ).run();
  const count = await env.APP.prepare('SELECT COUNT(*) AS n FROM shard_ranges').first();
  if (Number(count?.n) > 0) return;
  for (const [binding, name, start, end] of DEFAULT_RANGES) {
    await env.APP.prepare(
      'INSERT OR IGNORE INTO shard_ranges (shard_binding, database_name, bucket_start, bucket_end) VALUES (?, ?, ?, ?)',
    )
      .bind(binding, name, start, end)
      .run();
  }
}

function ensureAppSchema(env) {
  if (!appSchemaReady) {
    appSchemaReady = migrateAppSchema(env).catch((err) => {
      appSchemaReady = null;
      throw err;
    });
  }
  return appSchemaReady;
}

function rememberShard(uid, binding) {
  if (shardByUid.has(uid)) shardByUid.delete(uid);
  shardByUid.set(uid, binding);
  if (shardByUid.size <= SHARD_CACHE_MAX) return;
  const oldest = shardByUid.keys().next().value;
  shardByUid.delete(oldest);
}

export async function shardForUid(env, uid) {
  const cached = shardByUid.get(uid);
  if (cached) return cached;
  await ensureAppSchema(env);
  const override = await env.APP.prepare(
    'SELECT shard_binding FROM bucket_overrides WHERE firebase_uid = ?',
  )
    .bind(uid)
    .first();
  if (override?.shard_binding) {
    rememberShard(uid, override.shard_binding);
    return override.shard_binding;
  }

  const bucket = await uidToBucket(uid);
  const range = await env.APP.prepare(
    'SELECT shard_binding FROM shard_ranges WHERE bucket_start <= ? AND bucket_end >= ?',
  )
    .bind(bucket, bucket)
    .first();
  const index = Math.min(SHARD_BINDINGS.length - 1, Math.floor(bucket / (VIRTUAL_BUCKETS / SHARD_BINDINGS.length)));
  const binding = range?.shard_binding || SHARD_BINDINGS[index];
  rememberShard(uid, binding);
  return binding;
}

export function shardDb(env, binding) {
  const db = env[binding];
  if (!db) throw new Error(`Missing D1 binding ${binding}`);
  return db;
}

export async function userShard(env, uid) {
  const binding = await shardForUid(env, uid);
  return { binding, db: shardDb(env, binding) };
}
