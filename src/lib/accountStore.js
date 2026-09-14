import { apiEndpoint, postJson } from '@/api/http';

const SESSION_KEY = 'lms_unlock_v1';
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeAccount(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  notify();
}

export function formatUsd(value, { compact = false } = {}) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const amount = Number(value);
  const digits = compact && amount >= 1 && Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getToken() {
  return readSession()?.token || '';
}

export function getCurrentUser() {
  return readSession()?.user || null;
}

export function cacheUser(user) {
  const session = readSession();
  if (!session?.token || !user) return user;
  writeSession({ ...session, user });
  return user;
}

async function accountRequest(action, payload = {}) {
  const url = apiEndpoint('account');
  if (!url) throw new Error('The password screen is not available in this build.');
  return postJson(url, { action, ...payload }, getToken());
}

export async function unlockWithPin(pin) {
  const data = await accountRequest('unlock', { pin });
  writeSession({ token: data.token, user: data.user });
  return data.user;
}

export function lockApp() {
  writeSession(null);
}

export async function refreshUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const data = await accountRequest('me');
    cacheUser(data.user);
    return data.user;
  } catch {
    writeSession(null);
    return null;
  }
}

export async function getUsage() {
  const data = await accountRequest('usage');
  if (data.me) cacheUser(data.me);
  return data;
}

export function assertCanSpend() {
  const user = getCurrentUser();
  if (!user) throw new Error('Enter the password to use study AI.');
  if (user.unlimited) return user;
  if (!user.hasBudget) {
    throw new Error('Study AI isn’t available right now.');
  }
  if ((user.remainingUsd ?? 0) <= 0) {
    throw new Error('This month’s AI limit is used up.');
  }
  return user;
}
