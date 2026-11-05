import test from 'node:test';
import assert from 'node:assert/strict';
import { paceSnapshot } from '../../worker/src/paceSnapshot.js';
import {
  HOME_QUOTES,
  accountHandle,
  formatCount,
  minutesAhead,
  minutesCutTotal,
  minutesSaved,
  paceCopy,
  quoteForDay,
  secondsLeftInDay,
  sessionPace,
  studiedTermCount,
  termWasStudied,
} from './homeBoard.js';

test('seconds left uses the local end of the day', () => {
  assert.equal(secondsLeftInDay(new Date(2026, 10, 3, 23, 0, 0)), 3600);
  assert.equal(secondsLeftInDay(new Date(2026, 10, 3, 0, 0, 0)), 86_400);
});

test('the daily quote stays put until the next local day', () => {
  const quotes = ['one', 'two', 'three'];
  const morning = new Date(2026, 0, 1, 8, 0, 0);
  const night = new Date(2026, 0, 1, 23, 30, 0);
  const next = new Date(2026, 0, 2, 0, 5, 0);
  const now = new Date(2026, 10, 3, 18, 0, 0);
  assert.equal(quoteForDay(morning, quotes, now), quoteForDay(night, quotes, now));
  assert.notEqual(quoteForDay(morning, quotes, now), quoteForDay(next, quotes, now));
  assert.equal(
    quoteForDay(now, HOME_QUOTES, now),
    "There's someone out there working harder than you right now.",
  );
});

test('the handle follows the greeting name, then the email', () => {
  assert.equal(accountHandle('Broderick Harris', { style: 'last' }), 'harris');
  assert.equal(accountHandle('Broderick Harris', { style: 'first' }), 'broderick');
  assert.equal(accountHandle('', { email: 'Sam.Jones@x.com' }), 'samjones');
  assert.equal(accountHandle(''), 'you');
});

test('studied terms count seen work and skip a repeated session', () => {
  assert.equal(termWasStudied({ seen: true }), true);
  assert.equal(termWasStudied({ srs: { introduced: true } }), true);
  assert.equal(termWasStudied({ seen: false }), false);
  const active = {
    id: 'a',
    terms: [{ id: '1', seen: true }, { id: '1', seen: true }, { id: '2', seen: false }],
  };
  const finished = {
    id: 'b',
    terms: [{ id: '1', recallHistory: [{ result: 'got' }] }],
  };
  assert.equal(studiedTermCount([active, finished, active]), 2);
});

test('pace is minutes ahead of the plan', () => {
  const terms = [
    ...Array.from({ length: 16 }, (_, i) => ({ id: `s${i}`, seen: true })),
    ...Array.from({ length: 14 }, (_, i) => ({ id: `w${i}`, seen: false })),
  ];
  assert.equal(minutesAhead({ terms, plannedHours: 1, elapsedMs: 20 * 60 * 1000 }), 12);
  const behind = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, seen: true })),
    ...Array.from({ length: 25 }, (_, i) => ({ id: `w${i}`, seen: false })),
  ];
  assert.equal(minutesAhead({ terms: behind, plannedHours: 1, elapsedMs: 20 * 60 * 1000 }), -10);
  assert.equal(minutesAhead({ terms: [{ id: '1' }], plannedHours: 1, elapsedMs: 0 }), 0);
  assert.equal(minutesAhead({ terms: [{ id: '1', seen: true }], plannedHours: 1, elapsedMs: 0 }), null);
  assert.equal(minutesAhead({ terms, plannedHours: 0, elapsedMs: 20 * 60 * 1000 }), null);
});

test('a finished cram can still show saved minutes from its recall clock', () => {
  const start = Date.parse('2026-11-03T12:00:00');
  const session = {
    setup: { hours: 1 },
    terms: [
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `s${i}`,
        seen: true,
        recallHistory: [{ timestamp: start + i * 1000 }],
      })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `w${i}` })),
    ],
  };
  session.id = 'finished';
  session.terms[0].recallHistory = [{ timestamp: start }];
  session.terms[19].recallHistory = [{ timestamp: start + 20 * 60 * 1000 }];
  const ahead = sessionPace(session);
  assert.equal(ahead, 20);
  assert.equal(minutesSaved(session), 20);
  assert.equal(minutesSaved(paceSnapshot(session)), 20);
  const other = {
    id: 'other',
    setup: { hours: 1 },
    elapsedMs: 20 * 60 * 1000,
    terms: [
      ...Array.from({ length: 16 }, (_, i) => ({ id: `s${i}`, seen: true })),
      ...Array.from({ length: 14 }, (_, i) => ({ id: `w${i}`, seen: false })),
    ],
  };
  const behind = {
    id: 'behind',
    setup: { hours: 1 },
    elapsedMs: 20 * 60 * 1000,
    terms: [
      ...Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, seen: true })),
      ...Array.from({ length: 25 }, (_, i) => ({ id: `w${i}`, seen: false })),
    ],
  };
  assert.equal(minutesCutTotal([session, other, behind, null]), 32);
  assert.equal(minutesCutTotal([other, { ...other, elapsedMs: 10 * 60 * 1000 }]), minutesSaved({ ...other, elapsedMs: 10 * 60 * 1000 }));
  assert.equal(minutesCutTotal([session, paceSnapshot(session)]), 20);
  assert.deepEqual(paceCopy(ahead), { tone: 'ahead', target: 'Target', place: '+20 min ahead', text: 'Target, +20 min ahead' });
  assert.deepEqual(paceCopy(-8), { tone: 'behind', target: 'Target', place: '−8 min behind', text: 'Target, −8 min behind' });
  assert.equal(paceCopy(0).place, 'On track');
  assert.equal(paceCopy(0).target, 'Target');
  assert.equal(formatCount(86400), '86,400');
});
