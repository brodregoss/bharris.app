import { errorJson, json, quotaLimit, readJson } from './util.js';
import { appleEntitlementActive } from './billing.js';
import { getUserRow, toPublicUser, updateUserBilling, upsertUser } from './users.js';
import { detachGuest, endPartnerLink, ensureOwnerCode, syncGuestSchedule } from './partner.js';

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);

function siteOrigin(request, env) {
  const configured = String(env.PUBLIC_SITE_ORIGIN || '').replace(/\/$/, '');
  if (configured) return configured;
  return new URL(request.url).origin;
}

function formBody(fields) {
  const params = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value == null || value === '') return;
    params.set(key, String(value));
  });
  return params;
}

async function stripeRequest(env, path, { method = 'GET', fields } = {}) {
  const secret = String(env.STRIPE_SECRET_KEY || '');
  if (!secret) {
    const error = new Error('Subscriptions are not available yet.');
    error.status = 503;
    throw error;
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: fields ? formBody(fields) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(payload?.error?.message || 'Stripe request failed');
    error.status = res.status >= 500 ? 502 : 400;
    throw error;
  }
  return payload;
}

function priceForPlan(env, plan) {
  if (plan === 'solo') return String(env.STRIPE_PRICE_SOLO || '');
  if (plan === 'partner') return String(env.STRIPE_PRICE_PARTNER || '');
  return '';
}

function promoTrialDays(env, code) {
  const expected = String(env.BETA_PROMO_CODE ?? 'beta').trim().toLowerCase();
  const entered = String(code || '').trim().toLowerCase();
  if (!entered) return 0;
  if (!expected || expected === 'off' || entered !== expected) {
    const error = new Error('That code does not work.');
    error.status = 400;
    throw error;
  }
  const days = Number(env.BETA_TRIAL_DAYS ?? 7);
  if (!Number.isInteger(days) || days < 1 || days > 30) return 7;
  return days;
}

function unixToIso(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return new Date(seconds * 1000).toISOString();
}

function scheduleFromSubscription(subscription) {
  const item = subscription?.items?.data?.[0] || {};
  const periodEnd = subscription?.current_period_end || item.current_period_end;
  return {
    stripeStatus: subscription?.status || '',
    stripeTrialEnd: unixToIso(subscription?.trial_end),
    stripePeriodEnd: unixToIso(periodEnd),
    stripeCancelAtPeriodEnd: subscription?.cancel_at_period_end ? 1 : 0,
    stripePromo: subscription?.metadata?.promo === 'beta' ? 'beta' : '',
  };
}

function emptySchedule() {
  return {
    stripeStatus: '',
    stripeTrialEnd: '',
    stripePeriodEnd: '',
    stripeCancelAtPeriodEnd: 0,
    stripePromo: '',
  };
}

export async function grantWebPlan(env, uid, { plan, customerId, subscriptionId, schedule = emptySchedule() }) {
  await detachGuest(env, uid);
  if (plan !== 'partner') await endPartnerLink(env, uid);
  await updateUserBilling(env, uid, {
    tier: 'pro',
    limit: quotaLimit(env, 'pro'),
    billingPlan: plan,
    partnerOwnerUid: '',
    stripeCustomerId: customerId || '',
    stripeSubscriptionId: subscriptionId || '',
    billingNotice: '',
    ...schedule,
  });
  if (plan === 'partner') {
    await ensureOwnerCode(env, uid, { customerId, subscriptionId });
    await syncGuestSchedule(env, uid, schedule);
  }
}

export async function revokeWebPlan(env, uid, { subscriptionId, notice = '' } = {}) {
  const row = await getUserRow(env, uid);
  if (!row) return { missingUser: true };
  if (subscriptionId && row.stripe_subscription_id && row.stripe_subscription_id !== subscriptionId) {
    return { ignored: true };
  }
  if (row.billing_plan === 'partner') await endPartnerLink(env, uid, { notice });
  const apple = await appleEntitlementActive(env, uid);
  const tier = apple ? 'pro' : 'free';
  await updateUserBilling(env, uid, {
    tier,
    limit: quotaLimit(env, tier),
    billingPlan: '',
    partnerOwnerUid: '',
    stripeSubscriptionId: '',
    billingNotice: notice || '',
    ...emptySchedule(),
  });
  return { ok: true };
}

