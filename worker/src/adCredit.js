export const AD_CREDIT_CALLS = 10;

// One finished ad adds AD_CREDIT_CALLS for a free account that is out.
// Paid plans never get credits from an ad.
export function adCreditGrant(row) {
  const tier = row?.subscription_tier || 'free';
  const plan = row?.billing_plan || '';
  if (tier === 'pro' || plan === 'solo' || plan === 'partner' || plan === 'guest') {
    return { ok: false, status: 403, message: 'This plan does not use ads.' };
  }
  const used = Number(row?.ai_quota_used) || 0;
  const limit = Number(row?.ai_quota_limit) || 0;
  if (limit > 0 && used < limit) return { ok: true, granted: 0, used, limit };
  return { ok: true, granted: AD_CREDIT_CALLS, used, limit: limit + AD_CREDIT_CALLS };
}
