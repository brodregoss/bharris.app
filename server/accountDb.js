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

export const ADMIN_PIN = '95032';
export const GUEST_PIN = '12345';
const ADMIN_ID = 'admin@local';
const GUEST_ID = 'guest@local';
const GUEST_LIMIT_USD = 1;

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
  if (!user) return 'Enter the password to use study AI.';
  if (user.unlimited) return null;
  if (!user.hasBudget) {
    return 'Study AI isn’t available right now.';
  }
  if ((user.remainingUsd ?? 0) <= 0) {
    return 'This month’s AI limit is used up.';
  }
  return null;
}

function kvConfig() {
  const url = String(
    process.env.KV_REST_API_URL
    || process.env.UPSTASH_REDIS_REST_URL
    || '',
  ).replace(/\/$/, '');
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvGet() {
  const kv = kvConfig();
  if (!kv) return null;
  try {
    const res = await fetch(`${kv.url}/get/${encodeURIComponent(KV_KEY)}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
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
  const kv = kvConfig();
  if (!kv) return;
  await fetch(kv.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kv.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(['SET', KV_KEY, JSON.stringify(store)]),
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

async function storeWithBuiltins() {
  const store = await loadStore();
  if (applyBuiltins(store)) await saveStore(store);
  return store;
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
  const store = await storeWithBuiltins();
  const record = applyPeriod(store.users[normalizeEmail(email)]);
  if (!record) return null;
  if (record !== store.users[record.email]) {
    store.users[record.email] = record;
    await saveStore(store);
  }
  return record;
}

function applyBuiltins(store) {
  let changed = false;
  const admin = applyPeriod(store.users[ADMIN_ID]);
  if (!admin) {
    store.users[ADMIN_ID] = {
      email: ADMIN_ID,
      createdAt: Date.now(),
      role: 'admin',
      monthlyLimitUsd: null,
      unlimited: true,
      spentUsd: 0,
      periodKey: periodKey(),
    };
    changed = true;
  } else if (admin.role !== 'admin' || !admin.unlimited) {
    store.users[ADMIN_ID] = {
      ...admin,
      role: 'admin',
      unlimited: true,
      monthlyLimitUsd: null,
    };
    changed = true;
  } else if (admin !== store.users[ADMIN_ID]) {
    store.users[ADMIN_ID] = admin;
    changed = true;
  }

  const guest = applyPeriod(store.users[GUEST_ID]);
  if (!guest) {
    store.users[GUEST_ID] = {
      email: GUEST_ID,
      createdAt: Date.now(),
      role: 'user',
      monthlyLimitUsd: GUEST_LIMIT_USD,
      unlimited: false,
      spentUsd: 0,
      periodKey: periodKey(),
    };
    changed = true;
  } else if (guest.unlimited || guest.monthlyLimitUsd !== GUEST_LIMIT_USD) {
    store.users[GUEST_ID] = {
      ...guest,
      role: 'user',
      unlimited: false,
      monthlyLimitUsd: GUEST_LIMIT_USD,
    };
    changed = true;
  } else if (guest !== store.users[GUEST_ID]) {
    store.users[GUEST_ID] = guest;
    changed = true;
  }
  return changed;
}

export async function userFromToken(token) {
  const email = emailFromToken(token);
  if (!email) return null;
  return toPublicUser(await getRecord(email));
}

export async function unlockWithPin(pin) {
  const value = String(pin || '');
  let id = null;
  if (value === ADMIN_PIN) id = ADMIN_ID;
  else if (value === GUEST_PIN) id = GUEST_ID;
  else throw new Error('Wrong password.');
  return locked(async () => {
    const store = await loadStore();
    if (applyBuiltins(store)) await saveStore(store);
    const record = applyPeriod(store.users[id]);
    if (record !== store.users[id]) {
      store.users[id] = record;
      await saveStore(store);
    }
    return { token: signToken(id), user: toPublicUser(record) };
  });
}

export async function usageForToken(token) {
  const email = emailFromToken(token);
  if (!email) throw new Error('Enter the password first.');
  return locked(async () => {
    const store = await loadStore();
    if (applyBuiltins(store)) await saveStore(store);
    const me = toPublicUser(applyPeriod(store.users[email]));
    if (!me) throw new Error('Enter the password first.');
    if (!me.isAdmin) return { me };
    return {
      me: toPublicUser(applyPeriod(store.users[ADMIN_ID])),
      guests: toPublicUser(applyPeriod(store.users[GUEST_ID])),
    };
  });
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

function hasAdminPin(pin) {
  return String(pin || '') === '95032';
}

async function requireAdmin(adminToken, pin) {
  const admin = await userFromToken(adminToken);
  if (!admin) throw new Error('Sign in first.');
  if (!admin.isAdmin && !hasAdminPin(pin)) throw new Error('Admin only.');
  return admin;
}

export async function listAccounts(adminToken, pin) {
  await requireAdmin(adminToken, pin);
  const store = await loadStore();
  return Object.values(store.users)
    .map((record) => toPublicUser(applyPeriod(record)))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function setAccountLimit(adminToken, email, { monthlyLimitUsd, unlimited = false, pin } = {}) {
  await requireAdmin(adminToken, pin);
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
    const store = await storeWithBuiltins();
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
