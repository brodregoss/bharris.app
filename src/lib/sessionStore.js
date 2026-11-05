import { workerRequest } from '@/lib/workerClient';
import { getActiveUid, userStorageKey } from '@/lib/userStorage';

const KEY = 'lms_session_v1';
const FINISHED_KEY = 'lms_finished_v1';
const NOTES_PRACTICE_KEY = 'lms_practice_notes_v1';

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('lms:session'));
}

function ownedByActiveUser(data) {
  const uid = getActiveUid();
  if (!uid || !data) return null;
  if (data.ownerUid && data.ownerUid !== uid) return null;
  return { ...data, ownerUid: uid };
}

function readJson(baseKey) {
  const key = userStorageKey(baseKey);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.terms || !data.terms.length) return null;
    return ownedByActiveUser(data);
  } catch {
    return null;
  }
}

function writeJson(baseKey, data) {
  const key = userStorageKey(baseKey);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(data));
}

export function loadSession() {
  return readJson(KEY);
}

function withId(data) {
  if (!data) return data;
  return data.id ? data : { ...data, id: newId() };
}

let syncTimer;
let syncUid = '';

export function cancelPendingCloudSave() {
  clearTimeout(syncTimer);
  syncTimer = null;
  syncUid = '';
}

function scheduleCloudSave(session, uid) {
  if (!session?.id || !uid) return;
  clearTimeout(syncTimer);
  syncUid = uid;
  syncTimer = setTimeout(() => {
    if (!syncUid || getActiveUid() !== uid) return;
    workerRequest('PUT', '/v1/sessions/current', { session }).catch(() => {});
  }, 400);
}

function persistActive(data, { replaceId = false } = {}) {
  const uid = getActiveUid();
  if (!uid) return null;
  if (data?.ownerUid && data.ownerUid !== uid) return loadSession();
  const existing = replaceId ? null : loadSession();
  const next = withId({
    ...(existing || {}),
    ...data,
    id: replaceId ? newId() : (data.id || existing?.id),
    status: data?.status || existing?.status || 'active',
    title: data?.title || existing?.title || data?.setup?.title || existing?.setup?.title,
    noteId: data?.noteId || existing?.noteId || null,
    savedAt: Date.now(),
    ownerUid: uid,
  });
  try {
    writeJson(KEY, next);
    emit();
  } catch {
    // ignore quota / serialization errors
  }
  scheduleCloudSave(next, uid);
  return next;
}

export function saveSession(data) {
  return persistActive(data);
}

export function beginSession(data) {
  const previous = loadSession();
  if (previous?.id && previous.terms?.length && previous.id !== data?.id) {
    saveFinishedSession(previous);
  }
  return persistActive(data, { replaceId: true });
}

export function clearSession() {
  cancelPendingCloudSave();
  const key = userStorageKey(KEY);
  try {
    if (key) localStorage.removeItem(key);
    emit();
  } catch {
    // ignore
  }
}

export function loadFinishedSession() {
  return readJson(FINISHED_KEY);
}

export function clearFinishedSession(id) {
  const current = loadFinishedSession();
  if (id && current?.id && current.id !== id) return current;
  const key = userStorageKey(FINISHED_KEY);
  try {
    if (key) localStorage.removeItem(key);
    emit();
  } catch {
    // ignore
  }
  return null;
}

export function saveFinishedSession(data) {
  const uid = getActiveUid();
  if (!uid) return null;
  if (data?.ownerUid && data.ownerUid !== uid) return loadFinishedSession();
  const next = withId({
    ...data,
    status: 'finished',
    finishedAt: data?.finishedAt || Date.now(),
    savedAt: Date.now(),
    ownerUid: uid,
  });
  try {
    writeJson(FINISHED_KEY, next);
  } catch {
    // ignore
  }
  workerRequest('PUT', `/v1/sessions/${next.id}`, { session: next }).catch(() => {});
  return next;
}

export function loadPracticeSource() {
  const active = loadSession();
  if (active?.terms?.length) return { kind: 'active', session: active };
  const finished = loadFinishedSession();
  const notes = loadPracticeNotes();
  const notesAt = notes?.savedAt || 0;
  const finishedAt = finished?.savedAt || finished?.finishedAt || 0;
  if (notes?.terms?.length && notesAt >= finishedAt) return { kind: 'notes', session: notes };
  if (finished?.terms?.length) return { kind: 'finished', session: finished };
  return null;
}

export function loadLatestCram() {
  return loadPracticeSource()?.session || null;
}

export function loadPracticeNotes() {
  return readJson(NOTES_PRACTICE_KEY);
}

export function savePracticeNotes(data) {
  const uid = getActiveUid();
  if (!uid || !data?.terms?.length) return null;
  const next = withId({
    ...data,
    status: 'notes',
    savedAt: Date.now(),
    ownerUid: uid,
  });
  try {
    writeJson(NOTES_PRACTICE_KEY, next);
  } catch {
    // ignore quota / serialization errors
  }
  return next;
}

export function savePracticeTerms(source, terms) {
  if (!source?.session) return;
  if (source.kind === 'active') {
    saveSession({ ...source.session, terms });
    return;
  }
  if (source.kind === 'notes') {
    savePracticeNotes({ ...source.session, terms });
    return;
  }
  if (source.kind === 'history') {
    const uid = getActiveUid();
    if (!uid) return;
    const next = {
      ...source.session,
      terms,
      savedAt: Date.now(),
      ownerUid: uid,
    };
    workerRequest('PUT', `/v1/sessions/${next.id}`, { session: next }).catch(() => {});
    return;
  }
  saveFinishedSession({ ...source.session, terms });
}

export async function hydrateRemoteSession() {
  const uid = getActiveUid();
  if (!uid) return null;
  try {
    const data = await workerRequest('GET', '/v1/sessions/current');
    const remote = ownedByActiveUser(data?.session);
    if (!remote?.terms?.length) {
      emit();
      return loadSession();
    }
    const local = loadSession();
    if (!local || (remote.savedAt || 0) >= (local.savedAt || 0)) {
      writeJson(KEY, { ...remote, ownerUid: uid });
      emit();
      return loadSession();
    }
    return local;
  } catch {
    return loadSession();
  }
}

export async function listRemoteSessions() {
  const data = await workerRequest('GET', '/v1/sessions');
  return Array.isArray(data?.sessions) ? data.sessions : [];
}

export async function listSessionPace() {
  const data = await workerRequest('GET', '/v1/sessions/pace');
  return Array.isArray(data?.sessions) ? data.sessions : [];
}

export async function loadRemoteSession(id) {
  const data = await workerRequest('GET', `/v1/sessions/${id}`);
  return ownedByActiveUser(data?.session);
}

export async function deleteRemoteSession(id) {
  await workerRequest('DELETE', `/v1/sessions/${id}`);
  clearFinishedSession(id);
}
