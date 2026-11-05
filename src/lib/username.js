const RESERVED = new Set([
  'admin',
  'administrator',
  'abuse',
  'api',
  'bharris',
  'help',
  'mod',
  'moderator',
  'null',
  'official',
  'owner',
  'root',
  'security',
  'staff',
  'support',
  'system',
  'team',
  'undefined',
  'www',
  'you',
]);

export function typedUsername(value) {
  return String(value || '')
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

export function parseUsername(raw) {
  const source = String(raw ?? '');
  if (source.length > 40) return { error: 'Use 20 characters or fewer.' };
  const username = source.normalize('NFKC').trim().replace(/^@+/, '').toLowerCase();
  if (!username) return { error: 'Choose a username.' };
  if (username.length < 3) return { error: 'Use at least 3 characters.' };
  if (username.length > 20) return { error: 'Use 20 characters or fewer.' };
  if (!/^[a-z][a-z0-9_]*$/.test(username) || username.endsWith('_') || username.includes('__')) {
    return { error: 'Start with a letter. Then use letters, numbers, and single underscores.' };
  }
  if (RESERVED.has(username)) return { error: 'Choose a different username.' };
  return { username };
}