async function syncSubscription(env, subscription, fallbackMeta = {}) {
  const metadata = subscription?.metadata || {};
  const uid = metadata.firebase_uid || fallbackMeta.firebase_uid;
  const plan = metadata.plan || fallbackMeta.plan;
  if (!uid || (plan !== 'solo' && plan !== 'partner')) return { ignored: true };
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : '';
  const paid = PAID_STATUSES.has(subscription.status);
  const row = await getUserRow(env, uid);
  if (
    paid
    && row?.stripe_subscription_id
    && row.stripe_subscription_id !== subscription.id
    && row.billing_plan === 'partner'
    && plan === 'solo'
  ) {
    return { ignored: true };
  }
  if (paid) {
    await grantWebPlan(env, uid, {
      plan,
      customerId,
      subscriptionId: subscription.id,
      schedule: scheduleFromSubscription(subscription),
    });
    return { ok: true, plan };
  }
  const notice = metadata.promo === 'beta' && subscription.status === 'canceled' ? 'beta_ended' : '';
  return revokeWebPlan(env, uid, { subscriptionId: subscription.id, notice });
}

function hexEqual(a, b) {
  const left = new TextEncoder().encode(String(a).toLowerCase());
  const right = new TextEncoder().encode(String(b).toLowerCase());
  if (left.byteLength !== right.byteLength) return false;
  return crypto.subtle.timingSafeEqual(left, right);
}

