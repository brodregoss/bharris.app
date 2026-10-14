import moderationConfig from '../../config/moderation.json' with { type: 'json' };
import { errorJson, json, readJson } from './util.js';
import { acceptPhotoTerms, getUserRow, markPhotoUnlocked } from './users.js';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_CHARS = 26;
const MIN_SECRET_CHARS = 32;

export const PHOTO_UNAVAILABLE = 'Photo import is temporarily unavailable.';
export const PHOTO_DISABLED = "Photo import isn't available in this version of the app. Notes scanning is not set up.";
export const PHOTO_INVITE_ONLY = 'Photo import is invitation-only during the beta.';
export const PHOTO_TERMS_REQUIRED = 'Check the box to continue.';
export const PHOTO_TERMS_VERSION = '2026-10-14';
export const CODE_REJECTED = "That code can't be used.";

let photoTablesReady = null;

export function photoFeatureEnabled(env) {
  return String(env?.PHOTO_FEATURE_ENABLED || '').trim().toLowerCase() === 'true';
}

export function strikeLimit() {
  const limit = Number(moderationConfig?.strike_limit);
  if (!Number.isInteger(limit) || limit < 1) return 5;
  return limit;
}

function accessCodeConfig() {
  const raw = moderationConfig?.access_code || {};
  const maxFailures = Number(raw.max_failures);
  const lockoutMs = Number(raw.lockout_ms);
  return {
    maxFailures: Number.isInteger(maxFailures) && maxFailures > 0 ? maxFailures : 5,
    lockoutMs: Number.isInteger(lockoutMs) && lockoutMs > 0 ? lockoutMs : 900000,
  };
}

export function supportEmail(env) {
  const email = String(env?.SUPPORT_EMAIL || '').trim();
  if (!email || email.length > 200 || /[\s<>]/.test(email) || !email.includes('@')) return '';
  return email;
}

export function suspensionMessage(env) {
  const email = supportEmail(env);
  return email ? `This account is suspended. Contact ${email}.` : 'This account is suspended.';
}

export function strikeLimitMessage(env) {
  const email = supportEmail(env);
  return email
    ? `Photo import is paused for this account. Contact ${email}.`
    : 'Photo import is paused for this account.';
}

function unavailable() {
  return errorJson(PHOTO_UNAVAILABLE, 403);
}

function featureDisabled() {
  return errorJson(PHOTO_DISABLED, 403);
}

function inviteOnly() {
  return errorJson(PHOTO_INVITE_ONLY, 403);
}

function rejectedCode() {
  return errorJson(CODE_REJECTED, 400);
}

export function generateAccessCode() {
  const chars = [];
  const bytes = new Uint8Array(64);
  const span = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  while (chars.length < CODE_CHARS) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && chars.length < CODE_CHARS; i += 1) {
      if (bytes[i] >= span) continue;
      chars.push(ALPHABET[bytes[i] % ALPHABET.length]);
    }
  }
  return chars.join('').replace(/(.{4})(?=.)/g, '$1-');
}

export function canonicalAccessCode(input) {
  const compact = String(input || '').toUpperCase().replace(/[\s-]+/g, '');
  if (compact.length !== CODE_CHARS) return '';
  const mapped = compact.replace(/[IL]/g, '1').replace(/O/g, '0');
  for (const char of mapped) {
    if (!ALPHABET.includes(char)) return '';
  }
  return mapped;
}

