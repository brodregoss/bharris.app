import { cardEstimateSeconds } from './spacedCram.js';

const MODES = ['flash', 'free', 'mc_term', 'mc_def'];
const SITTING_TYPES = new Set([
  'sitting_started',
  'sitting_completed',
  'sitting_abandoned',
  'start_anyway',
  'last_look',
]);

export function spacedLogView(metrics) {
  const events = Array.isArray(metrics?.events) ? metrics.events : [];
  const samples = {};
  events.forEach((event) => {
    if (event?.type !== 'card' || !Number.isFinite(event.ms)) return;
    if (!samples[event.mode]) samples[event.mode] = [];
    samples[event.mode].push(event.ms);
  });
  return {
    sittings: events.filter((event) => SITTING_TYPES.has(event?.type)),
    modes: MODES.map((mode) => {
      const times = samples[mode] || [];
      const actualMs = times.length ? times.reduce((sum, ms) => sum + ms, 0) / times.length : null;
      return {
        mode,
        estimatedSeconds: cardEstimateSeconds(mode),
        actualSeconds: actualMs == null ? null : Math.round(actualMs / 1000),
        count: times.length,
      };
    }),
  };
}

export function sittingEventLine(event) {
  const sitting = Number(event?.sitting) || 0;
  if (event?.type === 'sitting_completed') {
    const actual = Math.max(0, Math.round((Number(event.actualMs) || 0) / 1000));
    const estimated = Math.max(0, Math.round(Number(event.estimatedSeconds) || 0));
    return `Sitting ${sitting} completed: estimated ${estimated}s, actual ${actual}s`;
  }
  if (event?.type === 'sitting_started') return `Sitting ${sitting} started`;
  if (event?.type === 'sitting_abandoned') return `Sitting ${sitting} abandoned`;
  if (event?.type === 'start_anyway') return `Start anyway, sitting ${sitting}`;
  if (event?.type === 'last_look') return 'Last look';
  return '';
}

export function modeTimeLine(mode) {
  const estimated = `${mode.mode}: estimated ${mode.estimatedSeconds}s`;
  if (!mode.count) return `${estimated}, no cards yet`;
  const noun = mode.count === 1 ? 'card' : 'cards';
  return `${estimated}, actual ${mode.actualSeconds}s (${mode.count} ${noun})`;
}
