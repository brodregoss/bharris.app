import { periodKey, publicUser, quotaLimit, SHARD_BINDINGS } from './util.js';
import { userShard } from './routing.js';

const userTablesReady = new Map();
const adminCache = new Map();
const ADMIN_CACHE_MS = 5 * 60 * 1000;

const USER_EXTRA_COLUMNS = [
  ['billing_plan', 'TEXT'],
  ['partner_owner_uid', 'TEXT'],
  ['stripe_customer_id', 'TEXT'],
  ['stripe_subscription_id', 'TEXT'],
  ['billing_notice', 'TEXT'],
  ['stripe_status', 'TEXT'],
  ['stripe_trial_end', 'TEXT'],
  ['stripe_period_end', 'TEXT'],
  ['stripe_cancel_at_period_end', 'INTEGER'],
  ['stripe_promo', 'TEXT'],
  ['billing_checked_at', 'TEXT'],
  ['last_seen_at', 'TEXT'],
  ['terms_accepted_at', 'TEXT'],
];

export const ACTIVE_WINDOW_DAYS = 7;
const SEEN_WRITE_MS = 60 * 60 * 1000;

async function migrateUserTable(db) {
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
  const info = await db.prepare('PRAGMA table_info(users)').all();
  const names = new Set((info.results || []).map((column) => column.name));
  for (const [name, type] of USER_EXTRA_COLUMNS) {
    if (names.has(name)) continue;
    await db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${type}`).run();
  }
}

function ensureUserTable(binding, db) {
  let pending = userTablesReady.get(binding);
  if (!pending) {
    pending = migrateUserTable(db).catch((err) => {
      userTablesReady.delete(binding);
      throw err;
    });
    userTablesReady.set(binding, pending);
  }
  return pending;
}

export function userStudyStub(env, uid) {
  const id = env.USER_STUDY.idFromName(uid);
  return { id, stub: env.USER_STUDY.get(id) };
}

export async function isAdminUid(env, uid, email) {
  const hit = adminCache.get(uid);
  if (hit && hit.expires > Date.now()) return hit.value;
  const row = await env.APP.prepare('SELECT firebase_uid FROM admins WHERE firebase_uid = ?')
    .bind(uid)
    .first();
  const adminEmail = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const value = !!row || !!(adminEmail && email && email.toLowerCase() === adminEmail);
  adminCache.set(uid, { value, expires: Date.now() + ADMIN_CACHE_MS });
  return value;
}

export async function getUserRow(env, uid) {
  const { binding, db } = await userShard(env, uid);
  await ensureUserTable(binding, db);
  return db.prepare('SELECT * FROM users WHERE firebase_uid = ?').bind(uid).first();
}

export async function upsertUser(env, identity) {
  const { binding, db } = await userShard(env, uidOrIdentity(identity));
  await ensureUserTable(binding, db);
  const uid = identity.uid;
  const now = new Date().toISOString();
  const existing = await db.prepare('SELECT * FROM users WHERE firebase_uid = ?').bind(uid).first();
  if (existing) {
    const period = existing.ai_quota_period === periodKey() ? existing.ai_quota_period : periodKey();
    const used = existing.ai_quota_period === periodKey() ? existing.ai_quota_used : 0;
    const incomingName = String(identity.name || '').trim();
    const currentName = String(existing.display_name || '').trim();
    // Sign-in refreshes must not replace a name the person already saved.
    const displayName = identity.updateName ? incomingName : (currentName || incomingName);
    await db
      .prepare(
        `UPDATE users SET email = ?, display_name = ?, updated_at = ?, ai_quota_period = ?, ai_quota_used = ?
         WHERE firebase_uid = ?`,
      )
      .bind(
        identity.email || existing.email,
        displayName,
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

export async function deleteUserRow(env, uid) {
  const { binding, db } = await userShard(env, uid);
  await ensureUserTable(binding, db);
  adminCache.delete(uid);
  await db.prepare('DELETE FROM users WHERE firebase_uid = ?').bind(uid).run();
  await env.APP.prepare('DELETE FROM admins WHERE firebase_uid = ?').bind(uid).run();
  await env.APP.prepare('DELETE FROM bucket_overrides WHERE firebase_uid = ?').bind(uid).run();
}

export async function acceptTerms(env, uid) {
  const { binding, db } = await userShard(env, uid);
  await ensureUserTable(binding, db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE users SET terms_accepted_at = ?, updated_at = ?
     WHERE firebase_uid = ? AND (terms_accepted_at IS NULL OR terms_accepted_at = '')`,
  ).bind(now, now, uid).run();
  return getUserRow(env, uid);
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

const BILLING_COLUMNS = {
  tier: 'subscription_tier',
  limit: 'ai_quota_limit',
  billingPlan: 'billing_plan',
  partnerOwnerUid: 'partner_owner_uid',
  stripeCustomerId: 'stripe_customer_id',
  stripeSubscriptionId: 'stripe_subscription_id',
  billingNotice: 'billing_notice',
  stripeStatus: 'stripe_status',
  stripeTrialEnd: 'stripe_trial_end',
  stripePeriodEnd: 'stripe_period_end',
  stripeCancelAtPeriodEnd: 'stripe_cancel_at_period_end',
  stripePromo: 'stripe_promo',
  billingCheckedAt: 'billing_checked_at',
};

export async function updateUserBilling(env, uid, fields) {
  const { binding, db } = await userShard(env, uid);
  await ensureUserTable(binding, db);
  const sets = ['updated_at = ?'];
  const binds = [new Date().toISOString()];
  for (const [key, column] of Object.entries(BILLING_COLUMNS)) {
    if (fields[key] === undefined) continue;
    sets.push(`${column} = ?`);
    binds.push(fields[key]);
  }
  binds.push(uid);
  await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE firebase_uid = ?`).bind(...binds).run();
  return getUserRow(env, uid);
}

export async function toPublicUser(env, row) {
  if (!row) return null;
  const fresh = await alignQuotaLimit(env, row);
  const admin = await isAdminUid(env, fresh.firebase_uid, fresh.email);
  let partnerCode = '';
  let partnerLinked = false;
  if (fresh.billing_plan === 'partner') {
    const { partnerShareForOwner } = await import('./partner.js');
    const share = await partnerShareForOwner(env, fresh.firebase_uid);
    partnerCode = share.code;
    partnerLinked = share.linked;
  }
  return publicUser(fresh, {
    isAdmin: admin,
    partnerCode,
    partnerLinked,
  });
}

export async function alignQuotaLimit(env, row) {
  if (!row) return null;
  const tier = row.subscription_tier || 'free';
  const expected = quotaLimit(env, tier);
  const stored = Number(row.ai_quota_limit) || 0;
  const unlimited = tier === 'pro' && stored >= 100000;
  if (unlimited || stored === expected) return row;
  // A finished ad raises a free account above the plan quota. Keep that until the month rolls.
  if (tier !== 'pro' && stored > expected) return row;
  return updateQuota(env, row.firebase_uid, { limit: expected });
}

export async function requireFreshQuota(env, row) {
  if (!row) return null;
  if (row.ai_quota_period === periodKey()) return alignQuotaLimit(env, row);
  const tier = row.subscription_tier || 'free';
  const stored = Number(row.ai_quota_limit) || 0;
  const unlimited = tier === 'pro' && stored >= 100000;
  const current = await updateQuota(env, row.firebase_uid, unlimited
    ? { used: 0 }
    : { used: 0, limit: quotaLimit(env, tier) });
  return alignQuotaLimit(env, current);
}

export async function touchLastSeen(env, row, now = Date.now()) {
  if (!row?.firebase_uid) return row;
  const seen = Date.parse(row.last_seen_at || '');
  if (Number.isFinite(seen) && now - seen < SEEN_WRITE_MS) return row;
  const { binding, db } = await userShard(env, row.firebase_uid);
  await ensureUserTable(binding, db);
  const stamp = new Date(now).toISOString();
  await db.prepare('UPDATE users SET last_seen_at = ? WHERE firebase_uid = ?')
    .bind(stamp, row.firebase_uid)
    .run();
  return { ...row, last_seen_at: stamp };
}

export async function countAccounts(env, now = Date.now()) {
  const since = new Date(now - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const counts = await Promise.all(SHARD_BINDINGS.map(async (binding) => {
    const db = env[binding];
    if (!db?.prepare) return { total: 0, active: 0 };
    await ensureUserTable(binding, db);
    const row = await db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN COALESCE(last_seen_at, updated_at) >= ? THEN 1 ELSE 0 END) AS active
       FROM users`,
    ).bind(since).first();
    return {
      total: Number(row?.total) || 0,
      active: Number(row?.active) || 0,
    };
  }));
  return {
    total: counts.reduce((sum, row) => sum + row.total, 0),
    active: counts.reduce((sum, row) => sum + row.active, 0),
    activeDays: ACTIVE_WINDOW_DAYS,
  };
}
