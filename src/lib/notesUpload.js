import { workerRequest } from '@/lib/workerClient';
import { userStorageKey } from '@/lib/userStorage';
import { scanAuthHeaders } from '@/lib/notesScanLock';

const LOCAL_NOTES = 'lms_note_sets_v1';

function loadLocalNotes() {
  const key = userStorageKey(LOCAL_NOTES);
  if (!key) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function upsertLocalNote(note) {
  const key = userStorageKey(LOCAL_NOTES);
  if (!key || !note?.id) return note;
  const next = [note, ...loadLocalNotes().filter((item) => item.id !== note.id)];
  localStorage.setItem(key, JSON.stringify(next));
  return note;
}

function removeLocalNote(id) {
  const key = userStorageKey(LOCAL_NOTES);
  if (!key || !id) return;
  localStorage.setItem(key, JSON.stringify(loadLocalNotes().filter((item) => item.id !== id)));
}

function localNoteRecord({ id, title, terms, kind = 'manual' }) {
  return {
    id: id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `n${Date.now()}`),
    title: (title || '').trim() || 'Untitled',
    kind,
    transcript: JSON.stringify({ terms: Array.isArray(terms) ? terms : [] }),
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

export async function uploadNoteImages(images, { title, kind = 'photo' } = {}) {
  const list = (Array.isArray(images) ? images : [images]).filter(Boolean);
  if (!list.length) throw new Error('Attach at least one photo');
  const scanHeaders = scanAuthHeaders();
  if (!scanHeaders['X-Notes-Scan-Token']) {
    throw new Error('Enter the notes password to upload.');
  }
  const data = await workerRequest('POST', '/v1/notes', {
    title: title || 'Untitled',
    kind,
    images: list,
  }, scanHeaders);
  return upsertLocalNote(data.note);
}

export async function saveManualNote({ title, terms, noteId } = {}) {
  const payload = {
    title: (title || '').trim() || 'Untitled',
    kind: 'manual',
    terms: Array.isArray(terms) ? terms : [],
    transcript: JSON.stringify({ terms: Array.isArray(terms) ? terms : [] }),
  };
  try {
    if (noteId) {
      const data = await workerRequest('PATCH', `/v1/notes/${noteId}`, payload);
      return upsertLocalNote(data.note);
    }
    const data = await workerRequest('POST', '/v1/notes', payload);
    return upsertLocalNote(data.note);
  } catch {
    return upsertLocalNote(localNoteRecord({
      id: noteId,
      title: payload.title,
      terms: payload.terms,
    }));
  }
}

export async function patchNote(noteId, patch) {
  try {
    const data = await workerRequest('PATCH', `/v1/notes/${noteId}`, patch);
    return upsertLocalNote(data.note);
  } catch (err) {
    if (patch?.title || patch?.transcript || patch?.terms) {
      const existing = loadLocalNotes().find((item) => item.id === noteId) || { id: noteId };
      upsertLocalNote({
        ...existing,
        title: patch.title ?? existing.title,
        transcript: patch.transcript
          || (Array.isArray(patch.terms) ? JSON.stringify({ terms: patch.terms }) : existing.transcript),
        updated_at: new Date().toISOString(),
      });
    }
    throw err;
  }
}

export async function listNotes() {
  const local = loadLocalNotes();
  try {
    const data = await workerRequest('GET', '/v1/notes');
    const remote = Array.isArray(data?.notes) ? data.notes : [];
    const byId = new Map(local.map((note) => [note.id, note]));
    remote.forEach((note) => byId.set(note.id, note));
    return [...byId.values()];
  } catch {
    return local;
  }
}

export async function deleteNote(noteId) {
  removeLocalNote(noteId);
  try {
    await workerRequest('DELETE', `/v1/notes/${noteId}`);
  } catch {
    // Local copy is gone; older workers may not have DELETE /v1/notes.
  }
}

export function parseNoteTerms(note) {
  const raw = note?.transcript;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const terms = Array.isArray(parsed?.terms) ? parsed.terms : Array.isArray(parsed) ? parsed : [];
    return terms
      .map((t, i) => ({
        id: t.id || `n${i}`,
        term: String(t.term || '').trim(),
        definition: String(t.definition || t.notes || '').trim(),
        difficulty: t.difficulty,
        depends_on: t.depends_on,
      }))
      .filter((t) => t.term);
  } catch {
    return String(raw)
      .split('\n')
      .map((line, i) => {
        const idx = line.indexOf(':');
        const term = (idx === -1 ? line : line.slice(0, idx)).trim();
        const definition = (idx === -1 ? '' : line.slice(idx + 1)).trim();
        return { id: `n${i}`, term, definition };
      })
      .filter((t) => t.term);
  }
}

export function notePageUrl(noteId, pageIndex) {
  return `/v1/notes/${noteId}/pages/${pageIndex}`;
}
