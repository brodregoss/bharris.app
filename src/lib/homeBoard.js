import { greetingName } from '@/lib/personName';

export const HOME_QUOTES = [
  "There's someone out there working harder than you right now.",
  'The exam does not care that you are tired.',
  'One more pass beats one more scroll.',
  'You do not need to feel ready. You need to start.',
  'The terms you skip are the ones that show up.',
  'Sit down. The hard part is already the sitting down.',
  "Tomorrow's score is tonight's reps.",
];

function localDayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

// Today's line is the first quote. Later days walk forward through the list.
export function quoteForDay(date, quotes = HOME_QUOTES, now = new Date()) {
  const list = quotes.length ? quotes : HOME_QUOTES;
  const delta = localDayNumber(date) - localDayNumber(now);
  return list[((delta % list.length) + list.length) % list.length];
}

export function secondsLeftInDay(date) {
  const end = new Date(date);
  end.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((end.getTime() - date.getTime()) / 1000));
}

export function formatCount(value) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-US');
}

export function accountHandle(displayName, { style = 'last', email = '' } = {}) {
  const fromName = String(greetingName(displayName, style) || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  if (fromName) return fromName;
  const local = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '');
  return local || 'you';
}

export function termWasStudied(term) {
  if (!term || typeof term !== 'object') return false;
  if (term.seen) return true;
  if (term.srs?.introduced) return true;
  if (Array.isArray(term.recallHistory) && term.recallHistory.length > 0) return true;
  if (typeof term.mastery === 'number' && term.mastery > 0) return true;
  if (term.testResult === true || term.testResult === false) return true;
  if ((term.correctStreak || 0) > 0) return true;
  return false;
}

export function studiedTermCount(sessions) {
  const usedSessions = new Set();
  const seen = new Set();
  let count = 0;
  for (const session of sessions || []) {
    if (!session?.terms?.length) continue;
    const sid = session.id || '';
    if (sid && usedSessions.has(sid)) continue;
    if (sid) usedSessions.add(sid);
    session.terms.forEach((term, index) => {
      if (!termWasStudied(term)) return;
      const key = `${sid}:${term.id || term.term || index}`;
      if (seen.has(key)) return;
      seen.add(key);
      count += 1;
    });
  }
  return count;
}

export function elapsedFromTerms(terms) {
  let min = Infinity;
  let max = 0;
  for (const term of Array.isArray(terms) ? terms : []) {
    for (const hit of term?.recallHistory || []) {
      const ts = Number(hit?.timestamp || hit?.at || 0);
      if (!ts) continue;
      if (ts < min) min = ts;
      if (ts > max) max = ts;
    }
  }
  if (!Number.isFinite(min) || max <= min) return 0;
  return max - min;
}

// Minutes ahead of the plan. Positive is ahead, negative is behind.
// Null means there is not enough of a clock yet to judge.
export function minutesAhead({ terms, plannedHours, elapsedMs } = {}) {
  const list = Array.isArray(terms) ? terms : [];
  const total = list.length;
  const plannedMs = Math.max(0, Number(plannedHours) || 0) * 3_600_000;
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  if (!total || !plannedMs) return null;
  const studied = list.filter(termWasStudied).length;
  if (elapsed < 60_000) return studied > 0 ? null : 0;
  const expected = Math.min(1, elapsed / plannedMs);
  const actual = studied / total;
  return Math.round((actual - expected) * (plannedMs / 60_000));
}

export function sessionPace(session) {
  if (!session) return null;
  const stored = Math.max(0, Number(session.elapsedMs) || 0);
  const elapsedMs = Math.max(stored, elapsedFromTerms(session.terms));
  return minutesAhead({
    terms: session.terms,
    plannedHours: session.setup?.hours,
    elapsedMs,
  });
}

export function minutesSaved(session) {
  const ahead = sessionPace(session);
  return ahead > 0 ? ahead : 0;
}

// Lifetime flex: minutes this person saved by outrunning the plan, across every set.
// A later copy of the same set replaces the earlier one. Sets with no id still count.
export function minutesCutTotal(sessions) {
  const byId = new Map();
  const loose = [];
  for (const session of sessions || []) {
    if (!session) continue;
    const minutes = minutesSaved(session);
    const id = session.id || '';
    if (id) byId.set(id, minutes);
    else loose.push(minutes);
  }
  let total = 0;
  for (const minutes of byId.values()) total += minutes;
  for (const minutes of loose) total += minutes;
  return total;
}

export function paceCopy(minutes) {
  if (minutes == null) return null;
  if (minutes > 0) {
    const place = `+${formatCount(minutes)} min ahead`;
    return { tone: 'ahead', target: 'Target', place, text: `Target, ${place}` };
  }
  if (minutes < 0) {
    const place = `−${formatCount(Math.abs(minutes))} min behind`;
    return { tone: 'behind', target: 'Target', place, text: `Target, ${place}` };
  }
  return { tone: 'ahead', target: 'Target', place: 'On track', text: 'Target, on track' };
}
