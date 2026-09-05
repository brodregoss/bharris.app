const STORAGE_KEY = 'lms_openai_api_key';

export function getOpenAIKey() {
  if (typeof window === 'undefined') return '';
  return (localStorage.getItem(STORAGE_KEY) || '').trim();
}

export function setOpenAIKey(key) {
  const value = String(key || '').trim();
  if (!value) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, value);
}

export function clearOpenAIKey() {
  localStorage.removeItem(STORAGE_KEY);
}

export function maskOpenAIKey(key) {
  const value = String(key || '').trim();
  if (value.length < 8) return '';
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}
