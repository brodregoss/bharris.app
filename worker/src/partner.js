import { errorJson, json, quotaLimit, readJson } from './util.js';
import { appleEntitlementActive } from './billing.js';
import { getUserRow, toPublicUser, updateUserBilling } from './users.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_';
const CODE_LENGTH = 20;
const ATTEMPT_LIMIT = 8;
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;

export function generatePartnerCode() {
  const chars = [];
  const bytes = new Uint8Array(64);
  const span = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  while (chars.length < CODE_LENGTH) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && chars.length < CODE_LENGTH; i += 1) {
      if (bytes[i] >= span) continue;
      chars.push(ALPHABET[bytes[i] % ALPHABET.length]);
    }
  }
  return chars.join('');
}

async function ensurePartnerTables(env) {
  await env.APP.prepare(
    `CREATE TABLE IF NOT EXISTS partner_links (
      owner_uid TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      guest_uid TEXT,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`,
  ).run();
  const info = await env.APP.prepare('PRAGMA table_info(partner_links)').all();
  const names = new Set((info.results || []).map((column) => column.name));
  if (!names.has('redeemed_uid')) {
    await env.APP.prepare('ALTER TABLE partner_links ADD COLUMN redeemed_uid TEXT').run();
  }
  await env.APP.prepare(
    `CREATE TABLE IF NOT EXISTS partner_redeem_attempts (
      firebase_uid TEXT NOT NULL,
      attempted_at TEXT NOT NULL
    )`,
  ).run();
}

async function linkForOwner(env, ownerUid) {
  await ensurePartnerTables(env);
  return env.APP.prepare('SELECT * FROM partner_links WHERE owner_uid = ?').bind(ownerUid).first();
}

export async function partnerShareForOwner(env, ownerUid) {
  const link = await linkForOwner(env, ownerUid);
  if (!link?.active || !link.code) return { code: '', linked: false };
  return { code: link.code, linked: !!link.guest_uid };
}

async function dropGuestAccess(env, link, notice = '') {
  if (!link?.guest_uid) return;
  const guest = await getUserRow(env, link.guest_uid);
  if (!guest || guest.billing_plan !== 'guest') return;
  if (guest.partner_owner_uid && guest.partner_owner_uid !== link.owner_uid) return;
  const apple = await appleEntitlementActive(env, guest.firebase_uid);
  const tier = apple ? 'pro' : 'free';
  await updateUserBilling(env, guest.firebase_uid, {
    tier,
    limit: quotaLimit(env, tier),
    billingPlan: '',
    partnerOwnerUid: '',
    billingNotice: notice || '',
    stripeStatus: '',
    stripeTrialEnd: '',
    stripePeriodEnd: '',
    stripeCancelAtPeriodEnd: 0,
    stripePromo: '',
  });
}

export async function syncGuestSchedule(env, ownerUid, fields) {
  await ensurePartnerTables(env);
  const link = await linkForOwner(env, ownerUid);
  if (!link?.active || !link.guest_uid) return;
  const guest = await getUserRow(env, link.guest_uid);
  if (guest?.billing_plan !== 'guest') return;
  await updateUserBilling(env, link.guest_uid, fields);
}

export async function ensureOwnerCode(env, ownerUid, stripe = {}) {
  await ensurePartnerTables(env);
  const now = new Date().toISOString();
  const existing = await linkForOwner(env, ownerUid);
  if (existing?.active && existing.code) {
    await env.APP.prepare(
      `UPDATE partner_links
       SET stripe_customer_id = COALESCE(NULLIF(?, ''), stripe_customer_id),
           stripe_subscription_id = COALESCE(NULLIF(?, ''), stripe_subscription_id),
           updated_at = ?
       WHERE owner_uid = ?`,
    )
      .bind(stripe.customerId || '', stripe.subscriptionId || '', now, ownerUid)
      .run();
    return existing.code;
  }
  const code = generatePartnerCode();
  if (existing) {
    await env.APP.prepare(
      `UPDATE partner_links
       SET code = ?, active = 1, guest_uid = NULL, redeemed_uid = NULL, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = ?
       WHERE owner_uid = ?`,
    )
      .bind(
        code,
        stripe.customerId || existing.stripe_customer_id || '',
        stripe.subscriptionId || existing.stripe_subscription_id || '',
        now,
        ownerUid,
      )
      .run();
    return code;
  }
  await env.APP.prepare(
    `INSERT INTO partner_links (
      owner_uid, code, guest_uid, stripe_customer_id, stripe_subscription_id, active, updated_at
    ) VALUES (?, ?, NULL, ?, ?, 1, ?)`,
  )
    .bind(ownerUid, code, stripe.customerId || '', stripe.subscriptionId || '', now)
    .run();
  return code;
}

export async function endPartnerLink(env, ownerUid, { notice = '' } = {}) {
  await ensurePartnerTables(env);
  const link = await linkForOwner(env, ownerUid);
  if (!link) return;
  await dropGuestAccess(env, link, notice);
  await env.APP.prepare('UPDATE partner_links SET active = 0, updated_at = ? WHERE owner_uid = ?')
    .bind(new Date().toISOString(), ownerUid)
    .run();
}

export async function detachGuest(env, uid) {
  await ensurePartnerTables(env);
  const link = await env.APP.prepare('SELECT * FROM partner_links WHERE guest_uid = ?').bind(uid).first();
  if (!link) return;
  await env.APP.prepare('UPDATE partner_links SET guest_uid = NULL, updated_at = ? WHERE owner_uid = ?')
    .bind(new Date().toISOString(), link.owner_uid)
    .run();
}

