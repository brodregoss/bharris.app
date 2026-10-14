export const EXTRACT_CALL_MS = 18000;
export const DEFINE_CALL_MS = 10000;
const DEFINE_BATCH = 12;

export function startExtractProgress(imageCount, now = Date.now()) {
  const images = Math.max(1, Number(imageCount) || 1);
  return {
    startedAt: now,
    expectedMs: images * EXTRACT_CALL_MS + DEFINE_CALL_MS,
    shown: 0,
  };
}

export function addExtractPass(state) {
  if (!state) return state;
  return { ...state, expectedMs: state.expectedMs + EXTRACT_CALL_MS };
}

export function planDefinitions(state, termCount, now = Date.now()) {
  if (!state) return state;
  const batches = Math.max(1, Math.ceil(Math.max(0, Number(termCount) || 0) / DEFINE_BATCH));
  const elapsed = Math.max(0, now - state.startedAt);
  const tail = batches * DEFINE_CALL_MS;
  return { ...state, expectedMs: Math.max(state.expectedMs, elapsed + tail) };
}

export function snapshotExtractProgress(state, now = Date.now()) {
  if (!state) return { fraction: 0, remainingMs: null };
  const elapsed = Math.max(0, now - state.startedAt);
  const expected = Math.max(1000, state.expectedMs);
  const raw = Math.min(0.97, elapsed / expected);
  const fraction = Math.max(state.shown || 0, raw);
  state.shown = fraction;
  return { fraction, remainingMs: Math.max(0, expected - elapsed) };
}

export function formatExtractRemaining(remainingMs) {
  if (remainingMs == null) return 'Reading your notes…';
  if (remainingMs < 4000) return 'Your notes are almost ready';
  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) return `About ${seconds} seconds until your notes are ready`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1
    ? 'About 1 minute until your notes are ready'
    : `About ${minutes} minutes until your notes are ready`;
}

// Keeps playing ads, one after another, until the work stops.
// A closed ad does not start the next one.
export async function playWhileWorking(isWorking, play) {
  for (;;) {
    if (!isWorking()) return;
    const earned = await play();
    if (!isWorking() || !earned) return;
  }
}
