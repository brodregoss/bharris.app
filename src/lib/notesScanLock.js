import { workerRequest } from '@/lib/workerClient';
import { devAuthHeaders } from '@/lib/devToolsLock';

const KEY = 'lms_notes_scan_v1';

function readRecord() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!parsed?.token || !Number(parsed.expiresAt)) return null;
    if (Number(parsed.expiresAt) <= Date.now() + 5000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function notesScanUnlocked() {
  return Boolean(readRecord());
}

export function clearNotesScanToken() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function scanAuthHeaders() {
  const record = readRecord();
  return record ? { 'X-Notes-Scan-Token': record.token } : {};
}

export function isScanLockError(err) {
  const message = err instanceof Error ? err.message : String(err || '');
  return /notes password|notes scanning is not set up|too many tries|that password is wrong/i.test(message);
}

export async function unlockNotesScan(password) {
  let data;
  try {
    data = await workerRequest('POST', '/v1/notes/scan-unlock', {
      password: String(password || ''),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (/not found/i.test(message)) throw new Error('Notes scanning is not set up.');
    throw err;
  }
  if (!data?.token || !Number(data.expiresAt)) {
    throw new Error('Notes scanning is not set up.');
  }
  sessionStorage.setItem(KEY, JSON.stringify({
    token: data.token,
    expiresAt: Number(data.expiresAt),
  }));
  return true;
}

export async function refreshNotesScanUnlock() {
  if (!notesScanUnlocked()) return false;
  try {
    await workerRequest('GET', '/v1/notes/scan-session', undefined, scanAuthHeaders());
    return true;
  } catch (err) {
    if (isScanLockError(err)) clearNotesScanToken();
    return notesScanUnlocked();
  }
}

export function generateNotesScanCode() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const body = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  return body.replace(/(.{4})(?!$)/g, '$1-');
}

export async function fetchScanLock() {
  return workerRequest('GET', '/v1/notes/scan-admin', undefined, devAuthHeaders());
}

export async function killScanLock() {
  const data = await workerRequest('POST', '/v1/notes/scan-kill', undefined, devAuthHeaders());
  clearNotesScanToken();
  return data;
}

export async function replaceScanLock(password) {
  const data = await workerRequest('POST', '/v1/notes/scan-password', {
    password: String(password || ''),
  }, devAuthHeaders());
  clearNotesScanToken();
  return data;
}
