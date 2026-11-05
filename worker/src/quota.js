import { errorJson, json, quotaLimit } from './util.js';
import { getUserRow, requireFreshQuota, updateQuota } from './users.js';
import { recordEvent } from './events.js';

export function quotaPayload(row) {
  const used = Number(row.ai_quota_used) || 0;
  const limit = Number(row.ai_quota_limit) || 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    tier: row.subscription_tier || 'free',
    period: row.ai_quota_period,
  };
}

export async function assertQuota(env, uid, feature = '') {
  const fresh = await requireFreshQuota(env, await getUserRow(env, uid));
  if (!fresh) return { error: errorJson('Account not found', 404) };
  const used = Number(fresh.ai_quota_used) || 0;
  const limit = Number(fresh.ai_quota_limit) || quotaLimit(env, fresh.subscription_tier);
  if (used >= limit) {
    await recordEvent(env, { uid, name: 'cap_hit', feature });
    return {
      error: json(
        {
          error: {
            message: 'This month’s AI limit is used up. Upgrade to keep using study AI.',
            code: 'upgrade_required',
          },
          quota: quotaPayload({ ...fresh, ai_quota_limit: limit }),
        },
        402,
      ),
    };
  }
  return { row: { ...fresh, ai_quota_limit: limit } };
}

export async function incrementQuota(env, uid, row) {
  const used = Number(row.ai_quota_used) || 0;
  const limit = Number(row.ai_quota_limit) || quotaLimit(env, row.subscription_tier);
  return updateQuota(env, uid, { used: used + 1, limit });
}
