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

export async function postJson(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
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
