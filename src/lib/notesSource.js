// Shared helpers for the notes-first onboarding flow.

export function termCount(source) {
  if (!source) return 0;
  if (Array.isArray(source.items)) return source.items.length;
  return Number(source.terms) || 0;
}

export function makePhotoSource({ name }) {
  return { kind: 'photo', title: 'Your notes', name: name || 'Photo notes' };
}

export function setupReturnPath(source) {
  if (source?.kind === 'manual') return '/create-notes';
  if (source?.kind === 'sample') return '/upload-notes';
  if (source?.kind === 'photo' && source.items?.length) return '/review-notes';
  return '/welcome';
}
