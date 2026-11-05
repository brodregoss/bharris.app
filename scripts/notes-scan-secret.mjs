import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { formatScanPasswordHash, verifyNotesScanPassword } from '../worker/src/notesScanLock.js';

const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';

function password() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const body = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  return body.replace(/(.{4})(?!$)/g, '$1-');
}

function tokenSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function upsert(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  const base = text.replace(/\s*$/, '');
  return `${base}${base ? '\n' : ''}${line}\n`;
}

const devOnly = process.argv.includes('--dev');
const path = new URL('../worker/.dev.vars', import.meta.url);
const write = process.argv.includes('--write');

if (devOnly) {
  const phrase = password();
  const hash = await formatScanPasswordHash(phrase);
  if (!await verifyNotesScanPassword(hash, phrase)) {
    throw new Error('Generated code did not match its hash.');
  }
  if (write) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const next = upsert(current, 'DEV_TOOLS_CODE_HASH', hash);
    writeFileSync(path, next.endsWith('\n') ? next : `${next}\n`);
    console.log('Saved the dev code hash in worker/.dev.vars');
  }
  console.log(`Dev code: ${phrase}`);
  console.log('Set DEV_TOOLS_CODE_HASH with wrangler secret put before deploying.');
} else {
  const secret = tokenSecret();
  if (write) {
    const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const next = upsert(current, 'NOTES_SCAN_TOKEN_SECRET', secret);
    writeFileSync(path, next.endsWith('\n') ? next : `${next}\n`);
    console.log('Saved the token secret in worker/.dev.vars');
  }
  console.log('Set NOTES_SCAN_TOKEN_SECRET with wrangler secret put before deploying.');
}
