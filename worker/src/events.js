import { errorJson, json, readJson } from './util.js';

const CLIENT_EVENTS = new Set([
  'cram_started',
  'terms_shown',
  'cap_hit',
  'cram_finished',
  'pass_shown',
]);

const tablesReady = new WeakMap();

function cleanToken(value, max) {
  return String(value || '').replace(/[^\w.:-]+/g, '').slice(0, max);
}

export function analyticsPoint({ name, feature = '', doubles = [1] } = {}) {
  const label = String(name || '').slice(0, 96);
  return {
    indexes: [label],
    blobs: [label, String(feature || '').slice(0, 96)],
    doubles: doubles.map((value) => Number(value) || 0),
  };
}

function writeAnalytics(env, point) {
  try {
    env.ANALYTICS?.writeDataPoint?.(point);
  } catch {
    /* A dashboard write must not break the request. */
  }
}

export function normalizeIncoming(body) {
  const name = String(body?.name || '');
  if (!CLIENT_EVENTS.has(name)) return { error: 'Unknown event.' };
  return {
    name,
    feature: cleanToken(body?.feature, 40),
    detail: cleanToken(body?.detail, 80),
  };
}

async function ensureEventTables(env) {
  if (!env.APP?.prepare) return false;
  let pending = tablesReady.get(env.APP);
  if (!pending) {
    pending = (async () => {
      await env.APP.prepare(
        `CREATE TABLE IF NOT EXISTS product_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uid TEXT NOT NULL,
          name TEXT NOT NULL,
          feature TEXT NOT NULL DEFAULT '',
          detail TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL
        )`,
      ).run();
      await env.APP.prepare(
        'CREATE INDEX IF NOT EXISTS idx_product_events_name ON product_events (name, created_at)',
      ).run();
      await env.APP.prepare(
        'CREATE INDEX IF NOT EXISTS idx_product_events_uid ON product_events (uid, name, detail)',
      ).run();
      await env.APP.prepare(
        `CREATE TABLE IF NOT EXISTS ai_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          uid TEXT NOT NULL,
          feature TEXT NOT NULL DEFAULT '',
          model TEXT NOT NULL DEFAULT '',
          prompt_tokens INTEGER NOT NULL DEFAULT 0,
          completion_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )`,
      ).run();
      await env.APP.prepare(
        'CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage (created_at)',
      ).run();
    })().catch((err) => {
      tablesReady.delete(env.APP);
      throw err;
    });
    tablesReady.set(env.APP, pending);
  }
  await pending;
  return true;
}

export async function recordEvent(env, { uid, name, feature = '', detail = '' } = {}) {
  try {
    if (!uid || !name) return null;
    const safeFeature = cleanToken(feature, 40);
    const safeDetail = cleanToken(detail, 80);
    const ready = await ensureEventTables(env);
    if (ready && name === 'pass_bought' && safeDetail) {
      const existing = await env.APP.prepare(
        'SELECT id FROM product_events WHERE uid = ? AND name = ? AND detail = ? LIMIT 1',
      ).bind(uid, name, safeDetail).first();
      if (existing) return existing;
    }
    if (ready) {
      await env.APP.prepare(
        'INSERT INTO product_events (uid, name, feature, detail, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(uid, name, safeFeature, safeDetail, new Date().toISOString()).run();
    }
    writeAnalytics(env, analyticsPoint({ name, feature: safeFeature }));
    return { ok: true };
  } catch {
    return null;
  }
}

export async function recordTokenUsage(env, { uid, feature = '', model = '', usage } = {}) {
  try {
    const prompt = Number(usage?.prompt_tokens) || 0;
    const completion = Number(usage?.completion_tokens) || 0;
    const total = Number(usage?.total_tokens) || prompt + completion;
    if (!uid || total <= 0) return null;
    writeAnalytics(env, analyticsPoint({
      name: 'ai_tokens',
      feature: cleanToken(feature, 40),
      doubles: [prompt, completion, total],
    }));
    if (!(await ensureEventTables(env))) return null;
    await env.APP.prepare(
      `INSERT INTO ai_usage (
        uid, feature, model, prompt_tokens, completion_tokens, total_tokens, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      uid,
      cleanToken(feature, 40),
      cleanToken(model, 40),
      prompt,
      completion,
      total,
      new Date().toISOString(),
    ).run();
    return { ok: true };
  } catch {
    return null;
  }
}

export async function deleteAccountTelemetry(env, uid) {
  try {
    if (!uid || !(await ensureEventTables(env))) return;
    await env.APP.prepare('DELETE FROM product_events WHERE uid = ?').bind(uid).run();
    await env.APP.prepare('DELETE FROM ai_usage WHERE uid = ?').bind(uid).run();
  } catch {
    /* A missing analytics table must not block account deletion. */
  }
}

export async function handleRecordEvent(request, env, identity) {
  const body = await readJson(request);
  const event = normalizeIncoming(body);
  if (event.error) return errorJson(event.error, 400);
  await recordEvent(env, { uid: identity.uid, ...event });
  return json({ ok: true });
}
