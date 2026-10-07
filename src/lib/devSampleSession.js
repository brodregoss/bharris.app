import { emptySpacedState, resolveExamTime } from '@/lib/spacedCram';
import { DEV_SAMPLE_MARKER, DEV_SAMPLE_PREV, DEV_SAMPLE_UID } from '@/lib/devSampleGate';

export { DEV_SAMPLE_MARKER, DEV_SAMPLE_PREV, DEV_SAMPLE_UID };

export function sampleExitPlan(previousUid) {
  const uid = previousUid && previousUid !== DEV_SAMPLE_UID ? String(previousUid) : '';
  return { uid, path: uid ? '/' : '/account' };
}

export function buildDevSampleSession(count, now = Date.now()) {
  const n = Number(count) >= 40 ? 60 : 12;
  const examClock = '09:00';
  const examTiming = 'tomorrow';
  const terms = Array.from({ length: n }, (_, i) => ({
    id: `sample-${i + 1}`,
    term: `Sample term ${i + 1}`,
    definition: `Definition for sample term ${i + 1}.`,
    tier: i % 11 === 0 ? 'critical' : 'core',
    confidence: 'shaky',
  }));
  return {
    title: 'Sample session',
    setup: {
      title: 'Sample session',
      examType: 'short_answer',
      examTiming,
      hours: 20,
      studyMode: 'spaced_cram',
    },
    terms,
    spaced: {
      ...emptySpacedState(),
      stopTime: '22:30',
      wakeTime: '07:00',
      examClock,
      examTime: resolveExamTime({ now, examTiming, examClock }),
    },
  };
}

export async function loadDevSampleSession(count, now = Date.now()) {
  if (import.meta.env?.DEV !== true) return null;
  const session = buildDevSampleSession(count, now);
  const { getActiveUid, setActiveUid } = await import('@/lib/userStorage');
  const { beginSession } = await import('@/lib/sessionStore');
  const previous = getActiveUid();
  try {
    localStorage.setItem(DEV_SAMPLE_MARKER, '1');
    if (previous && previous !== DEV_SAMPLE_UID) localStorage.setItem(DEV_SAMPLE_PREV, previous);
    else localStorage.removeItem(DEV_SAMPLE_PREV);
  } catch {
    return null;
  }
  setActiveUid(DEV_SAMPLE_UID);
  beginSession(session);
  return session;
}

export async function exitDevSampleSession() {
  if (import.meta.env?.DEV !== true) return null;
  const { setActiveUid } = await import('@/lib/userStorage');
  let previous = '';
  try {
    previous = localStorage.getItem(DEV_SAMPLE_PREV) || '';
    localStorage.removeItem(DEV_SAMPLE_MARKER);
    localStorage.removeItem(DEV_SAMPLE_PREV);
  } catch {
    return null;
  }
  const plan = sampleExitPlan(previous);
  setActiveUid(plan.uid);
  return plan;
}
