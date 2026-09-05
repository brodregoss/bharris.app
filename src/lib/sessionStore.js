// Persists the in-progress study session so a user can resume where they left off.
const KEY = 'lms_session_v1';

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.terms || !data.terms.length) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSession(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('lms:session'));
  } catch {
    // ignore quota / serialization errors
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('lms:session'));
  } catch {
    // ignore
  }
}

// Snapshot of the most recently finished cram — kept so the home screen can
// offer "restart cram" / "practice" on the same terms after the active session
// is cleared.
const FINISHED_KEY = 'lms_finished_v1';

export function loadFinishedSession() {
  try {
    const raw = localStorage.getItem(FINISHED_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.terms || !data.terms.length) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveFinishedSession(data) {
  try {
    localStorage.setItem(FINISHED_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// Practice uses the in-progress cram if one exists, otherwise the last finished set.
export function loadPracticeSource() {
  const active = loadSession();
  if (active?.terms?.length) return { kind: 'active', session: active };
  const finished = loadFinishedSession();
  if (finished?.terms?.length) return { kind: 'finished', session: finished };
  return null;
}

export function savePracticeTerms(source, terms) {
  if (!source?.session) return;
  if (source.kind === 'active') {
    saveSession({ ...source.session, terms });
  } else {
    saveFinishedSession({ ...source.session, terms });
  }
}