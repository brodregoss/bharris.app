import { apiEndpoint, postJson } from '@/api/http';

const SESSION_KEY = 'lms_session_v1';
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
  if (!url) throw new Error('Account server is not available in this build.');
  return postJson(url, { action, ...payload }, getToken());
}

export async function createAccount(email, password) {
  const data = await accountRequest('register', { email, password });
  writeSession({ token: data.token, user: data.user });
  return data.user;
}

export async function signIn(email, password) {
  const data = await accountRequest('login', { email, password });
  writeSession({ token: data.token, user: data.user });
  return data.user;
}

export function signOut() {
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

export async function listAccounts() {
  const data = await accountRequest('list');
  return data.accounts || [];
}

export async function setAccountLimit(email, { monthlyLimitUsd, unlimited = false } = {}) {
  const data = await accountRequest('setLimit', { email, monthlyLimitUsd, unlimited });
  const current = getCurrentUser();
  if (current?.email === data.user?.email) cacheUser(data.user);
  return data.user;
}

export function assertCanSpend() {
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in to use study AI.');
  if (user.unlimited) return user;
  if (!user.hasBudget) {
    throw new Error('This account doesn’t have an AI budget yet.');
  }
  if ((user.remainingUsd ?? 0) <= 0) {
    throw new Error('This account has used its monthly AI cap.');
  }
  return user;
}
