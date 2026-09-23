const ROMAN_SUFFIXES = new Set(['ii', 'iii', 'iv', 'v']);
const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);

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

function nameParts(displayName) {
  const parts = formatPersonName(displayName).split(' ').filter(Boolean);
  while (parts.length > 1 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }
  return parts;
}

// "Broderick Harris Jr" → first "Broderick", last "Harris".
export function greetingName(displayName, style) {
  const parts = nameParts(displayName);
  if (!parts.length) return '';
  if (style === 'first') return parts[0];
  return parts[parts.length - 1];
}
