import { clearPhoto } from '@/lib/imageData';

const UID_KEY = 'lms_active_uid';
const LEGACY_KEYS = [
  'lms_session_v1',
  'lms_finished_v1',
  'lms_onboarded_v2',
  'lms_panic_summary_v1',
];

export function getActiveUid() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(UID_KEY) || '';
}

function adoptLegacyKeys(uid, previousUid) {
  if (typeof window === 'undefined' || !uid) return;
  const sameUser = !!previousUid && previousUid === uid;
  for (const base of LEGACY_KEYS) {
    const scoped = `${base}:${uid}`;
    if (sameUser && !localStorage.getItem(scoped)) {
      const legacy = localStorage.getItem(base);
      if (legacy) localStorage.setItem(scoped, legacy);
    }
    localStorage.removeItem(base);
  }
}

export function setActiveUid(uid, previousUid = getActiveUid()) {
  if (typeof window === 'undefined') return;
  const next = String(uid || '');
  const prev = String(previousUid || '');
  if (next) {
    adoptLegacyKeys(next, prev);
    localStorage.setItem(UID_KEY, next);
  } else {
    localStorage.removeItem(UID_KEY);
  }
  if (prev !== next) {
    clearPhoto();
    window.dispatchEvent(new Event('lms:session'));
  }
}

export function userStorageKey(base) {
  const uid = getActiveUid();
  if (!uid) return '';
  return `${base}:${uid}`;
}
