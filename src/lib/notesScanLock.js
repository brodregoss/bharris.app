import { workerRequest } from '@/lib/workerClient';
import { devAuthHeaders } from '@/lib/devToolsLock';

const KEY = 'lms_notes_scan_v1';

export function clearNotesScanToken() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function isScanLockError(err) {
  const message = err instanceof Error ? err.message : String(err || '');
  return /photo upload is off|notes scanning is not set up/i.test(message);
}

export async function fetchPhotoUploadStatus() {
  return workerRequest('GET', '/v1/notes/scan-status');
}

export async function fetchScanLock() {
  return workerRequest('GET', '/v1/notes/scan-admin', undefined, devAuthHeaders());
}

export async function killScanLock() {
  return workerRequest('POST', '/v1/notes/scan-kill', undefined, devAuthHeaders());
}

export async function enableScanLock() {
  return workerRequest('POST', '/v1/notes/scan-enable', undefined, devAuthHeaders());
}
