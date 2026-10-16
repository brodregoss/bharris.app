import { userStorageKey } from '@/lib/userStorage';

const KEY = 'ai_consent_accepted';

export function hasAiConsent() {
  const key = userStorageKey(KEY);
  if (!key) return false;
  return localStorage.getItem(key) === 'true';
}

export function setAiConsent(accepted) {
  const key = userStorageKey(KEY);
  if (!key) return;
  if (accepted) {
    localStorage.setItem(key, 'true');
  } else {
    localStorage.removeItem(key);
  }
}

export function clearAiConsent() {
  const key = userStorageKey(KEY);
  if (key) localStorage.removeItem(key);
}
