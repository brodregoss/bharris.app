import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { getOpenAIKey } from '@/lib/openaiKey';

const MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const DEV_OPENAI_PROXY = '/openai-proxy/v1/chat/completions';

export function hasSharedAi() {
  if (import.meta.env.VITE_LLM_PROXY_URL) return true;
  return Boolean(import.meta.env.DEV);
}

function proxyUrl() {
  const configured = String(import.meta.env.VITE_LLM_PROXY_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  if (!Capacitor.isNativePlatform()) return '/api/llm';
  return '';
}

function toStrictSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;
  const next = { ...schema };
  if (next.properties) {
    next.type = next.type || 'object';
    next.additionalProperties = false;
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, value]) => [key, toStrictSchema(value)])
    );
    next.required = Object.keys(next.properties);
  }
  if (next.items) next.items = toStrictSchema(next.items);
  return next;
}

function openaiErrorMessage(payload, status) {
  const message = payload?.error?.message || payload?.error;
  if (typeof message === 'string' && message.trim()) return message;
  if (status === 401) return 'OpenAI rejected the key. Check it in Settings.';
  return `AI request failed (${status || 'network'})`;
}

async function postJson(url, headers, body) {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.post({ url, headers, data: body });
    const payload = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    if (res.status < 200 || res.status >= 300) {
      throw new Error(openaiErrorMessage(payload, res.status));
    }
    return payload;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(openaiErrorMessage(payload, res.status));
  return payload;
}

async function invokeWithOwnKey({ prompt, response_json_schema }, apiKey) {
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
  };
  if (response_json_schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'result',
        strict: true,
        schema: toStrictSchema(response_json_schema),
      },
    };
  }
  const url = Capacitor.isNativePlatform() ? OPENAI_URL : DEV_OPENAI_PROXY;
  const data = await postJson(url, {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }, body);
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('OpenAI returned an empty response');
  }
  if (!response_json_schema) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('OpenAI returned unreadable JSON');
  }
}

async function invokeWithProxy(payload) {
  const url = proxyUrl();
  if (!url) {
    throw new Error('Add your OpenAI API key in Settings, or set up shared AI (see README).');
  }
  const data = await postJson(url, { 'Content-Type': 'application/json' }, payload);
  if (data?.result == null) throw new Error(data?.error || 'AI returned an empty response');
  return data.result;
}

/**
 * Drop-in replacement for Base44 InvokeLLM.
 * Uses a personal Settings key if present, otherwise the shared server.
 */
export async function invokeLlm({ prompt, response_json_schema } = {}) {
  if (!prompt) throw new Error('Missing prompt');
  const ownKey = getOpenAIKey();
  if (ownKey) return invokeWithOwnKey({ prompt, response_json_schema }, ownKey);
  return invokeWithProxy({ prompt, response_json_schema });
}
