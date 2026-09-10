import fs from 'fs';
import path from 'path';
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const INPUT_USD_PER_MILLION = 0.15;
const OUTPUT_USD_PER_MILLION = 0.6;
const KV_KEY = 'lms-accounts';

let memory = null;
let writeQueue = Promise.resolve();

function secret() {
  return process.env.ACCOUNT_SECRET || process.env.OPENAI_API_KEY || 'lms-dev-account-secret';
}

function adminEmail() {
  return String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

function filePath() {
  if (process.env.VERCEL) return '/tmp/lms-accounts.json';
  return path.join(process.cwd(), 'data', 'accounts.json');
}

function periodKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, saltB64) {
  const salt = saltB64 ? Buffer.from(saltB64, 'base64') : randomBytes(16);
  const hash = pbkdf2Sync(String(password), salt, 100_000, 32, 'sha256');
  return { hash: hash.toString('base64'), salt: salt.toString('base64') };
}

function emptyStore() {
  return { users: {} };
}

export function estimateCostUsd(usage) {
  const prompt = Number(usage?.prompt_tokens) || 0;
  const completion = Number(usage?.completion_tokens) || 0;
  return (prompt * INPUT_USD_PER_MILLION + completion * OUTPUT_USD_PER_MILLION) / 1_000_000;
}

function applyPeriod(record) {
  if (!record) return record;
  const key = periodKey();
  if (record.periodKey === key) return record;
  return { ...record, spentUsd: 0, periodKey: key };
}

function isAdminRecord(record) {
  if (!record) return false;
  if (record.role === 'admin') return true;
  const owner = adminEmail();
  return !!owner && record.email === owner;
}

export function toPublicUser(record) {
  if (!record) return null;
  const current = applyPeriod(record);
  const unlimited = !!current.unlimited;
  const rawLimit = current.monthlyLimitUsd;
  const limit = unlimited ? null : Number(rawLimit);
  const hasLimit = rawLimit != null && Number.isFinite(limit) && limit >= 0;
  const spent = Number(current.spentUsd) || 0;
  return {
    email: current.email,
    isAdmin: isAdminRecord(current),
    unlimited,
    monthlyLimitUsd: hasLimit ? limit : null,
    spentUsd: spent,
    remainingUsd: unlimited || !hasLimit ? null : Math.max(0, limit - spent),
    hasBudget: unlimited || hasLimit,
    periodKey: current.periodKey || periodKey(),
    createdAt: current.createdAt || null,
  };
}

function spendError(user) {
  if (!user) return 'Sign in to use study AI.';
  if (user.unlimited) return null;
  if (!user.hasBudget) {
    return 'This account doesn’t have an AI budget yet.';
  }
  if ((user.remainingUsd ?? 0) <= 0) {
    return 'This account has used its monthly AI cap.';
  }
  return null;
}

async function kvGet() {
  const url = String(process.env.KV_REST_API_URL || '').replace(/\/$/, '');
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.result == null) return null;
    return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
  } catch {
    return null;
  }
}

async function kvSet(store) {
  const url = String(process.env.KV_REST_API_URL || '').replace(/\/$/, '');
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/set/${KV_KEY}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(JSON.stringify(store)),
  });
}

function readFileStore() {
  try {
    return JSON.parse(fs.readFileSync(filePath(), 'utf8'));
  } catch {
    return null;
  }
}

function writeFileStore(store) {
  try {
    const dest = filePath();
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(store, null, 2));
  } catch {
    // Vercel’s app filesystem is read-only except /tmp.
  }
}

async function loadStore() {
  if (memory?.users) return memory;
  const fromKv = await kvGet();
  if (fromKv?.users) {
    memory = fromKv;
    return memory;
  }
  memory = readFileStore() || emptyStore();
  if (!memory.users) memory = emptyStore();
  return memory;
}

async function saveStore(store) {
  memory = store;
  writeFileStore(store);
  await kvSet(store);
}

function locked(fn) {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
}

export function signToken(email) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = Buffer.from(JSON.stringify({ email: normalizeEmail(email), exp })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function emailFromToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.email || Number(data.exp) < Date.now()) return null;
    return normalizeEmail(data.email);
  } catch {
    return null;
  }
}

