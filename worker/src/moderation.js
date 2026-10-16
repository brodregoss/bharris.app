import moderationConfig from '../../config/moderation.json' with { type: 'json' };
import { errorJson } from './util.js';
import { addPhotoStrike, setUserSuspended } from './users.js';
import { PHOTO_UNAVAILABLE } from './photoAccess.js';
import { PHOTO_PAUSED, reservePhotoUsage } from './photoUsage.js';
import { postSlackAlert } from './slackAlert.js';

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';
const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';
const SEVERITY_RANK = { none: 0, log: 1, mild: 2, severe: 3 };

let moderationTablesReady = null;

export function imageRejectedMessage(config = moderationConfig) {
  const message = String(config?.messages?.rejected_image || '').trim();
  return message || "This image can't be processed. Try retaking or cropping it.";
}

function higherSeverity(left, right) {
  return (SEVERITY_RANK[left] || 0) >= (SEVERITY_RANK[right] || 0) ? left : right;
}

function likelihoodRank(level, order) {
  return order.indexOf(String(level || '').toUpperCase());
}

export function judgeOpenAi(result, config = moderationConfig) {
  const rules = config.openai || {};
  const flagged = result?.categories || {};
  const scores = result?.category_scores || {};
  const names = new Set([
    ...Object.keys(flagged),
    ...Object.keys(scores),
    ...(rules.severe_if_flagged || []),
    ...Object.keys(rules.severe_min_score || {}),
    ...(rules.mild_if_flagged || []),
  ]);
  const categories = [];
  let severity = 'none';
  for (const name of names) {
    let next = 'none';
    const score = Number(scores[name]);
    const isFlagged = flagged[name] === true;
    const severeScore = rules.severe_min_score?.[name];
    if ((rules.severe_if_flagged || []).includes(name) && isFlagged) next = 'severe';
    if (severeScore != null && Number.isFinite(score) && score >= Number(severeScore)) next = 'severe';
    if (next !== 'severe' && (rules.mild_if_flagged || []).includes(name) && isFlagged) next = 'mild';
    if (next === 'none') continue;
    categories.push(name);
    severity = higherSeverity(severity, next);
  }
  return { provider: 'openai', ok: true, severity, categories };
}

export function judgeSafeSearch(annotation, config = moderationConfig) {
  const rules = config.safesearch || {};
  const order = config.likelihoods || [];
  const ignored = new Set(rules.ignore || []);
  const categories = [];
  let severity = 'none';
  for (const [name, level] of Object.entries(annotation || {})) {
    if (ignored.has(name)) continue;
    const rank = likelihoodRank(level, order);
    if (rank < 0) continue;
    let next = 'none';
    const severeAt = rules.severe_at?.[name];
    const mildAt = rules.mild_at?.[name];
    const logAt = rules.log_at?.[name];
    if (severeAt && rank >= likelihoodRank(severeAt, order)) next = 'severe';
    else if (mildAt && rank >= likelihoodRank(mildAt, order)) next = 'mild';
    else if (logAt && rank >= likelihoodRank(logAt, order)) next = 'log';
    if (next === 'none') continue;
    categories.push(name);
    severity = higherSeverity(severity, next);
  }
  return { provider: 'safesearch', ok: true, severity, categories };
}

export function combineProviderResults(results) {
  const failed = results.filter((item) => !item?.ok);
  const judged = results.filter((item) => item?.ok);
  let severity = 'none';
  const categories = [];
  for (const item of judged) {
    severity = higherSeverity(severity, item.severity || 'none');
    categories.push(...(item.categories || []));
  }
  const unique = [...new Set(categories)];
  if (severity === 'severe') {
    return { block: true, strike: false, suspend: true, severity, categories: unique, results };
  }
  if (failed.length && severity !== 'mild') {
    return { block: true, strike: false, suspend: false, severity: 'error', categories: unique, results };
  }
  if (severity === 'mild') {
    return { block: true, strike: true, suspend: false, severity, categories: unique, results };
  }
  return { block: false, strike: false, suspend: false, severity, categories: unique, results };
}

function providerError(provider) {
  return { provider, ok: false, severity: 'error', categories: [] };
}

function bytesToBase64(bytes) {
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

export function decodeImageDataUrl(input) {
  if (typeof input !== 'string' || !input.startsWith('data:image/')) return null;
  const comma = input.indexOf(',');
  if (comma < 0) return null;
  const mime = /data:(image\/[a-z0-9.+-]+)/i.exec(input.slice(0, comma))?.[1]?.toLowerCase();
  if (!mime) return null;
  try {
    const binary = atob(input.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (!bytes.byteLength) return null;
    return { bytes, contentType: mime };
  } catch {
    return null;
  }
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  let hex = '';
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

async function callOpenAi(bytes, contentType, env, config, fetchImpl) {
  const key = String(env?.OPENAI_API_KEY || '');
  if (!key) return providerError('openai');
  try {
    const response = await fetchImpl(OPENAI_MODERATION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openai?.model || 'omni-moderation-latest',
        input: [{
          type: 'image_url',
          image_url: { url: `data:${contentType};base64,${bytesToBase64(bytes)}` },
        }],
      }),
      signal: AbortSignal.timeout(Number(config.timeout_ms) || 5000),
    });
    if (!response.ok) return providerError('openai');
    const payload = await response.json();
    const result = payload?.results?.[0];
    if (!result) return providerError('openai');
    return judgeOpenAi(result, config);
  } catch {
    return providerError('openai');
  }
}

