import { errorJson, json, readJson } from './util.js';
import { isAdminUid, userStudyStub } from './users.js';

const HASH_ALGO = 'pbkdf2-sha256';
const HASH_BYTES = 32;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 1_000_000;
const MIN_SALT_BYTES = 16;
const MAX_PASSWORD_CHARS = 128;
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const MIN_TOKEN_SECRET = 32;
const MIN_NEW_PASSWORD = 12;
const LOCK_KEY = 'notes_scan_lock';

function bytesToB64url(bytes) {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlToBytes(value) {
  const text = String(value || '');
  if (!text || text.length > 512 || /[^A-Za-z0-9_-]/.test(text)) return null;
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function safeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) return false;
  if (left.byteLength !== right.byteLength) return false;
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(left, right);
  }
  let diff = 0;
  for (let i = 0; i < left.byteLength; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export function parseStoredScanHash(stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4) return null;
  const [algo, iterRaw, salt, hash] = parts;
  const iterations = Number(iterRaw);
  if (algo !== HASH_ALGO) return null;
  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) return null;
  const saltBytes = b64urlToBytes(salt);
  const hashBytes = b64urlToBytes(hash);
  if (!saltBytes || saltBytes.length < MIN_SALT_BYTES || !hashBytes || hashBytes.length !== HASH_BYTES) return null;
  return { iterations, saltBytes, hashBytes };
}

export function scanLockConfigured(env) {
  return Boolean(parseStoredScanHash(env?.NOTES_SCAN_PASSWORD_HASH))
    && tokenSecretReady(env);
}

function tokenSecretReady(env) {
  return String(env?.NOTES_SCAN_TOKEN_SECRET || '').length >= MIN_TOKEN_SECRET;
}

async function ensureSettingsTable(env) {
  await env.APP.prepare(
    'CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)',
  ).run();
}

async function readLockRow(env) {
  if (!env.APP?.prepare) return null;
  await ensureSettingsTable(env);
  const row = await env.APP.prepare('SELECT value FROM app_settings WHERE key = ?').bind(LOCK_KEY).first();
  if (!row?.value) return null;
  try {
    const parsed = JSON.parse(row.value);
    return {
      generation: Number(parsed.generation) || 0,
      hash: String(parsed.hash || ''),
      killed: !!parsed.killed,
    };
  } catch {
    return null;
  }
}

async function writeLockRow(env, record) {
  await ensureSettingsTable(env);
  const stored = {
    generation: Number(record.generation) || 0,
    hash: record.killed ? '' : String(record.hash || ''),
    killed: !!record.killed,
  };
  await env.APP.prepare(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).bind(LOCK_KEY, JSON.stringify(stored)).run();
  return stored;
}

export async function currentScanLock(env) {
  const row = await readLockRow(env);
  if (row) {
    const hash = row.killed ? '' : row.hash;
    return {
      generation: row.generation,
      hash,
      killed: row.killed,
      configured: true,
      active: !row.killed && !!parseStoredScanHash(hash),
    };
  }
  const hash = String(env?.NOTES_SCAN_PASSWORD_HASH || '');
  const parsed = !!parseStoredScanHash(hash);
  return {
    generation: 0,
    hash,
    killed: false,
    configured: parsed,
    active: parsed,
  };
}

async function pbkdf2(password, saltBytes, iterations) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations,
    },
    material,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function formatScanPasswordHash(password, { saltBytes, iterations = 210_000 } = {}) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(MIN_SALT_BYTES));
  const hash = await pbkdf2(String(password), salt, iterations);
  return `${HASH_ALGO}$${iterations}$${bytesToB64url(salt)}$${bytesToB64url(hash)}`;
}

export async function verifyNotesScanPassword(stored, password) {
  const parsed = parseStoredScanHash(stored);
  const attempt = String(password ?? '');
  if (!parsed || !attempt || attempt.length > MAX_PASSWORD_CHARS) return false;
  const derived = await pbkdf2(attempt, parsed.saltBytes, parsed.iterations);
  return safeEqual(derived, parsed.hashBytes);
}