async function readStripeEvent(request, env) {
  const secret = String(env.STRIPE_WEBHOOK_SECRET || '');
  const header = request.headers.get('Stripe-Signature') || '';
  const raw = await request.text();
  if (!secret) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }
  const parts = header.split(',').map((part) => {
    const idx = part.indexOf('=');
    return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
  });
  const timestamp = parts.find((part) => part[0] === 't')?.[1];
  const signatures = parts.filter((part) => part[0] === 'v1').map((part) => part[1]);
  if (!timestamp || !signatures.length) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${raw}`),
  );
  const expected = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  if (!signatures.some((signature) => hexEqual(signature, expected))) {
    const error = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }
  return JSON.parse(raw);
}

export async function handleCheckout(request, env, identity) {
  try {
    const body = await readJson(request);
    const plan = body.plan === 'partner' ? 'partner' : body.plan === 'solo' ? 'solo' : '';
    if (!plan) return errorJson('Choose a plan.', 400);
    const trialDays = promoTrialDays(env, body.code);
    const row = await upsertUser(env, identity);
    if (row?.billing_plan === 'solo' || row?.billing_plan === 'partner') {
      if (row.billing_plan === plan) return errorJson('You already have this plan.', 409);
      return errorJson('Cancel the current plan before switching.', 409);
    }
    if (trialDays) {
      const trialEnd = new Date(Date.now() + trialDays * 86400000).toISOString();
      await grantWebPlan(env, identity.uid, {
        plan,
        customerId: row?.stripe_customer_id || '',
        subscriptionId: '',
        schedule: {
          stripeStatus: 'trialing',
          stripeTrialEnd: trialEnd,
          stripePeriodEnd: trialEnd,
          stripeCancelAtPeriodEnd: 0,
          stripePromo: 'beta',
        },
      });
      const fresh = await getUserRow(env, identity.uid);
      return json({ granted: true, trialDays, user: await toPublicUser(env, fresh) });
    }
    const price = priceForPlan(env, plan);
    if (!env.STRIPE_SECRET_KEY || !price) return errorJson('Subscriptions are not available yet.', 503);
    const origin = siteOrigin(request, env);
    const fields = {
      mode: 'subscription',
      customer: row?.stripe_customer_id || '',
      customer_email: row?.stripe_customer_id ? '' : identity.email || '',
      client_reference_id: identity.uid,
      success_url: plan === 'partner' ? `${origin}/thanks/?plan=partner` : `${origin}/thanks/`,
      cancel_url: `${origin}/plans/`,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      'metadata[firebase_uid]': identity.uid,
      'metadata[plan]': plan,
      'subscription_data[metadata][firebase_uid]': identity.uid,
      'subscription_data[metadata][plan]': plan,
    };
    fields.payment_method_collection = 'always';
    const session = await stripeRequest(env, '/checkout/sessions', {
      method: 'POST',
      fields,
    });
    if (!session.url) return errorJson('Could not start checkout.', 502);
    return json({ url: session.url, trialDays });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : 'Could not start checkout', err.status || 500);
  }
}

function subscriptionSearchQuery(uid) {
  if (!/^[A-Za-z0-9_-]+$/.test(String(uid || ''))) return '';
  return `metadata['firebase_uid']:'${uid}'`;
}

function newestPaidSubscription(list) {
  return (list || [])
    .filter((subscription) => PAID_STATUSES.has(subscription?.status))
    .sort((a, b) => Number(b.created || 0) - Number(a.created || 0))[0] || null;
}

async function findPaidSubscription(env, uid) {
  const query = subscriptionSearchQuery(uid);
  if (!query || !env.STRIPE_SECRET_KEY) return null;
  const list = await stripeRequest(env, `/subscriptions/search?query=${encodeURIComponent(query)}&limit=10`);
  return newestPaidSubscription(list.data);
}

async function withTimeout(promise, ms = 4000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Billing refresh timed out')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function expireBetaTrial(env, row) {
  if (!row || row.stripe_promo !== 'beta') return row;
  if (row.billing_plan !== 'solo' && row.billing_plan !== 'partner') return row;
  if (row.stripe_subscription_id) return row;
  const end = new Date(row.stripe_trial_end || '');
  if (Number.isNaN(end.getTime()) || end.getTime() > Date.now()) return row;
  await revokeWebPlan(env, row.firebase_uid, { notice: 'beta_ended' });
  return getUserRow(env, row.firebase_uid);
}

export const BILLING_FRESH_MS = 10 * 60 * 1000;
export const BILLING_FRESH_WAIT_MS = 15 * 1000;
const billingJobs = new Map();

export function billingCheckedRecently(row, now = Date.now(), windowMs = BILLING_FRESH_MS) {
  const at = Date.parse(row?.billing_checked_at || '');
  return Number.isFinite(at) && now - at < windowMs;
}

export function shouldAwaitBilling(row, { fresh = false, now = Date.now() } = {}) {
  if (!fresh || !row) return false;
  const needsStripe = !(row.billing_plan || row.stripe_subscription_id || row.subscription_tier === 'pro');
  if (!needsStripe) return false;
  return !billingCheckedRecently(row, now, BILLING_FRESH_WAIT_MS);
}

function refreshBillingOnce(env, uid) {
  let job = billingJobs.get(uid);
  if (!job) {
    job = refreshBillingSchedule(env, uid).finally(() => {
      billingJobs.delete(uid);
    });
    billingJobs.set(uid, job);
  }
  return job;
}

export async function billingForRequest(env, ctx, row, { fresh = false } = {}) {
  if (!row) return row;
  row = await expireBetaTrial(env, row);
  if (!row) return row;
  const now = Date.now();
  if (shouldAwaitBilling(row, { fresh, now })) {
    return (await refreshBillingOnce(env, row.firebase_uid)) || row;
  }
  if (!billingCheckedRecently(row, now)) {
    const job = refreshBillingOnce(env, row.firebase_uid);
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(job);
    else job.catch(() => {});
  }
  return row;
}

async function syncBillingNow(env, uid) {
  const row = await getUserRow(env, uid);
  if (!row) return null;
  if (row.billing_plan === 'guest' && row.partner_owner_uid) {
    await refreshBillingSchedule(env, row.partner_owner_uid);
    const freshGuest = await getUserRow(env, uid);
    if (!freshGuest || freshGuest.billing_plan !== 'guest') return freshGuest;
    const owner = await getUserRow(env, row.partner_owner_uid);
    if (owner?.billing_plan === 'partner') {
      await updateUserBilling(env, uid, {
        stripeStatus: owner.stripe_status || '',
        stripeTrialEnd: owner.stripe_trial_end || '',
        stripePeriodEnd: owner.stripe_period_end || '',
        stripeCancelAtPeriodEnd: Number(owner.stripe_cancel_at_period_end) === 1 ? 1 : 0,
        stripePromo: owner.stripe_promo || '',
      });
    }
    return getUserRow(env, uid);
  }
  if (!env.STRIPE_SECRET_KEY) return row;
  try {
    if (row.stripe_subscription_id) {
      const subscription = await withTimeout(
        stripeRequest(env, `/subscriptions/${row.stripe_subscription_id}`),
      );
      await syncSubscription(env, subscription);
    } else if (!row.billing_plan) {
      const subscription = await withTimeout(findPaidSubscription(env, uid));
      if (subscription) await syncSubscription(env, subscription);
    }
  } catch {
    return getUserRow(env, uid);
  }
  return getUserRow(env, uid);
}

export async function refreshBillingSchedule(env, uid) {
  const existing = await getUserRow(env, uid);
  if (!existing) return null;
  try {
    return await syncBillingNow(env, uid);
  } finally {
    await updateUserBilling(env, uid, {
      billingCheckedAt: new Date().toISOString(),
    }).catch(() => {});
  }
}

export async function handleCancel(env, identity) {
  try {
    const row = await getUserRow(env, identity.uid);
    if (row?.billing_plan !== 'solo' && row?.billing_plan !== 'partner') {
      return errorJson('No website plan to cancel.', 404);
    }
    if (row.stripe_promo === 'beta') {
      if (row.stripe_subscription_id) {
        await cancelStripeSubscription(env, row.stripe_subscription_id).catch(() => {});
      }
      await revokeWebPlan(env, identity.uid, { subscriptionId: row.stripe_subscription_id || '' });
      const fresh = await getUserRow(env, identity.uid);
      return json({ user: await toPublicUser(env, fresh) });
    }
    if (!row.stripe_subscription_id) return errorJson('No website plan to cancel.', 404);
    if (Number(row.stripe_cancel_at_period_end) === 1) {
      return json({ user: await toPublicUser(env, row) });
    }
    const subscription = await stripeRequest(env, `/subscriptions/${row.stripe_subscription_id}`, {
      method: 'POST',
      fields: { cancel_at_period_end: 'true' },
    });
    await syncSubscription(env, subscription);
    const fresh = await getUserRow(env, identity.uid);
    return json({ user: await toPublicUser(env, fresh) });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : 'Could not cancel the plan', err.status || 500);
  }
}

export async function handlePortal(request, env, identity) {
  try {
    const row = await getUserRow(env, identity.uid);
    if (!row?.stripe_customer_id) return errorJson('No website subscription to manage yet.', 404);
    const origin = siteOrigin(request, env);
    const session = await stripeRequest(env, '/billing_portal/sessions', {
      method: 'POST',
      fields: {
        customer: row.stripe_customer_id,
        return_url: `${origin}/account/`,
      },
    });
    if (!session.url) return errorJson('Could not open billing.', 502);
    return json({ url: session.url });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : 'Could not open billing', err.status || 500);
  }
}

export async function handleStripeWebhook(request, env) {
  try {
    const event = await readStripeEvent(request, env);
    const type = event?.type;
    if (type === 'checkout.session.completed') {
      const session = event.data?.object || {};
      if (session.mode !== 'subscription' || !session.subscription) return json({ ok: true, ignored: true });
      const subscription = await stripeRequest(env, `/subscriptions/${session.subscription}`);
      const result = await syncSubscription(env, subscription, session.metadata || {});
      return json({ ok: true, ...result });
    }
    if (type === 'customer.subscription.updated' || type === 'customer.subscription.deleted') {
      const result = await syncSubscription(env, event.data?.object || {});
      return json({ ok: true, ...result });
    }
    return json({ ok: true, ignored: true });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : 'Webhook failed', err.status || 500);
  }
}

export async function cancelStripeSubscription(env, subscriptionId) {
  if (!subscriptionId || !env.STRIPE_SECRET_KEY) return;
  await stripeRequest(env, `/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}
