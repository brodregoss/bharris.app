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

// "bharris" with repeated letters folded, so bharrisapp, bharris_support, and bharr1s all match.
const APP_NAME_MARK = 'bharis';

const LEET_DIGITS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };

function looksLikeAppName(username) {
  const folded = username
    .replace(/[013457]/g, (digit) => LEET_DIGITS[digit])
    .replace(/l/g, 'i')
    .replace(/[_\d]/g, '')
    .replace(/(.)\1+/g, '$1');
  return folded.includes(APP_NAME_MARK);
}

export const USERNAME_CHANGE_WAIT_MS = 24 * 60 * 60 * 1000;

export function usernameChangeReadyAt(changedAt, now = Date.now()) {
  const changed = Date.parse(changedAt || '');
  if (!Number.isFinite(changed)) return 0;
  const ready = changed + USERNAME_CHANGE_WAIT_MS;
  return ready > now ? ready : 0;
}

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
  if (RESERVED.has(username) || looksLikeAppName(username)) return { error: 'Choose a different username.' };
  return { username };
}
