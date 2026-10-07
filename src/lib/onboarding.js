import { safeAuthReturn } from '@/lib/authReturn';
import { loadSession } from '@/lib/sessionStore';
import { userStorageKey } from '@/lib/userStorage';

export const ONBOARDING_FLAG = 'lms_onboarded_v2';

export function isOnboarded() {
  if (typeof window === 'undefined') return false;
  const key = userStorageKey(ONBOARDING_FLAG);
  if (!key) return false;
  return !!localStorage.getItem(key) || !!loadSession();
}

export function markOnboarded() {
  const key = userStorageKey(ONBOARDING_FLAG);
  if (!key) return;
  localStorage.setItem(key, '1');
}

export function afterAuthPath() {
  if (typeof window === 'undefined') return '/';
  return isOnboarded() ? '/' : '/welcome';
}

const AUTH_RETURN_KEY = 'bharris-auth-return';

export { safeAuthReturn };

export function rememberAuthReturn() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const dest = safeAuthReturn(new URLSearchParams(query).get('return') || '');
  if (!dest) return;
  try {
    sessionStorage.setItem(AUTH_RETURN_KEY, dest);
  } catch {
    // Sign-in can still finish inside the app.
  }
}

export function authReturnDest() {
  rememberAuthReturn();
  try {
    return safeAuthReturn(sessionStorage.getItem(AUTH_RETURN_KEY) || '');
  } catch {
    return '';
  }
}

let pendingAuthReturn = '';

export function clearStaleAuthReturn() {
  pendingAuthReturn = '';
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch {
    // Nothing else to clear.
  }
}

export function leaveForAuthReturn() {
  const dest = pendingAuthReturn || authReturnDest();
  if (!dest) return false;
  pendingAuthReturn = dest;
  try {
    sessionStorage.removeItem(AUTH_RETURN_KEY);
  } catch {
    // Continue to the plans page anyway.
  }
  window.location.replace(dest);
  return true;
}
