const KEY = 'lms_spaced_metrics_v1';
const MAX_EVENTS = 200;
const MAX_SAMPLES = 100;

function emptyMetrics() {
  return {
    events: [],
    cardMs: { flash: [], free: [], mc_term: [], mc_def: [] },
  };
}

function readStore(storage) {
  try {
    const raw = storage?.getItem?.(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return {
        events: (Array.isArray(parsed.events) ? parsed.events : []).slice(-MAX_EVENTS),
        cardMs: { ...emptyMetrics().cardMs, ...(parsed.cardMs || {}) },
      };
    }
  } catch {
    /* ignore a broken local record */
  }
  return emptyMetrics();
}

export function loadSpacedMetrics(storage = globalThis.localStorage) {
  return readStore(storage);
}

export function recordSpacedMetric(entry, storage = globalThis.localStorage) {
  const current = readStore(storage);
  const event = { ...(entry || {}), at: entry?.at || Date.now() };
  const next = {
    events: [...current.events, event].slice(-MAX_EVENTS),
    cardMs: { ...current.cardMs },
  };
  if (event.type === 'card' && Number.isFinite(event.ms) && next.cardMs[event.mode]) {
    next.cardMs[event.mode] = [...next.cardMs[event.mode], event.ms].slice(-MAX_SAMPLES);
  }
  try {
    storage?.setItem?.(KEY, JSON.stringify(next));
  } catch {
    /* storage can be full or blocked */
  }
  return next;
}

export function estimateGapLine(estimatedSeconds, actualMs) {
  const estimated = Math.max(0, Math.round(Number(estimatedSeconds) || 0));
  const actual = Math.max(0, Math.round((Number(actualMs) || 0) / 1000));
  const gap = actual - estimated;
  const signed = `${gap > 0 ? '+' : ''}${gap}`;
  return `Time gap: estimated ${estimated}s, actual ${actual}s (${signed}s)`;
}

export function logEstimateGap(estimatedSeconds, actualMs, { dev = false, log } = {}) {
  if (!dev) return '';
  const line = estimateGapLine(estimatedSeconds, actualMs);
  if (typeof log === 'function') log(line);
  return line;
}