async function hmacSha256(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export async function signScanToken(secret, uid, expiresAt, generation = 0) {
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({
    u: String(uid || ''),
    e: Number(expiresAt),
    g: Number(generation) || 0,
    t: 'scan',
  })));
  const sig = bytesToB64url(await hmacSha256(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifyScanToken(secret, token, uid, generation = 0, now = Date.now()) {
  const raw = String(token || '');
  if (!secret || String(secret).length < MIN_TOKEN_SECRET) return false;
  if (!raw || raw.length > 2000) return false;
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot !== raw.lastIndexOf('.')) return false;
  const payload = raw.slice(0, dot);
  const sig = b64urlToBytes(raw.slice(dot + 1));
  if (!sig) return false;
  const expected = await hmacSha256(secret, payload);
  if (!safeEqual(sig, expected)) return false;
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
  } catch {
    return false;
  }
  if (!body || String(body.u || '') !== String(uid || '')) return false;
  if (body.t === 'dev') return false;
  const tokenGen = body.g == null ? 0 : Number(body.g);
  if (!Number.isFinite(tokenGen) || tokenGen !== (Number(generation) || 0)) return false;
  const exp = Number(body.e);
  return Number.isFinite(exp) && exp > now;
}

export function nextScanFailure(state, now, { maxFails = MAX_FAILS, lockMs = LOCK_MS } = {}) {
  const lockedUntil = Number(state?.lockedUntil) || 0;
  const fails = Number(state?.fails) || 0;
  if (lockedUntil > now) return { locked: true, lockedUntil, fails };
  const nextFails = fails + 1;
  if (nextFails >= maxFails) {
    return { locked: true, lockedUntil: now + lockMs, fails: 0 };
  }
  return { locked: false, lockedUntil: 0, fails: nextFails };
}

export function scanTokenFrom(request) {
  return request.headers.get('X-Notes-Scan-Token') || '';
}

export async function requireScanToken(request, env, identity) {
  if (!tokenSecretReady(env)) return errorJson('Notes scanning is not set up.', 503);
  const lock = await currentScanLock(env);
  if (!lock.configured) return errorJson('Notes scanning is not set up.', 503);
  if (!lock.active) return errorJson('Enter the notes password to upload.', 401);
  const ok = await verifyScanToken(
    env.NOTES_SCAN_TOKEN_SECRET,
    scanTokenFrom(request),
    identity.uid,
    lock.generation,
    Date.now(),
  );
  if (!ok) return errorJson('Enter the notes password to upload.', 401);
  return null;
}

async function requireScanAdmin(request, env, identity) {
  const devToken = request.headers.get('X-Dev-Tools-Token') || '';
  if (devToken && await verifyDevToken(env.NOTES_SCAN_TOKEN_SECRET, devToken, identity.uid)) return null;
  const admin = await isAdminUid(env, identity.uid, identity.email);
  if (!admin) return errorJson('Enter the dev code first.', 403);
  return null;
}

function lockStatus(lock) {
  return { active: !!lock.active, killed: !!lock.killed, generation: lock.generation };
}

export async function handleScanAdmin(request, env, identity) {
  const denied = await requireScanAdmin(request, env, identity);
  if (denied) return denied;
  if (!tokenSecretReady(env)) return errorJson('Notes scanning is not set up.', 503);
  return json(lockStatus(await currentScanLock(env)));
}

export async function handleScanKill(request, env, identity) {
  const denied = await requireScanAdmin(request, env, identity);
  if (denied) return denied;
  if (!env.APP?.prepare || !tokenSecretReady(env)) return errorJson('Notes scanning is not set up.', 503);
  const current = await currentScanLock(env);
  if (!current.configured) return errorJson('Notes scanning is not set up.', 503);
  const saved = await writeLockRow(env, {
    generation: current.generation + 1,
    hash: '',
    killed: true,
  });
  return json({ active: false, killed: true, generation: saved.generation });
}

