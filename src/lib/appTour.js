import { HOME_TOUR_FLAG, userStorageKey } from '@/lib/userStorage';

export const REPLAY_TOUR_EVENT = 'lms:replay-tour';
const REPLAY_KEY = 'lms_home_tour_replay';

let pendingReplay = false;

export function homeTourChoice() {
  if (typeof window === 'undefined') return '';
  const key = userStorageKey(HOME_TOUR_FLAG);
  if (!key) return '';
  try {
    const value = localStorage.getItem(key) || '';
    return value === 'skipped' || value === 'done' ? value : '';
  } catch {
    return '';
  }
}

export function setHomeTourChoice(value) {
  const key = userStorageKey(HOME_TOUR_FLAG);
  if (!key || (value !== 'skipped' && value !== 'done')) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // The prompt can show again next visit.
  }
}

export function requestHomeTourReplay() {
  pendingReplay = true;
  try {
    sessionStorage.setItem(REPLAY_KEY, '1');
  } catch {
    // The in-memory flag still covers this tab.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(REPLAY_TOUR_EVENT));
  }
}

export function consumeHomeTourReplay() {
  let pending = pendingReplay;
  pendingReplay = false;
  try {
    if (sessionStorage.getItem(REPLAY_KEY) === '1') pending = true;
    if (pending) sessionStorage.removeItem(REPLAY_KEY);
  } catch {
    // Keep the in-memory result.
  }
  return pending;
}
