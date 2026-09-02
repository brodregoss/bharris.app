// Shared helpers for the notes-first onboarding flow.

export function termCount(source) {
  if (!source) return 0;
  if (Array.isArray(source.items) && source.items.length) return source.items.length;
  return Number(source.terms) || 0;
}

export function makePhotoSource(file) {
  const url = URL.createObjectURL(file);
  return { kind: 'photo', name: file.name, url };
}

export function setupReturnPath(source) {
  if (source?.kind === 'manual') return '/create-notes';
  if (source?.kind === 'sample') return '/upload-notes';
  return '/welcome';
}
