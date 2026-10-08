import { workerRequest } from '@/lib/workerClient';
import { getActiveUid } from '@/lib/userStorage';

const KEY = 'lms_dev_tools_v1';
const LEGACY_KEY = 'bharris-dev-tools-unlocked';

function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode */
  }
}

function accountUid(uid) {
  return String(uid || getActiveUid() || '');
}

function readAll() {
  clearLegacy();
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    if (parsed.token) return {};
    return parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {};
  } catch {
    return {};
  }
}

function writeAll(accounts) {
  sessionStorage.setItem(KEY, JSON.stringify({ accounts }));
}

function readRecord(uid) {
  const id = accountUid(uid);
  if (!id) return null;
  const record = readAll()[id];
  if (!record?.token || !Number(record.expiresAt)) return null;
  if (Number(record.expiresAt) <= Date.now() + 5000) {
    lockDevTools(id);
    return null;
  }
  return record;
}

export function devToolsUnlocked(uid) {
  return Boolean(readRecord(uid));
}

export function devAuthHeaders() {
  const record = readRecord();
  return record ? { 'X-Dev-Tools-Token': record.token } : {};
}

export function lockDevTools(uid) {
  const id = accountUid(uid);
  try {
    const accounts = readAll();
    if (id) delete accounts[id];
    if (Object.keys(accounts).length) writeAll(accounts);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event('bharris-dev-tools'));
}

export async function tryUnlockDevTools(code, uid) {
  const id = accountUid(uid);
  if (!id) throw new Error('Sign in to continue.');
  let data;
  try {
    data = await workerRequest('POST', '/v1/dev-tools/unlock', {
      code: String(code || '').trim(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (/not found/i.test(message)) throw new Error('Dev tools are not set up.');
    throw err;
  }
  if (!data?.token || !Number(data.expiresAt)) {
    throw new Error('Dev tools are not set up.');
  }
  writeAll({
    ...readAll(),
    [id]: { token: data.token, expiresAt: Number(data.expiresAt) },
  });
  clearLegacy();
  window.dispatchEvent(new Event('bharris-dev-tools'));
  return true;
}
