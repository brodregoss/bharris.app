import moderationConfig from '../../config/moderation.json' with { type: 'json' };

const IMAGE_URL = /^data:image\/(jpeg|png|webp|gif)(;|$)/i;

export function extractLimits(config = moderationConfig) {
  const extract = config.extract || {};
  return {
    maxImages: Number(extract.max_images) || 2,
    maxChars: Number(extract.max_image_chars) || 5_000_000,
    windowMs: Number(extract.window_ms) || 3_600_000,
    maxPerWindow: Number(extract.max_per_window) || 20,
  };
}

function pushImage(list, value) {
  if (typeof value === 'string') {
    if (value) list.push(value);
    return;
  }
  if (value && typeof value === 'object') {
    const nested = value.dataUrl || value.data || value.image;
    list.push(typeof nested === 'string' && nested ? nested : null);
  }
}

export function collectImages(body) {
  const images = [];
  pushImage(images, body?.image);
  if (Array.isArray(body?.images)) {
    body.images.forEach((item) => pushImage(images, item));
  }
  return images;
}

export function inspectImagePayload(body, limits = extractLimits()) {
  const images = collectImages(body);
  if (!images.length) return { ok: true, images };
  if (images.length > limits.maxImages) {
    return { ok: false, status: 400, message: `You can attach up to ${limits.maxImages} photos.` };
  }
  for (const image of images) {
    if (typeof image !== 'string' || !IMAGE_URL.test(image)) {
      return { ok: false, status: 400, message: 'Photo must be an image' };
    }
    if (image.length > limits.maxChars) {
      return { ok: false, status: 400, message: 'Photo is too large' };
    }
  }
  return { ok: true, images };
}

async function ensureExtractTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS photo_extract_windows (
      firebase_uid TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (firebase_uid, window_start)
    )`,
  ).run();
}

// One count per extract request. A storage failure rejects the request.
export async function reserveExtract(env, uid, now = Date.now(), limits = extractLimits()) {
  const db = env?.APP;
  if (!db?.prepare || !uid) throw new Error('extract rate limit unavailable');
  await ensureExtractTable(db);
  const windowStart = Math.floor(now / limits.windowMs) * limits.windowMs;
  await db.prepare(
    `INSERT INTO photo_extract_windows (firebase_uid, window_start, hits)
     VALUES (?, ?, 1)
     ON CONFLICT(firebase_uid, window_start)
     DO UPDATE SET hits = hits + 1`,
  ).bind(uid, windowStart).run();
  const row = await db.prepare(
    'SELECT hits FROM photo_extract_windows WHERE firebase_uid = ? AND window_start = ?',
  ).bind(uid, windowStart).first();
  const hits = Number(row?.hits) || 0;
  return { allowed: hits <= limits.maxPerWindow, hits };
}
