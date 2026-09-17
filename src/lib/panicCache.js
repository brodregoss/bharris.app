import { workerRequest } from '@/lib/workerClient';
import { loadSession } from '@/lib/sessionStore';
import { userStorageKey } from '@/lib/userStorage';

const KEY = 'lms_panic_summary_v1';

export function panicSignature(terms) {
  return terms
    .filter((t) => t.tier === 'critical' || t.tier === 'core')
    .map((t) =>
      [t.id, t.tier, t.confidence, t.correctStreak || 0, t.testResult,
        (t.recallHistory || []).map((h) => h.result).join('')].join('|')
    )
    .join(';;');
}

export function loadPanicSummary() {
  const key = userStorageKey(KEY);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePanicSummary(signature, text) {
  const key = userStorageKey(KEY);
  const record = { signature, text, generatedAt: Date.now() };
  try {
    if (key) localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // ignore
  }
  const session = loadSession();
  if (session?.id) {
    workerRequest('POST', `/v1/sessions/panic/${session.id}`, record).catch(() => {});
  }
}
