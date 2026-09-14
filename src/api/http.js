import { Capacitor, CapacitorHttp } from '@capacitor/core';

export function apiEndpoint(name) {
  const configured = String(import.meta.env.VITE_LLM_PROXY_URL || '').trim().replace(/\/$/, '');
  const onLocalBrowser = !Capacitor.isNativePlatform()
    && typeof window !== 'undefined'
    && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  if (onLocalBrowser) return `/api/${name}`;
  if (configured) {
    const origin = configured.replace(/\/api\/llm$/i, '');
    return `${origin}/api/${name}`;
  }
  if (!Capacitor.isNativePlatform()) return `/api/${name}`;
  return '';
}

function errorMessage(payload, status) {
  const message = payload?.error?.message || payload?.error;
  if (typeof message === 'string' && message.trim()) return message;
  return `Request failed (${status || 'network'})`;
}

function withToken(body, token) {
  if (!token) return body;
  return { ...body, accountToken: token };
}

function isNetworkError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|load failed|internet connection appears to be offline/i.test(message);
}

async function postWithFetch(url, headers, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorMessage(data, res.status));
  return data;
}

export async function postJson(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const payload = withToken(body, token);

  if (!Capacitor.isNativePlatform()) {
    return postWithFetch(url, headers, payload);
  }

  try {
    return await postWithFetch(url, headers, payload);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
  }

  const res = await CapacitorHttp.post({ url, headers, data: payload });
  const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  if (res.status < 200 || res.status >= 300) {
    throw new Error(errorMessage(data, res.status));
  }
  return data;
}
