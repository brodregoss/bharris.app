import { errorJson, json, readJson } from './util.js';
import { userStudyStub } from './users.js';
import { denyPhoto } from './photoAccess.js';
import { collectImages, inspectImagePayload } from './imageGuard.js';

function hasNotesBucket(env) {
  return Boolean(env.NOTES);
}

export async function handleCreateNote(request, env, identity) {
  const body = await readJson(request);
  const terms = Array.isArray(body.terms) ? body.terms : null;
  const images = collectImages(body);
  const kind = body.kind === 'photo' ? 'manual' : (body.kind || 'manual');
  if (images.length) {
    const denied = await denyPhoto(env, identity);
    if (denied) return denied;
    const inspected = inspectImagePayload(body);
    if (!inspected.ok) return errorJson(inspected.message, inspected.status);
    return errorJson('Photos are not stored.', 400);
  }
  if (kind !== 'manual' && !terms?.length && !body.transcript) {
    return errorJson('Add a title or some terms', 400);
  }

  const noteId = crypto.randomUUID();
  const pages = [];
  const total = 0;
  const originalKey = null;
  const transcript = body.transcript
    || (terms ? JSON.stringify({ terms }) : null);
  const { stub } = userStudyStub(env, identity.uid);
  const note = await stub.putNote({
    id: noteId,
    title: body.title || (kind === 'manual' ? 'Untitled' : 'Your notes'),
    kind,
    r2OriginalKey: originalKey,
    contentType: pages[0]?.contentType,
    sizeBytes: total,
    pageCount: pages.length,
    transcript,
    pages,
  });
  return json({ note }, 201);
}

export async function handlePatchNote(request, env, identity, noteId) {
  const body = await readJson(request);
  const { stub } = userStudyStub(env, identity.uid);
  const existing = await stub.getNote(noteId);
  if (!existing) return errorJson('Note not found', 404);
  const transcript = body.transcript
    || (Array.isArray(body.terms) ? JSON.stringify({ terms: body.terms }) : existing.transcript);
  const note = await stub.putNote({
    id: noteId,
    title: body.title ?? existing.title,
    kind: existing.kind,
    r2OriginalKey: existing.r2_original_key,
    contentType: existing.content_type,
    sizeBytes: existing.size_bytes,
    pageCount: existing.page_count,
    transcript,
    pages: existing.pages?.map((page) => ({
      pageIndex: page.page_index,
      r2Key: page.r2_key,
      contentType: page.content_type,
      sizeBytes: page.size_bytes,
    })),
  });
  return json({ note });
}

export async function handleListNotes(env, identity) {
  const { stub } = userStudyStub(env, identity.uid);
  return json({ notes: await stub.listNotes() });
}

export async function handleDeleteNote(env, identity, noteId) {
  const { stub } = userStudyStub(env, identity.uid);
  const existing = await stub.getNote(noteId);
  if (!existing) return errorJson('Note not found', 404);
  const pages = existing.pages || [];
  if (hasNotesBucket(env)) {
    await Promise.all(
      pages
        .map((page) => page.r2_key || page.r2Key)
        .filter((key) => key && String(key).startsWith(`notes/${identity.uid}/`))
        .map((key) => env.NOTES.delete(key)),
    );
  }
  await stub.deleteNote(noteId);
  return json({ ok: true });
}

export async function handleGetNote(env, identity, noteId) {
  const { stub } = userStudyStub(env, identity.uid);
  const note = await stub.getNote(noteId);
  if (!note) return errorJson('Note not found', 404);
  return json({ note });
}

export async function handleGetNotePage(env, identity) {
  const denied = await denyPhoto(env, identity);
  if (denied) return denied;
  return errorJson('Page not found', 404);
}

// Deletes one account's objects when that account is deleted. This is not a bucket purge.
export async function deleteUserNotes(env, uid) {
  if (!hasNotesBucket(env)) return;
  const listed = await env.NOTES.list({ prefix: `notes/${uid}/` });
  await Promise.all((listed.objects || []).map((obj) => env.NOTES.delete(obj.key)));
  let truncated = listed.truncated;
  let cursor = listed.cursor;
  while (truncated) {
    const next = await env.NOTES.list({ prefix: `notes/${uid}/`, cursor });
    await Promise.all((next.objects || []).map((obj) => env.NOTES.delete(obj.key)));
    truncated = next.truncated;
    cursor = next.cursor;
  }
}
