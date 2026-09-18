// Shared helpers for the notes-first onboarding flow.

export function termCount(source) {
  if (!source) return 0;
  if (Array.isArray(source.items)) return source.items.length;
  return Number(source.terms) || 0;
}

export function makePhotoSource({ name, title, noteId } = {}) {
  return {
    kind: 'photo',
    title: (title || '').trim(),
    name: name || 'Photo notes',
    noteId: noteId || '',
  };
}

export function setupReturnPath(source) {
  if (source?.returnTo) return source.returnTo;
  if (source?.kind === 'manual') return '/create-notes';
  if (source?.kind === 'sample') return '/upload-notes';
  if (source?.kind === 'photo' && source.items?.length) return '/review-notes';
  return '/welcome';
}
