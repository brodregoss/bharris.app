import moderationConfig from '../../config/moderation.json' with { type: 'json' };
import { postSlackAlert } from './slackAlert.js';

export const PHOTO_PAUSED = 'Photo import is paused for today. Try again tomorrow.';

const KINDS = new Set(['check', 'vision']);
const DEFAULTS = {
  check: { globalDaily: 300, perUserDaily: 60, globalMonthly: 5000 },
  vision: { globalDaily: 300, perUserDaily: 100, globalMonthly: 5000 },
};

const readyDatabases = new WeakSet();

function wholeNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return number;
}

export function usageCaps(config = moderationConfig) {
  const check = config?.caps?.check || {};
  const vision = config?.caps?.vision || {};
  return {
    check: {
      globalDaily: wholeNumber(check.global_daily_cap, DEFAULTS.check.globalDaily),
      perUserDaily: wholeNumber(check.per_user_daily_cap, DEFAULTS.check.perUserDaily),
      globalMonthly: wholeNumber(check.global_monthly_cap, DEFAULTS.check.globalMonthly),
    },
    vision: {
      globalDaily: wholeNumber(vision.global_daily_cap, DEFAULTS.vision.globalDaily),
      perUserDaily: wholeNumber(vision.per_user_daily_cap, DEFAULTS.vision.perUserDaily),
      globalMonthly: wholeNumber(vision.global_monthly_cap, DEFAULTS.vision.globalMonthly),
    },
  };
}

function asDate(now) {
  const date = now instanceof Date ? now : new Date(now || Date.now());
  if (Number.isNaN(date.getTime())) throw new Error('bad time');
  return date;
}

export function usageBucketKeys(now = new Date()) {
  const day = asDate(now).toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  return { day, month, dayBucket: `day:${day}`, monthBucket: `month:${month}` };
}

export function userDayBucket(uid, day) {
  return `user:${uid}:day:${day}`;
}

export function usageAlertText({ kind, period, count, cap, time }) {
  return `Photo usage kind=${kind} period=${period} count=${Number(count) || 0} cap=${Number(cap) || 0} time=${time}`;
}

export function formatUsageReport(rows, caps, day, month) {
  const list = Array.isArray(rows) ? rows : [];
  const lines = [];
  for (const kind of ['check', 'vision']) {
    const limits = caps[kind];
    const today = countOf(list, kind, `day:${day}`);
    const monthCount = countOf(list, kind, `month:${month}`);
    lines.push(
      `${kind} today=${today}/${limits.globalDaily} month=${monthCount}/${limits.globalMonthly} per_user_daily_cap=${limits.perUserDaily}`,
    );
  }
  const people = [];
  for (const row of list) {
    const match = /^user:(.+):day:(\d{4}-\d{2}-\d{2})$/.exec(String(row?.bucket || ''));
    if (!match || match[2] !== day) continue;
    if (row.kind !== 'check' && row.kind !== 'vision') continue;
    people.push({ kind: row.kind, uid: match[1], count: Number(row.count) || 0 });
  }
  people.sort((left, right) => left.kind.localeCompare(right.kind) || left.uid.localeCompare(right.uid));
  for (const person of people) {
    lines.push(`${person.kind} uid=${person.uid} today=${person.count}`);
  }
  return lines;
}

function countOf(rows, kind, bucket) {
  const row = rows.find((item) => item?.kind === kind && item?.bucket === bucket);
  return Number(row?.count) || 0;
}

async function ensureUsageTables(env) {
  const db = env?.APP;
  if (!db?.prepare) throw new Error('Usage storage is not configured');
  if (readyDatabases.has(db)) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS photo_usage (
      kind TEXT NOT NULL,
      bucket TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (kind, bucket)
    )`,
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS photo_usage_alerts (
      kind TEXT NOT NULL,
      bucket TEXT NOT NULL,
      threshold TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      PRIMARY KEY (kind, bucket, threshold)
    )`,
  ).run();
  readyDatabases.add(db);
}

async function readCount(db, kind, bucket) {
  const row = await db.prepare(
    'SELECT count FROM photo_usage WHERE kind = ? AND bucket = ?',
  ).bind(kind, bucket).first();
  if (row && !Number.isFinite(Number(row.count))) throw new Error('usage count unreadable');
  return Number(row?.count) || 0;
}

async function bump(db, kind, bucket) {
  const result = await db.prepare(
    `INSERT INTO photo_usage (kind, bucket, count) VALUES (?, ?, 1)
     ON CONFLICT(kind, bucket) DO UPDATE SET count = count + 1`,
  ).bind(kind, bucket).run();
  if (!result || result.success === false) throw new Error('usage write failed');
}

async function markAlert(env, kind, bucket, threshold, time, payload, fetchImpl, timeoutMs) {
  const inserted = await env.APP.prepare(
    `INSERT INTO photo_usage_alerts (kind, bucket, threshold, sent_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(kind, bucket, threshold) DO NOTHING`,
  ).bind(kind, bucket, threshold, time).run();
  if ((Number(inserted?.meta?.changes) || 0) !== 1) return;
  await postSlackAlert(env, usageAlertText(payload), fetchImpl, timeoutMs);
}

async function alertGlobal(env, kind, period, bucket, count, cap, time, fetchImpl, timeoutMs) {
  const marks = [];
  if (count >= Math.ceil(cap * 0.8)) marks.push('80');
  if (count >= cap) marks.push('100');
  for (const threshold of marks) {
    await markAlert(env, kind, bucket, threshold, time, {
      kind,
      period,
      count,
      cap,
      time,
    }, fetchImpl, timeoutMs);
  }
}

// One count per image check, or per study-model request that includes an image.
// A storage failure rejects the request. Crossing a cap does not add a strike.
export async function reservePhotoUsage(env, uid, kind, options = {}) {
  try {
    if (!KINDS.has(kind) || !uid) return { allowed: false, reason: 'error' };
    await ensureUsageTables(env);
    const limits = usageCaps(options.config)[kind];
    const keys = usageBucketKeys(options.now);
    const userBucket = userDayBucket(uid, keys.day);
    const db = env.APP;
    const userCount = await readCount(db, kind, userBucket);
    const dayCount = await readCount(db, kind, keys.dayBucket);
    const monthCount = await readCount(db, kind, keys.monthBucket);
    if (
      userCount >= limits.perUserDaily
      || dayCount >= limits.globalDaily
      || monthCount >= limits.globalMonthly
    ) {
      return { allowed: false, reason: 'cap' };
    }
    await bump(db, kind, userBucket);
    await bump(db, kind, keys.dayBucket);
    await bump(db, kind, keys.monthBucket);
    try {
      const time = asDate(options.now).toISOString();
      const fetchImpl = options.fetchImpl || fetch;
      const timeoutMs = Number((options.config || moderationConfig).timeout_ms) || 5000;
      const nextDay = await readCount(db, kind, keys.dayBucket);
      const nextMonth = await readCount(db, kind, keys.monthBucket);
      await alertGlobal(
        env, kind, 'day', keys.dayBucket, nextDay, limits.globalDaily, time, fetchImpl, timeoutMs,
      );
      await alertGlobal(
        env, kind, 'month', keys.monthBucket, nextMonth, limits.globalMonthly, time, fetchImpl, timeoutMs,
      );
    } catch {
      // Alert bookkeeping does not undo an allowed count.
    }
    return { allowed: true };
  } catch {
    return { allowed: false, reason: 'error' };
  }
}
