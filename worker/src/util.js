export const VIRTUAL_BUCKETS = 65536;
export const SHARD_BINDINGS = [
  'USER_00',
  'USER_01',
  'USER_02',
  'USER_03',
  'USER_04',
  'USER_05',
  'USER_06',
  'USER_07',
];

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function errorJson(message, status = 400, extra = {}) {
  return json({ error: { message, ...extra } }, status);
}

export function periodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function quotaLimit(env, tier) {
  const free = Number(env.FREE_AI_QUOTA) || 5;
  const pro = Number(env.PRO_AI_QUOTA) || 30;
  return tier === 'pro' ? pro : free;
}

export function sessionHistoryLimit(tier) {
  return tier === 'pro' ? 30 : 10;
}

export function publicUser(row, { isAdmin = false, partnerCode = '', partnerLinked = false } = {}) {
  const used = Number(row.ai_quota_used) || 0;
  const limit = Number(row.ai_quota_limit) || 0;
  const remaining = Math.max(0, limit - used);
  const unlimited = row.subscription_tier === 'pro' && limit >= 100000;
  const billingPlan = row.billing_plan || '';
  return {
    uid: row.firebase_uid,
    email: row.email || '',
    displayName: row.display_name || '',
    isAdmin,
    subscriptionTier: row.subscription_tier || 'free',
    billingPlan,
    hasBilling: !!row.stripe_customer_id,
    billingNotice: row.billing_notice === 'beta_ended' ? 'beta_ended' : '',
    subscriptionStatus: row.stripe_status || '',
    trialEndsAt: row.stripe_trial_end || '',
    periodEndsAt: row.stripe_period_end || '',
    cancelAtPeriodEnd: Number(row.stripe_cancel_at_period_end) === 1,
    billingPromo: row.stripe_promo === 'beta' ? 'beta' : '',
    partnerCode: billingPlan === 'partner' ? partnerCode : '',
    partnerLinked: billingPlan === 'partner' && partnerLinked,
    doStatus: row.do_status || 'pending',
    aiQuotaUsed: used,
    aiQuotaLimit: limit,
    remainingQuota: remaining,
    hasBudget: unlimited || remaining > 0,
    unlimited,
    period: row.ai_quota_period || periodKey(),
    termsAccepted: !!row.terms_accepted_at,
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
