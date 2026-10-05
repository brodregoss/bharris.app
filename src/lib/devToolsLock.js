const KEY = 'bharris-dev-tools-unlocked';
const CODE = '95032';

export function devToolsUnlocked() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function tryUnlockDevTools(code) {
  if (String(code || '').trim() !== CODE) return false;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    return false;
  }
  window.dispatchEvent(new Event('bharris-dev-tools'));
  return true;
}
