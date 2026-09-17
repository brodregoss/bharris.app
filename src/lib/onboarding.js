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
