const GATE_KEY = 'lms_admin_unlocked';
export const ADMIN_GATE_PASSWORD = '95032';

export function isAdminGateOpen() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(GATE_KEY) === '1';
}

export function openAdminGate() {
  sessionStorage.setItem(GATE_KEY, '1');
}

export function closeAdminGate() {
  sessionStorage.removeItem(GATE_KEY);
}

export function checkAdminPassword(value) {
  return String(value || '') === ADMIN_GATE_PASSWORD;
}
