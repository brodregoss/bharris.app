const ROMAN_SUFFIXES = new Set(['ii', 'iii', 'iv', 'v']);

function capitalizeChunk(chunk) {
  const first = chunk.charAt(0);
  const upper = first.toLocaleUpperCase();
  if (first === upper) return chunk;
  return upper + chunk.slice(1);
}

function capitalizeNamePart(part) {
  const bare = part.replace(/\./g, '').toLowerCase();
  if (ROMAN_SUFFIXES.has(bare)) return part.toUpperCase();
  return part.replace(/\p{L}+/gu, capitalizeChunk);
}

// Capitalize the first letter of each name only when it is still lowercase.
// "broderick harris" → "Broderick Harris". "McDonald" stays "McDonald".
export function formatPersonName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(capitalizeNamePart)
    .join(' ');
}
