import { periodKey, publicUser, quotaLimit } from './util.js';
import { userShard } from './routing.js';

async function ensureUserTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      firebase_uid TEXT PRIMARY KEY,
      email TEXT,
      display_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      do_store_name TEXT,
      do_store_id TEXT,
      do_status TEXT NOT NULL DEFAULT 'pending',
      subscription_tier TEXT NOT NULL DEFAULT 'free',
      ai_quota_used INTEGER NOT NULL DEFAULT 0,
      ai_quota_limit INTEGER NOT NULL DEFAULT 5,
      ai_quota_period TEXT,
      revenuecat_app_user_id TEXT
    )`,
  ).run();
}

export function userStudyStub(env, uid) {
  const id = env.USER_STUDY.idFromName(uid);
  return { id, stub: env.USER_STUDY.get(id) };
}

export async function isAdminUid(env, uid, email) {
  const row = await env.APP.prepare('SELECT firebase_uid FROM admins WHERE firebase_uid = ?')
    .bind(uid)
    .first();
  if (row) return true;
  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !!(adminEmail && email && email.toLowerCase() === adminEmail);
}

export async function getUserRow(env, uid) {
  const { db } = await userShard(env, uid);
  await ensureUserTable(db);
  return db.prepare('SELECT * FROM users WHERE firebase_uid = ?').bind(uid).first();
}

export async function upsertUser(env, identity) {
  const { db } = await userShard(env, uidOrIdentity(identity));
  await ensureUserTable(db);
  const uid = identity.uid;
  const now = new Date().toISOString();
  const existing = await db.prepare('SELECT * FROM users WHERE firebase_uid = ?').bind(uid).first();
  if (existing) {
    const period = existing.ai_quota_period === periodKey() ? existing.ai_quota_period : periodKey();
    const used = existing.ai_quota_period === periodKey() ? existing.ai_quota_used : 0;
    await db
      .prepare(
        `UPDATE users SET email = ?, display_name = ?, updated_at = ?, ai_quota_period = ?, ai_quota_used = ?
         WHERE firebase_uid = ?`,
      )
      .bind(
        identity.email || existing.email,
        identity.name || existing.display_name,
        now,
        period,
        used,
        uid,
      )
      .run();
    return getUserRow(env, uid);
  }

  const limit = quotaLimit(env, 'free');
  await db
    .prepare(
      `INSERT INTO users (
        firebase_uid, email, display_name, created_at, updated_at, do_store_name, do_status,
        subscription_tier, ai_quota_used, ai_quota_limit, ai_quota_period, revenuecat_app_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'free', 0, ?, ?, ?)`,
    )
    .bind(uid, identity.email || '', identity.name || '', now, now, `do:${uid}`, limit, periodKey(), uid)
    .run();
  return getUserRow(env, uid);
}

function uidOrIdentity(identity) {
  return identity.uid;
}

export async function markDoReady(env, uid, storeId) {
  const { db } = await userShard(env, uid);
  await db
    .prepare(
      `UPDATE users SET do_status = 'ready', do_store_id = ?, do_store_name = ?, updated_at = ? WHERE firebase_uid = ?`,
    )
    .bind(storeId || '', `do:${uid}`, new Date().toISOString(), uid)
    .run();
}

export async function updateQuota(env, uid, { used, limit, tier }) {
  const { db } = await userShard(env, uid);
  const sets = ['updated_at = ?'];
  const binds = [new Date().toISOString()];
  if (used != null) {
    sets.push('ai_quota_used = ?');
    binds.push(used);
  }
  if (limit != null) {
    sets.push('ai_quota_limit = ?');
    binds.push(limit);
  }
  if (tier) {
    sets.push('subscription_tier = ?');
    binds.push(tier);
  }
  binds.push(uid);
  await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE firebase_uid = ?`).bind(...binds).run();
  return getUserRow(env, uid);
}

export async function toPublicUser(env, row) {
  if (!row) return null;
  const fresh = await alignQuotaLimit(env, row);
  const admin = await isAdminUid(env, fresh.firebase_uid, fresh.email);
  return publicUser(fresh, { isAdmin: admin });
}

export async function alignQuotaLimit(env, row) {
  if (!row) return null;
  const tier = row.subscription_tier || 'free';
  const expected = quotaLimit(env, tier);
  const stored = Number(row.ai_quota_limit) || 0;
  const unlimited = tier === 'pro' && stored >= 100000;
  if (unlimited || stored === expected) return row;
  return updateQuota(env, row.firebase_uid, { limit: expected });
}

export async function requireFreshQuota(env, row) {
  if (!row) return null;
  const current = row.ai_quota_period === periodKey()
    ? row
    : await updateQuota(env, row.firebase_uid, { used: 0 });
  return alignQuotaLimit(env, current);
}