function codeSecret(env) {
  const secret = String(env?.PHOTO_CODE_SECRET || '');
  if (secret.length < MIN_SECRET_CHARS) return '';
  return secret;
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

function toHex(bytes) {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

function hexToBytes(hex) {
  const text = String(hex || '');
  if (!/^[0-9a-f]{64}$/.test(text)) return new Uint8Array(32);
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
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

export async function hashAccessCode(env, code) {
  const secret = codeSecret(env);
  const canonical = canonicalAccessCode(code);
  if (!secret || !canonical) return '';
  return toHex(await hmacSha256(secret, canonical));
}

async function ensurePhotoTables(env) {
  if (!env?.APP?.prepare) throw new Error('Photo access storage is not configured');
  if (!photoTablesReady) {
    photoTablesReady = migratePhotoTables(env).catch((err) => {
      photoTablesReady = null;
      throw err;
    });
  }
  return photoTablesReady;
}

async function migratePhotoTables(env) {
  await env.APP.prepare(
    `CREATE TABLE IF NOT EXISTS photo_access_codes (
      code_hash TEXT PRIMARY KEY,
      max_uses INTEGER NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      revoked_at TEXT,
      redeemed_uid TEXT,
      redeemed_at TEXT,
      created_at TEXT NOT NULL
    )`,
  ).run();
  await env.APP.prepare(
    `CREATE TABLE IF NOT EXISTS photo_access_redemptions (
      code_hash TEXT NOT NULL,
      firebase_uid TEXT NOT NULL,
      redeemed_at TEXT NOT NULL,
      PRIMARY KEY (code_hash, firebase_uid)
    )`,
  ).run();
  await env.APP.prepare(
    `CREATE TABLE IF NOT EXISTS photo_redeem_lockouts (
      subject TEXT PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER NOT NULL DEFAULT 0
    )`,
  ).run();
}

export async function storeAccessCode(env, {
  code,
  maxUses = 1,
  expiresAt = null,
  now = new Date().toISOString(),
} = {}) {
  const codeHash = await hashAccessCode(env, code);
  const uses = Number(maxUses);
  if (!codeHash || !Number.isInteger(uses) || uses < 1 || uses > 100) {
    throw new Error('Could not store that access code');
  }
  await ensurePhotoTables(env);
  await env.APP.prepare(
    `INSERT INTO photo_access_codes (
      code_hash, max_uses, use_count, expires_at, revoked_at, redeemed_uid, redeemed_at, created_at
    ) VALUES (?, ?, 0, ?, NULL, NULL, NULL, ?)`,
  ).bind(codeHash, uses, expiresAt || null, now).run();
  return { stored: true };
}

export async function revokeAccessCode(env, code, now = new Date().toISOString()) {
  const codeHash = await hashAccessCode(env, code);
  if (!codeHash) return false;
  await ensurePhotoTables(env);
  const result = await env.APP.prepare(
    'UPDATE photo_access_codes SET revoked_at = ? WHERE code_hash = ? AND revoked_at IS NULL',
  ).bind(now, codeHash).run();
  return Number(result?.meta?.changes) > 0;
}

function clientIp(request) {
  const ip = String(request?.headers?.get?.('CF-Connecting-IP') || '').trim();
  if (!ip || ip.length > 80 || /[\s,]/.test(ip)) return '';
  return ip;
}

async function subjectHash(secret, subject) {
  return toHex(await hmacSha256(secret, subject));
}

async function readLock(env, subject) {
  const row = await env.APP.prepare(
    'SELECT failures, locked_until FROM photo_redeem_lockouts WHERE subject = ?',
  ).bind(subject).first();
  return {
    failures: Number(row?.failures) || 0,
    lockedUntil: Number(row?.locked_until) || 0,
  };
}

async function writeLock(env, subject, state) {
  await env.APP.prepare(
    `INSERT INTO photo_redeem_lockouts (subject, failures, locked_until)
     VALUES (?, ?, ?)
     ON CONFLICT(subject) DO UPDATE SET
       failures = excluded.failures,
       locked_until = excluded.locked_until`,
  ).bind(subject, state.failures, state.lockedUntil).run();
}

function nextFailure(state, now, maxFailures, lockoutMs) {
  if (state.lockedUntil > now) return state;
  const failures = state.failures + 1;
  if (failures >= maxFailures) return { failures: 0, lockedUntil: now + lockoutMs };
  return { failures, lockedUntil: 0 };
}

function photoRowOpen(row) {
  return !!row?.photo_unlocked_at && !row?.photo_revoked_at && Number(row?.suspended) !== 1;
}

export async function requirePhotoAccess(env, identity) {
  if (!photoFeatureEnabled(env)) return featureDisabled();
  if (!codeSecret(env)) return unavailable();
  const row = await getUserRow(env, identity?.uid);
  if (Number(row?.suspended) === 1) return errorJson(suspensionMessage(env), 403);
  if ((Number(row?.photo_strikes) || 0) >= strikeLimit()) return errorJson(strikeLimitMessage(env), 403);
  if (!photoRowOpen(row)) return inviteOnly();
  return null;
}

export async function denyPhoto(env, identity) {
  try {
    return await requirePhotoAccess(env, identity);
  } catch {
    return unavailable();
  }
}

export function suspensionExempt(parts, method) {
  return parts?.[0] === 'v1'
    && parts[1] === 'users'
    && parts[2] === 'me'
    && !parts[3]
    && (method === 'GET' || method === 'POST' || method === 'DELETE');
}

export async function enforceSuspension(env, identity, parts, method) {
  if (suspensionExempt(parts, method)) return null;
  let row;
  try {
    row = await getUserRow(env, identity?.uid);
  } catch {
    return errorJson('Try again in a moment.', 503);
  }
  if (Number(row?.suspended) !== 1) return null;
  return errorJson(suspensionMessage(env), 403);
}

async function lockSubjects(secret, uid, ip) {
  const uidSubject = await subjectHash(secret, `uid:${uid}`);
  const ipSubject = await subjectHash(secret, ip ? `ip:${ip}` : `ip-missing:${uid}`);
  return { uidSubject, ipSubject };
}

async function lockedOut(env, subjects, now) {
  const uidLock = await readLock(env, subjects.uidSubject);
  const ipLock = await readLock(env, subjects.ipSubject);
  return uidLock.lockedUntil > now || ipLock.lockedUntil > now;
}

async function recordFailure(env, subjects, now) {
  const { maxFailures, lockoutMs } = accessCodeConfig();
  for (const subject of [subjects.uidSubject, subjects.ipSubject]) {
    const state = nextFailure(await readLock(env, subject), now, maxFailures, lockoutMs);
    await writeLock(env, subject, state);
  }
}

async function clearUserFailures(env, uidSubject) {
  await writeLock(env, uidSubject, { failures: 0, lockedUntil: 0 });
}

export async function handleRedeemPhotoAccess(request, env, identity, now = Date.now()) {
  try {
    if (!photoFeatureEnabled(env)) return featureDisabled();
    if (!codeSecret(env)) return unavailable();
    const uid = String(identity?.uid || '');
    if (!uid) return unavailable();
    const row = await getUserRow(env, uid);
    if (Number(row?.suspended) === 1) return errorJson(suspensionMessage(env), 403);
    if (!row || row.photo_revoked_at) return inviteOnly();
    if ((Number(row.photo_strikes) || 0) >= strikeLimit()) return errorJson(strikeLimitMessage(env), 403);

    await ensurePhotoTables(env);
    const secret = codeSecret(env);
    const subjects = await lockSubjects(secret, uid, clientIp(request));
    if (await lockedOut(env, subjects, now)) return rejectedCode();

    const body = await readJson(request);
    if (body.acceptPhotoTerms !== true) return errorJson(PHOTO_TERMS_REQUIRED, 400);
    const submitted = typeof body.code === 'string' ? body.code : '';
    if (submitted.length > 80) {
      await recordFailure(env, subjects, now);
      return rejectedCode();
    }
    const codeHash = await hashAccessCode(env, submitted);
    const found = codeHash
      ? await env.APP.prepare('SELECT code_hash FROM photo_access_codes WHERE code_hash = ?').bind(codeHash).first()
      : null;
    const matches = safeEqual(hexToBytes(codeHash), hexToBytes(found?.code_hash)) && !!found;
    if (!matches) {
      await recordFailure(env, subjects, now);
      return rejectedCode();
    }

    const prior = await env.APP.prepare(
      'SELECT firebase_uid FROM photo_access_redemptions WHERE code_hash = ? AND firebase_uid = ?',
    ).bind(codeHash, uid).first();
    if (prior) {
      await acceptPhotoTerms(env, uid, PHOTO_TERMS_VERSION);
      await markPhotoUnlocked(env, uid);
      await clearUserFailures(env, subjects.uidSubject);
      return json({ ok: true });
    }

    const nowIso = new Date(now).toISOString();
    const updated = await env.APP.prepare(
      `UPDATE photo_access_codes
       SET use_count = use_count + 1, redeemed_uid = ?, redeemed_at = ?
       WHERE code_hash = ?
         AND revoked_at IS NULL
         AND use_count < max_uses
         AND (expires_at IS NULL OR expires_at = '' OR expires_at > ?)`,
    ).bind(uid, nowIso, codeHash, nowIso).run();
    if (!(Number(updated?.meta?.changes) > 0)) {
      await recordFailure(env, subjects, now);
      return rejectedCode();
    }

    await acceptPhotoTerms(env, uid, PHOTO_TERMS_VERSION);
    await env.APP.prepare(
      'INSERT INTO photo_access_redemptions (code_hash, firebase_uid, redeemed_at) VALUES (?, ?, ?)',
    ).bind(codeHash, uid, nowIso).run();
    await markPhotoUnlocked(env, uid);
    await clearUserFailures(env, subjects.uidSubject);
    return json({ ok: true });
  } catch {
    return unavailable();
  }
}