async function callSafeSearch(bytes, env, config, fetchImpl) {
  const key = String(env?.GOOGLE_VISION_API_KEY || '');
  if (!key) return providerError('safesearch');
  try {
    const response = await fetchImpl(VISION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify({
        requests: [{
          image: { content: bytesToBase64(bytes) },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        }],
      }),
      signal: AbortSignal.timeout(Number(config.timeout_ms) || 5000),
    });
    if (!response.ok) return providerError('safesearch');
    const payload = await response.json();
    const annotation = payload?.responses?.[0]?.safeSearchAnnotation;
    if (!annotation || payload?.responses?.[0]?.error) return providerError('safesearch');
    return judgeSafeSearch(annotation, config);
  } catch {
    return providerError('safesearch');
  }
}

// PhotoDNA / Thorn Safer and Hive stay off unless their provider flag is true.
// Turning one on fails closed. This is not a hash database.
// PhotoDNA access is applied for through Thorn / NCMEC Safer, not built here.
// Hive visual moderation needs a Hive account and a server-side key.
function stubProvider(name, config) {
  if (!config.providers?.[name]) return null;
  return providerError(name);
}

async function settleProvider(work, timeoutMs, provider) {
  let timer;
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
        }, timeoutMs);
      }),
    ]);
  } catch {
    return providerError(provider);
  } finally {
    clearTimeout(timer);
  }
}

export async function moderateBytes(bytes, contentType, env, options = {}) {
  const config = options.config || moderationConfig;
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Number(config.timeout_ms) || 5000;
  const jobs = [];
  if (config.providers?.openai) {
    jobs.push(settleProvider(
      callOpenAi(bytes, contentType, env, config, fetchImpl),
      timeoutMs,
      'openai',
    ));
  }
  if (config.providers?.safesearch) {
    jobs.push(settleProvider(
      callSafeSearch(bytes, env, config, fetchImpl),
      timeoutMs,
      'safesearch',
    ));
  }
  for (const name of ['photodna', 'hive']) {
    const stub = stubProvider(name, config);
    if (stub) jobs.push(Promise.resolve(stub));
  }
  if (!jobs.length) {
    return combineProviderResults([providerError('none')]);
  }
  return combineProviderResults(await Promise.all(jobs));
}

async function ensureModerationTables(env) {
  if (!env?.APP?.prepare) throw new Error('Moderation log storage is not configured');
  if (!moderationTablesReady) {
    moderationTablesReady = env.APP.prepare(
      `CREATE TABLE IF NOT EXISTS moderation_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT NOT NULL,
        created_at TEXT NOT NULL,
        provider TEXT NOT NULL,
        categories TEXT NOT NULL,
        severity TEXT NOT NULL,
        image_sha256 TEXT NOT NULL
      )`,
    ).run().catch((err) => {
      moderationTablesReady = null;
      throw err;
    });
  }
  return moderationTablesReady;
}

function alertUserId(uid) {
  const id = String(uid ?? '');
  if (!id || id.includes('@') || /data:image|base64,/i.test(id)) return 'unknown';
  return id;
}

export function moderationAlertText(uid, result, time) {
  const loud = result?.severity === 'severe';
  const headline = loud ? 'SEVERE moderation flag' : 'Moderation flag';
  const severity = result?.ok ? result.severity : 'error';
  const categories = Array.isArray(result?.categories) ? result.categories.join(',') : '';
  return `${headline} userId=${alertUserId(uid)} severity=${severity} categories=${categories} time=${time}`;
}

async function sendAlert(env, uid, result, time, fetchImpl, timeoutMs) {
  await postSlackAlert(env, moderationAlertText(uid, result, time), fetchImpl, timeoutMs);
}

async function recordEvents(env, uid, imageHash, decision, time) {
  await ensureModerationTables(env);
  for (const result of decision.results || []) {
    if (result.ok && result.severity === 'none') continue;
    const categories = JSON.stringify(result.categories || []);
    await env.APP.prepare(
      `INSERT INTO moderation_events (
        firebase_uid, created_at, provider, categories, severity, image_sha256
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(
      uid,
      time,
      String(result.provider || ''),
      categories,
      result.ok ? result.severity : 'error',
      imageHash,
    ).run();
  }
}

export async function enforceImageModeration(env, identity, dataUrl, options = {}) {
  try {
    const decoded = decodeImageDataUrl(dataUrl);
    if (!decoded) return errorJson(imageRejectedMessage(options.config), 400);
    const uid = String(identity?.uid || '');
    const reserved = await reservePhotoUsage(env, uid, 'check', options);
    if (!reserved.allowed) {
      return errorJson(reserved.reason === 'cap' ? PHOTO_PAUSED : PHOTO_UNAVAILABLE, 403);
    }
    const decision = await moderateBytes(decoded.bytes, decoded.contentType, env, options);
    const imageHash = await sha256Hex(decoded.bytes);
    const time = new Date().toISOString();
    try {
      await recordEvents(env, uid, imageHash, decision, time);
    } catch {
      // Still block. Do not include the image in the failure.
    }
    const fetchImpl = options.fetchImpl || fetch;
    const timeoutMs = Number((options.config || moderationConfig).timeout_ms) || 5000;
    for (const result of decision.results || []) {
      if (result.ok && result.severity === 'none') continue;
      await sendAlert(env, uid, result, time, fetchImpl, timeoutMs);
    }
    if (decision.suspend) await setUserSuspended(env, uid, true);
    else if (decision.strike) await addPhotoStrike(env, uid);
    if (!decision.block) return null;
    if (decision.severity === 'error') return errorJson(PHOTO_UNAVAILABLE, 403);
    return errorJson(imageRejectedMessage(options.config), 400);
  } catch {
    return errorJson(PHOTO_UNAVAILABLE, 403);
  }
}