async function getRecord(email) {
  const store = await loadStore();
  const record = applyPeriod(store.users[normalizeEmail(email)]);
  if (!record) return null;
  if (record !== store.users[record.email]) {
    store.users[record.email] = record;
    await saveStore(store);
  }
  return record;
}

export async function userFromToken(token) {
  const email = emailFromToken(token);
  if (!email) return null;
  return toPublicUser(await getRecord(email));
}

export async function registerAccount(email, password) {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Enter a valid email.');
  }
  if (String(password || '').length < 8) {
    throw new Error('Password needs at least 8 characters.');
  }
  return locked(async () => {
    const store = await loadStore();
    if (store.users[normalized]) {
      throw new Error('That email already has an account. Sign in instead.');
    }
    const first = Object.keys(store.users).length === 0;
    const { hash, salt } = hashPassword(password);
    const admin = first || normalized === adminEmail();
    store.users[normalized] = {
      email: normalized,
      hash,
      salt,
      createdAt: Date.now(),
      role: admin ? 'admin' : 'user',
      monthlyLimitUsd: null,
      unlimited: admin,
      spentUsd: 0,
      periodKey: periodKey(),
    };
    await saveStore(store);
    const user = toPublicUser(store.users[normalized]);
    return { token: signToken(normalized), user };
  });
}

export async function loginAccount(email, password) {
  const normalized = normalizeEmail(email);
  const record = await getRecord(normalized);
  if (!record) throw new Error('No account with that email.');
  const { hash } = hashPassword(password, record.salt);
  const a = Buffer.from(hash);
  const b = Buffer.from(record.hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Wrong email or password.');
  }
  return { token: signToken(normalized), user: toPublicUser(record) };
}

export async function listAccounts(adminToken) {
  const admin = await userFromToken(adminToken);
  if (!admin) throw new Error('Sign in first.');
  if (!admin.isAdmin) throw new Error('Admin only.');
  const store = await loadStore();
  return Object.values(store.users)
    .map((record) => toPublicUser(applyPeriod(record)))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function setAccountLimit(adminToken, email, { monthlyLimitUsd, unlimited = false } = {}) {
  const admin = await userFromToken(adminToken);
  if (!admin) throw new Error('Sign in first.');
  if (!admin.isAdmin) throw new Error('Admin only.');
  const normalized = normalizeEmail(email);
  return locked(async () => {
    const store = await loadStore();
    const record = applyPeriod(store.users[normalized]);
    if (!record) throw new Error('No account with that email.');
    if (unlimited) {
      store.users[normalized] = { ...record, unlimited: true, monthlyLimitUsd: null };
    } else if (monthlyLimitUsd == null || monthlyLimitUsd === '') {
      store.users[normalized] = { ...record, unlimited: false, monthlyLimitUsd: null };
    } else {
      const amount = Number(monthlyLimitUsd);
      if (!Number.isFinite(amount) || amount < 0.5 || amount > 100) {
        throw new Error('Pick a monthly cap between $0.50 and $100.');
      }
      store.users[normalized] = {
        ...record,
        unlimited: false,
        monthlyLimitUsd: Math.round(amount * 100) / 100,
      };
    }
    await saveStore(store);
    return toPublicUser(store.users[normalized]);
  });
}

export async function assertCanSpendForToken(token) {
  const user = await userFromToken(token);
  const message = spendError(user);
  if (message) throw new Error(message);
  return user;
}

export async function recordSpendForToken(token, usd) {
  const email = emailFromToken(token);
  if (!email) return null;
  const amount = Number(usd);
  if (!Number.isFinite(amount) || amount <= 0) return userFromToken(token);
  return locked(async () => {
    const store = await loadStore();
    const record = applyPeriod(store.users[email]);
    if (!record) return null;
    store.users[email] = {
      ...record,
      spentUsd: (Number(record.spentUsd) || 0) + amount,
    };
    await saveStore(store);
    return toPublicUser(store.users[email]);
  });
}
