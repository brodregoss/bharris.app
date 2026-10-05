import { errorJson, json, quotaLimit, readJson } from './util.js';
import { getUserRow, toPublicUser, updateQuota } from './users.js';

function entitlementActive(subscriber, entitlementId) {
  const entitlements = subscriber?.subscriber?.entitlements
    || subscriber?.entitlements
    || {};
  const match = entitlements[entitlementId];
  if (!match) return false;
  if (match.is_active === false) return false;
  const expires = match.expires_date;
  if (!expires) return true;
  return new Date(expires).getTime() > Date.now();
}

async function fetchSubscriber(env, uid) {
  const secret = env.REVENUECAT_SECRET_KEY;
  if (!secret) throw new Error('Server is missing REVENUECAT_SECRET_KEY');
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.message || 'Could not read subscription');
  return payload;
}

export function webPlanActive(row) {
  const plan = row?.billing_plan;
  return plan === 'solo' || plan === 'partner' || plan === 'guest';
}

export async function appleEntitlementActive(env, uid) {
  try {
    if (!env.REVENUECAT_SECRET_KEY) return false;
    const subscriber = await fetchSubscriber(env, uid);
    return entitlementActive(subscriber, env.REVENUECAT_ENTITLEMENT_ID || 'Study Pro');
  } catch {
    return false;
  }
}

export async function applyEntitlement(env, uid, isPro) {
  const existing = await getUserRow(env, uid);
  const tier = isPro || webPlanActive(existing) ? 'pro' : 'free';
  const row = await updateQuota(env, uid, {
    tier,
    limit: quotaLimit(env, tier),
  });
  return row;
}

export async function handleProUnlock(request, env, identity) {
  const body = await readJson(request);
  if (!passwordsMatch(body.password)) return errorJson('That password is wrong.', 401);
  const row = await applyEntitlement(env, identity.uid, true);
  return json({ user: await toPublicUser(env, row), pro: true });
}

const UNLOCK_PASSWORD = '95032';

function passwordsMatch(given) {
  const attempt = new TextEncoder().encode(String(given ?? ''));
  const expected = new TextEncoder().encode(UNLOCK_PASSWORD);
  if (attempt.byteLength !== expected.byteLength) return false;
  return crypto.subtle.timingSafeEqual(attempt, expected);
}

export async function handleSubscriptionRefresh(env, identity) {
  try {
    const subscriber = await fetchSubscriber(env, identity.uid);
    const entitlementId = env.REVENUECAT_ENTITLEMENT_ID || 'Study Pro';
    const isPro = entitlementActive(subscriber, entitlementId);
    const row = await applyEntitlement(env, identity.uid, isPro);
    return json({ user: await toPublicUser(env, row), pro: isPro });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : 'Could not refresh subscription', 502);
  }
}

export async function handleRevenueCatWebhook(request, env) {
  const secret = String(env.REVENUECAT_WEBHOOK_SECRET || '');
  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) return errorJson('Unauthorized', 401);

  const body = await readJson(request);
  const uid = body?.event?.app_user_id || body?.app_user_id;
  if (!uid) return errorJson('Missing app_user_id', 400);

  const type = String(body?.event?.type || body?.type || '').toUpperCase();
  const lapsed = /EXPIRATION|REFUND|CANCELLATION|BILLING_ISSUE/.test(type) && !/PRODUCT_CHANGE/.test(type);
  const granted = /INITIAL_PURCHASE|RENEWAL|UNCANCELLATION|NON_RENEWING_PURCHASE|PRODUCT_CHANGE/.test(type);
  if (!lapsed && !granted) {
    try {
      const subscriber = await fetchSubscriber(env, uid);
      const isPro = entitlementActive(subscriber, env.REVENUECAT_ENTITLEMENT_ID || 'Study Pro');
      await applyEntitlement(env, uid, isPro);
    } catch {
      // Event types we do not recognize still return 200 so RevenueCat does not retry forever.
    }
    return json({ ok: true, ignored: true });
  }

  const existing = await getUserRow(env, uid);
  if (!existing) return json({ ok: true, missingUser: true });
  const row = await applyEntitlement(env, uid, granted && !lapsed);
  return json({ ok: true, user: await toPublicUser(env, row) });
}
