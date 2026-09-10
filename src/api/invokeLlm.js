import { apiEndpoint, postJson } from '@/api/http';
import { assertCanSpend, cacheUser, getToken } from '@/lib/accountStore';

/**
 * Drop-in replacement for Base44 InvokeLLM.
 * Always uses the shared server; the OpenAI key never lives in the app.
 */
export async function invokeLlm({ prompt, response_json_schema, image } = {}) {
  if (!prompt) throw new Error('Missing prompt');
  assertCanSpend();
  const url = apiEndpoint('llm');
  if (!url) {
    throw new Error('Study AI is not available in this build.');
  }
  const data = await postJson(url, { prompt, response_json_schema, image }, getToken());
  if (data?.result == null) throw new Error(data?.error || 'Study AI returned an empty response');
  if (data.account) cacheUser(data.account);
  return data.result;
}