export async function handleScanPassword(request, env, identity) {
  const denied = await requireScanAdmin(request, env, identity);
  if (denied) return denied;
  if (!env.APP?.prepare || !tokenSecretReady(env)) return errorJson('Notes scanning is not set up.', 503);
  const body = await readJson(request);
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (password.length < MIN_NEW_PASSWORD || password.length > MAX_PASSWORD_CHARS) {
    return errorJson('Use at least 12 characters.', 400);
  }
  const current = await currentScanLock(env);
  const saved = await writeLockRow(env, {
    generation: current.generation + 1,
    hash: await formatScanPasswordHash(password),
    killed: false,
  });
  return json({ active: true, killed: false, generation: saved.generation });
}

export async function handleScanUnlock(request, env, identity) {
  if (!tokenSecretReady(env)) return errorJson('Notes scanning is not set up.', 503);
  const { stub } = userStudyStub(env, identity.uid);
  const state = await stub.scanLockState();
  const now = Date.now();
  if ((Number(state?.lockedUntil) || 0) > now) {
    return errorJson('Too many tries. Wait a few minutes and try again.', 429);
  }
  const lock = await currentScanLock(env);
  if (!lock.configured) return errorJson('Notes scanning is not set up.', 503);
  const body = await readJson(request);
  const password = typeof body.password === 'string' ? body.password : '';
  const ok = lock.active && await verifyNotesScanPassword(lock.hash, password);
  if (!ok) {
    const next = await stub.recordScanFailure(now);
    if (next.locked) return errorJson('Too many tries. Wait a few minutes and try again.', 429);
    return errorJson('That password is wrong.', 401);
  }
  await stub.clearScanFailures();
  const expiresAt = now + TOKEN_TTL_MS;
  const token = await signScanToken(env.NOTES_SCAN_TOKEN_SECRET, identity.uid, expiresAt, lock.generation);
  return json({ token, expiresAt });
}

export async function signDevToken(secret, uid, expiresAt) {
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify({
    t: 'dev',
    u: String(uid || ''),
    e: Number(expiresAt),
  })));
  const sig = bytesToB64url(await hmacSha256(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifyDevToken(secret, token, uid, now = Date.now()) {
  const raw = String(token || '');
  if (!secret || String(secret).length < MIN_TOKEN_SECRET) return false;
  if (!raw || raw.length > 2000) return false;
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot !== raw.lastIndexOf('.')) return false;
  const payload = raw.slice(0, dot);
  const sig = b64urlToBytes(raw.slice(dot + 1));
  if (!sig) return false;
  const expected = await hmacSha256(secret, payload);
  if (!safeEqual(sig, expected)) return false;
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
  } catch {
    return false;
  }
  if (!body || body.t !== 'dev' || String(body.u || '') !== String(uid || '')) return false;
  const exp = Number(body.e);
  return Number.isFinite(exp) && exp > now;
}

export async function handleDevUnlock(request, env, identity) {
  if (!tokenSecretReady(env) || !parseStoredScanHash(env.DEV_TOOLS_CODE_HASH)) {
    return errorJson('Dev tools are not set up.', 503);
  }
  const { stub } = userStudyStub(env, identity.uid);
  const state = await stub.devLockState();
  const now = Date.now();
  if ((Number(state?.lockedUntil) || 0) > now) {
    return errorJson('Too many tries. Wait a few minutes and try again.', 429);
  }
  const body = await readJson(request);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const ok = await verifyNotesScanPassword(env.DEV_TOOLS_CODE_HASH, code);
  if (!ok) {
    const next = await stub.recordDevFailure(now);
    if (next.locked) return errorJson('Too many tries. Wait a few minutes and try again.', 429);
    return errorJson('That code is wrong.', 401);
  }
  await stub.clearDevFailures();
  const expiresAt = now + TOKEN_TTL_MS;
  const token = await signDevToken(env.NOTES_SCAN_TOKEN_SECRET, identity.uid, expiresAt);
  return json({ token, expiresAt });
}