export async function releasePartnerOnDelete(env, uid) {
  await ensurePartnerTables(env);
  const owned = await linkForOwner(env, uid);
  if (owned?.guest_uid) await dropGuestAccess(env, owned);
  if (owned) {
    await env.APP.prepare('DELETE FROM partner_links WHERE owner_uid = ?').bind(uid).run();
  }
  const asGuest = await env.APP.prepare('SELECT * FROM partner_links WHERE guest_uid = ?').bind(uid).first();
  if (!asGuest) return;
  await env.APP.prepare('UPDATE partner_links SET guest_uid = NULL, updated_at = ? WHERE owner_uid = ?')
    .bind(new Date().toISOString(), asGuest.owner_uid)
    .run();
}

async function tooManyAttempts(env, uid) {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const row = await env.APP.prepare(
    'SELECT COUNT(*) AS n FROM partner_redeem_attempts WHERE firebase_uid = ? AND attempted_at > ?',
  )
    .bind(uid, since)
    .first();
  return Number(row?.n) >= ATTEMPT_LIMIT;
}

async function noteAttempt(env, uid) {
  await env.APP.prepare(
    'INSERT INTO partner_redeem_attempts (firebase_uid, attempted_at) VALUES (?, ?)',
  )
    .bind(uid, new Date().toISOString())
    .run();
}

async function userResponse(env, uid) {
  const row = await getUserRow(env, uid);
  return json({ user: await toPublicUser(env, row) });
}

export async function handlePartnerRedeem(request, env, identity) {
  try {
    const body = await readJson(request);
    const code = String(body.code || '').trim();
    if (!code) return errorJson('Enter a code.', 400);
    await ensurePartnerTables(env);
    if (await tooManyAttempts(env, identity.uid)) {
      return errorJson('Too many tries. Wait an hour and try again.', 429);
    }
    const guest = await getUserRow(env, identity.uid);
    if (guest?.billing_plan === 'solo' || guest?.billing_plan === 'partner') {
      return errorJson('You already have a plan.', 400);
    }
    if (guest?.billing_plan === 'guest') {
      return errorJson("You're already on a partner plan.", 400);
    }
    const link = await env.APP.prepare('SELECT * FROM partner_links WHERE code = ? AND active = 1')
      .bind(code)
      .first();
    if (!link) {
      await noteAttempt(env, identity.uid);
      return errorJson("That code doesn't work.", 400);
    }
    if (link.owner_uid === identity.uid) {
      return errorJson("That's your code. Send it to a friend.", 400);
    }
    const usedBySomeoneElse = (link.guest_uid && link.guest_uid !== identity.uid)
      || (link.redeemed_uid && link.redeemed_uid !== identity.uid);
    if (usedBySomeoneElse) return errorJson('That code is already in use.', 400);
    const owner = await getUserRow(env, link.owner_uid);
    if (!owner || owner.billing_plan !== 'partner' || owner.subscription_tier !== 'pro') {
      await noteAttempt(env, identity.uid);
      return errorJson("That code doesn't work.", 400);
    }
    const now = new Date().toISOString();
    await env.APP.prepare(
      `UPDATE partner_links
       SET guest_uid = ?, redeemed_uid = ?, updated_at = ?
       WHERE owner_uid = ? AND code = ? AND active = 1
         AND (guest_uid IS NULL OR guest_uid = '' OR guest_uid = ?)
         AND (redeemed_uid IS NULL OR redeemed_uid = '' OR redeemed_uid = ?)`,
    )
      .bind(identity.uid, identity.uid, now, link.owner_uid, code, identity.uid, identity.uid)
      .run();
    const claimed = await linkForOwner(env, link.owner_uid);
    if (claimed?.guest_uid !== identity.uid || (claimed?.redeemed_uid && claimed.redeemed_uid !== identity.uid)) {
      return errorJson('That code is already in use.', 400);
    }
    await updateUserBilling(env, identity.uid, {
      tier: 'pro',
      limit: quotaLimit(env, 'pro'),
      billingPlan: 'guest',
      partnerOwnerUid: link.owner_uid,
      stripeStatus: owner.stripe_status || '',
      stripeTrialEnd: owner.stripe_trial_end || '',
      stripePeriodEnd: owner.stripe_period_end || '',
      stripeCancelAtPeriodEnd: Number(owner.stripe_cancel_at_period_end) === 1 ? 1 : 0,
      stripePromo: owner.stripe_promo || '',
    });
    return userResponse(env, identity.uid);
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : 'Could not redeem that code', err.status || 500);
  }
}

export async function handlePartnerReset(env, identity) {
  const row = await getUserRow(env, identity.uid);
  if (row?.billing_plan !== 'partner') return errorJson('Partner study is not active on this account.', 403);
  const link = await linkForOwner(env, identity.uid);
  if (!link?.active) return errorJson('Partner study is not active on this account.', 403);
  const code = generatePartnerCode();
  await env.APP.prepare(
    'UPDATE partner_links SET code = ?, redeemed_uid = guest_uid, updated_at = ? WHERE owner_uid = ?',
  )
    .bind(code, new Date().toISOString(), identity.uid)
    .run();
  return userResponse(env, identity.uid);
}

export async function handlePartnerRemove(env, identity) {
  const row = await getUserRow(env, identity.uid);
  if (row?.billing_plan !== 'partner') return errorJson('Partner study is not active on this account.', 403);
  const link = await linkForOwner(env, identity.uid);
  if (!link?.active || !link.guest_uid) return errorJson('No partner is linked.', 400);
  await dropGuestAccess(env, link);
  await env.APP.prepare(
    `UPDATE partner_links
     SET redeemed_uid = COALESCE(NULLIF(redeemed_uid, ''), guest_uid),
         guest_uid = NULL,
         updated_at = ?
     WHERE owner_uid = ?`,
  )
    .bind(new Date().toISOString(), identity.uid)
    .run();
  return userResponse(env, identity.uid);
}
