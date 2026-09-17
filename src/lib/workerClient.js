import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { APP_CONFIG } from '@/lib/appConfig';
import { getIdToken } from '@/lib/firebase';

export class QuotaError extends Error {
  constructor(payload, status = 402) {
    super(payload?.error?.message || payload?.error || 'Upgrade required');
    this.name = 'QuotaError';
    this.status = status;
    this.code = payload?.error?.code || 'upgrade_required';
    this.quota = payload?.quota || null;
    this.payload = payload;
  }
}

export function workerOrigin() {
  const configured = APP_CONFIG.workerUrl;
  const onLocalBrowser = !Capacitor.isNativePlatform()
    && typeof window !== 'undefined'
    && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  if (onLocalBrowser) return '';
  return configured;
}

export function workerPath(path) {
  const origin = workerOrigin();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${suffix}` : suffix;
}

function errorMessage(payload, status) {
  const message = payload?.error?.message || payload?.error;
  if (typeof message === 'string' && message.trim()) return message;
  return `Request failed (${status || 'network'})`;
}

function isNetworkError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|load failed|internet connection appears to be offline/i.test(message);
}

function throwIfNotOk(data, status) {
  if (status === 402 || data?.error?.code === 'upgrade_required') {
    throw new QuotaError(data, status);
  }
  if (status < 200 || status >= 300) {
    throw new Error(errorMessage(data, status));
  }
  return data;
}

async function parseResponse(res) {
  const data = await res.json().catch(() => ({}));
  return throwIfNotOk(data, res.status);
}

async function fetchJson(url, { method, headers, body }) {
  const res = await fetch(url, { method, headers, body });
  return parseResponse(res);
}

async function nativeJson(url, { method, headers, body }) {
  const res = await CapacitorHttp.request({
    url,
    method,
    headers,
    data: body ? JSON.parse(body) : undefined,
  });
  const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  return throwIfNotOk(data || {}, res.status);
}

export async function workerRequest(method, path, body) {
  const url = workerPath(path);
  const token = await getIdToken();
  if (!token) throw new Error('Sign in to continue.');
  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  if (!Capacitor.isNativePlatform()) {
    return fetchJson(url, { method, headers, body: payload });
  }

  try {
    return await fetchJson(url, { method, headers, body: payload });
  } catch (err) {
    if (err instanceof QuotaError) throw err;
    if (!isNetworkError(err)) throw err;
  }
  return nativeJson(url, { method, headers, body: payload });
}

export function openPaywall() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('lms:paywall'));
}
