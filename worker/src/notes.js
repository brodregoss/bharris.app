import { errorJson, json, readJson } from './util.js';
import { userStudyStub } from './users.js';

function padPage(index) {
  return String(index + 1).padStart(3, '0');
}

function decodeImage(input) {
  if (!input) return null;
  if (typeof input === 'string' && input.startsWith('data:')) {
    const comma = input.indexOf(',');
    const header = input.slice(0, comma);
    const b64 = input.slice(comma + 1);
    const mime = /data:([^;]+)/.exec(header)?.[1] || 'image/jpeg';
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return { bytes, contentType: mime };
  }
  if (typeof input === 'string') {
    const bytes = Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
    return { bytes, contentType: 'image/jpeg' };
  }
  return null;
}

export async function handleCreateNote(request, env, identity) {
  const body = await readJson(request);
  const images = Array.isArray(body.images) ? body.images : body.image ? [body.image] : [];
  if (!images.length) return errorJson('Attach at least one photo', 400);

  const noteId = crypto.randomUUID();
  const pages = [];
  let total = 0;
  for (let i = 0; i < images.length; i += 1) {
    const decoded = decodeImage(typeof images[i] === 'string' ? images[i] : images[i]?.dataUrl || images[i]?.data);
    if (!decoded) return errorJson('Each photo must be an image', 400);
    const key = `notes/${identity.uid}/${noteId}/pages/${padPage(i)}.jpg`;
    await env.NOTES.put(key, decoded.bytes, {
      httpMetadata: { contentType: decoded.contentType },
    });
    total += decoded.bytes.byteLength;
    pages.push({
      pageIndex: i,
      r2Key: key,
      contentType: decoded.contentType,
      sizeBytes: decoded.bytes.byteLength,
    });
  }

  const originalKey = pages[0]?.r2Key;
  const { stub } = userStudyStub(env, identity.uid);
  const note = await stub.putNote({
    id: noteId,
    title: body.title || 'Your notes',
    kind: body.kind || 'photo',
    r2OriginalKey: originalKey,
    contentType: pages[0]?.contentType,
    sizeBytes: total,
    pageCount: pages.length,
    transcript: body.transcript || null,
    pages,
  });
  return json({ note }, 201);
}

export async function handlePatchNote(request, env, identity, noteId) {
  const body = await readJson(request);
  const { stub } = userStudyStub(env, identity.uid);
  const existing = await stub.getNote(noteId);
  if (!existing) return errorJson('Note not found', 404);
  const note = await stub.putNote({
    id: noteId,
    title: body.title ?? existing.title,
    kind: existing.kind,
    r2OriginalKey: existing.r2_original_key,
    contentType: existing.content_type,
    sizeBytes: existing.size_bytes,
    pageCount: existing.page_count,
    transcript: body.transcript ?? existing.transcript,
    pages: existing.pages?.map((page) => ({
      pageIndex: page.page_index,
      r2Key: page.r2_key,
      contentType: page.content_type,
      sizeBytes: page.size_bytes,
    })),
  });
  return json({ note });
}

export async function handleGetNote(env, identity, noteId) {
  const { stub } = userStudyStub(env, identity.uid);
  const note = await stub.getNote(noteId);
  if (!note) return errorJson('Note not found', 404);
  return json({ note });
}

export async function handleGetNotePage(env, identity, noteId, pageIndex) {
  const { stub } = userStudyStub(env, identity.uid);
  const note = await stub.getNote(noteId);
  if (!note) return errorJson('Note not found', 404);
  const page = (note.pages || []).find((p) => Number(p.page_index) === Number(pageIndex));
  if (!page?.r2_key || !String(page.r2_key).startsWith(`notes/${identity.uid}/`)) {
    return errorJson('Page not found', 404);
  }
  const obj = await env.NOTES.get(page.r2_key);
  if (!obj) return errorJson('File not found', 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': page.content_type || obj.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=60',
    },
  });
}

export async function deleteUserNotes(env, uid) {
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
