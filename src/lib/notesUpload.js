import { workerRequest } from '@/lib/workerClient';

export async function uploadNoteImages(images, { title, kind = 'photo' } = {}) {
  const list = (Array.isArray(images) ? images : [images]).filter(Boolean);
  if (!list.length) throw new Error('Attach at least one photo');
  const data = await workerRequest('POST', '/v1/notes', {
    title: title || 'Your notes',
    kind,
    images: list,
  });
  return data.note;
}

export async function patchNote(noteId, patch) {
  const data = await workerRequest('PATCH', `/v1/notes/${noteId}`, patch);
  return data.note;
}

export function notePageUrl(noteId, pageIndex) {
  return `/v1/notes/${noteId}/pages/${pageIndex}`;
}
