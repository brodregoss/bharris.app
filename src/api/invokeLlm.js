import { Capacitor, CapacitorHttp } from '@capacitor/core';

function proxyUrl() {
  const configured = String(import.meta.env.VITE_LLM_PROXY_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (!Capacitor.isNativePlatform()) return '/api/llm';
  return '';
}

function errorMessage(payload, status) {
  const message = payload?.error?.message || payload?.error;
  if (typeof message === 'string' && message.trim()) return message;
  return `Study AI is not available right now (${status || 'network'})`;
}

async function postJson(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({ url, headers, data: body });
    const payload = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (res.status < 200 || res.status >= 300) {
      throw new Error(errorMessage(payload, res.status));
    }
    return payload;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorMessage(payload, res.status));
  return payload;
}

/**
 * Drop-in replacement for Base44 InvokeLLM.
 * Always uses the shared server; the OpenAI key never lives in the app.
 */
export async function invokeLlm({ prompt, response_json_schema, image } = {}) {
  if (!prompt) throw new Error('Missing prompt');
  const url = proxyUrl();
  if (!url) {
    throw new Error('Study AI is not available in this build.');
  }
  const data = await postJson(url, { prompt, response_json_schema, image });
  if (data?.result == null) throw new Error(data?.error || 'Study AI returned an empty response');
  return data.result;
}
