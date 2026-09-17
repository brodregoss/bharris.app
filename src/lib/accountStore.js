import { workerRequest } from '@/lib/workerClient';
import { cancelPendingCloudSave } from '@/lib/sessionStore';
import { getActiveUid, setActiveUid } from '@/lib/userStorage';

const USER_KEY = 'lms_user_v2';
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeAccount(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  const user = readUser();
  if (user?.uid && !getActiveUid()) setActiveUid(user.uid, user.uid);
  return user;
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

export function cacheUser(user) {
  if (typeof window === 'undefined') return user;
  if (!user) {
    cancelPendingCloudSave();
    localStorage.removeItem(USER_KEY);
    setActiveUid('');
  } else {
    const previousUid = readUser()?.uid || getActiveUid();
    if (user.uid && previousUid && previousUid !== user.uid) cancelPendingCloudSave();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (user.uid) setActiveUid(user.uid, previousUid);
  }
  notify();
  return user;
}

export function clearAccountCache() {
  cacheUser(null);
}

export async function ensureCloudUser(firebaseUser) {
  const data = await workerRequest('POST', '/v1/users/me', {
    email: firebaseUser?.email || '',
    displayName: firebaseUser?.displayName || '',
  });
  return cacheUser(data.user);
}

export async function refreshUser() {
  try {
    const data = await workerRequest('GET', '/v1/users/me');
    return cacheUser(data.user);
  } catch {
    return readUser();
  }
}

export async function getUsage() {
  const data = await workerRequest('GET', '/v1/users/me/usage');
  if (data.me) cacheUser(data.me);
  else if (data.user) cacheUser(data.user);
  return data;
}

export async function refreshSubscription() {
  const data = await workerRequest('POST', '/v1/users/me/subscription/refresh', {});
  if (data.user) cacheUser(data.user);
  return data;
}

export function assertCanSpend() {
  const user = getCurrentUser();
  if (!user) throw new Error('Sign in to use study AI.');
  if (user.unlimited) return user;
  if (!user.hasBudget || (user.remainingQuota ?? 0) <= 0) {
    throw new Error('This month’s AI limit is used up.');
  }
  return user;
}
