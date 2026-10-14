import { assertCanSpend, cacheUser } from '@/lib/accountStore';
import { openPaywall, QuotaError, workerRequest } from '@/lib/workerClient';
import { scanAuthHeaders } from '@/lib/notesScanLock';

/**
 * Study AI goes through the Cloudflare Worker. The OpenAI key never lives in the app.
 */
export async function invokeLlm({ prompt, response_json_schema, image, feature = 'complete' } = {}) {
  if (!prompt) throw new Error('Missing prompt');
  try {
    assertCanSpend();
  } catch (err) {
    openPaywall();
    throw err;
  }
  const scanHeaders = image ? scanAuthHeaders() : null;
  try {
    const data = await workerRequest('POST', `/v1/ai/${feature}`, {
      prompt,
      response_json_schema,
      image,
      feature,
    }, scanHeaders || undefined);
    if (data?.result == null) throw new Error(data?.error?.message || 'Study AI returned an empty response');
    if (data.account) cacheUser(data.account);
    return data.result;
  } catch (err) {
    if (err instanceof QuotaError) {
      if (err.payload?.account) cacheUser(err.payload.account);
      openPaywall();
    }
    throw err;
  }
}

export { QuotaError };
