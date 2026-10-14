const IMAGE_FIELDS = new Set([
  'pages',
  'images',
  'image',
  'dataUrl',
  'r2_key',
  'r2Key',
  'r2_original_key',
  'r2OriginalKey',
]);

export function noteForStorage(note) {
  if (!note || typeof note !== 'object') return null;
  const next = {};
  for (const [key, value] of Object.entries(note)) {
    if (IMAGE_FIELDS.has(key)) continue;
    if (typeof value === 'string' && value.includes('data:image/')) continue;
    next[key] = value;
  }
  return next;
}

export function prepareStoredNotes(raw) {
  const notes = Array.isArray(raw) ? raw.map(noteForStorage).filter(Boolean) : [];
  return {
    notes,
    changed: JSON.stringify(notes) !== JSON.stringify(Array.isArray(raw) ? raw : []),
  };
}
