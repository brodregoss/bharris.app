import React from 'react';
import { motion } from 'framer-motion';
import { Bug, X, RotateCcw, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebug } from '@/lib/DebugContext';
import { priority } from '@/lib/studyUtils';
import FlowChart from './FlowChart';
import AppFlowChart from './AppFlowChart';
import AutoAnswerButton from './AutoAnswerButton';

function fmtMs(ms) {
  if (ms == null) return '—';
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

function fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

const SESSION_ROWS = [
  { key: 'studyMode', label: 'Study mode' },
  { key: 'currentStep', label: 'Current step' },
  { key: 'examType', label: 'Exam type' },
  { key: 'examTiming', label: 'Exam timing' },
  { key: 'hoursAvailable', label: 'Hours available' },
  { key: 'readinessScore', label: 'Readiness', suffix: '%' },
  { key: 'stopTime', label: 'Stop time' },
];

const TERM_COLS = [
  ['term', 'Term'],
  ['tier', 'Tier'],
  ['confidence', 'Conf'],
  ['priority', 'Pri'],
  ['correctStreak', 'Streak'],
];

export default function DebugPanel() {
  const dbg = useDebug();
  const [sortKey, setSortKey] = React.useState('tier');
  const [sortDir, setSortDir] = React.useState('asc');

  const sortedTerms = React.useMemo(() => {
    const arr = [...(dbg?.termsSnap || [])];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'priority':
          av = priority(a);
          bv = priority(b);
          break;
        case 'correctStreak':
          av = a.correctStreak || 0;
          bv = b.correctStreak || 0;
          break;
        case 'confidence':
          av = a.confidence || '';
          bv = b.confidence || '';
          break;
        case 'tier':
        default:
          av = a.tier || '';
          bv = b.tier || '';
          break;
      }
      if (typeof av === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [dbg?.termsSnap, sortKey, sortDir]);

  if (!dbg) return null;

  const { enabled, setEnabled, isOpen, setOpen, snapshot, events, clockOffset, bumpClock, resetClock, clearEvents } = dbg;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <>
      {/* Floating dev tools — always visible */}
      {!isOpen && (
        <div className="fixed z-[9998] bottom-safe-float right-safe flex items-center gap-2">
          <AutoAnswerButton />
          <button
            type="button"
            onClick={() => {
              if (!enabled) setEnabled(true);
              setOpen(true);
            }}
            className="w-10 h-10 rounded-full bg-slate-900 text-white shadow-lg flex items-center justify-center opacity-40 hover:opacity-100 transition"
            title="Open debug panel"
          >
            <Pencil className="w-5 h-5" />
          </button>
        </div>
      )}

      {isOpen && enabled && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[9998] bg-black/20"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed z-[9999] top-0 right-0 flex h-[100dvh] w-[min(420px,100vw)] flex-col border-l border-slate-200 bg-white shadow-2xl pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[max(0px,calc(env(safe-area-inset-left)-max(0px,100vw-min(420px,100vw))))]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Bug className="w-4 h-4" />
                <span className="text-sm font-bold">Dev Debug</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
              {/* Flow chart */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Session flow</h3>
                <div className="rounded-xl border border-slate-200 p-3">
                  <FlowChart currentStep={snapshot.currentStep} />
                </div>
                {/* Full app decision tree */}
                <details className="mt-2">
                  <summary className="text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                    App flow (decision tree)
                  </summary>
                  <div className="mt-2 rounded-xl border border-slate-200 p-3">
                    <AppFlowChart />
                  </div>
                </details>
                {/* Compact metrics strip */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SESSION_ROWS.filter((r) => r.key !== 'currentStep').map((r) => (
                    <div key={r.key} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                      <p className="text-[10px] text-slate-400">{r.label}</p>
                      <p className="text-xs font-medium text-slate-800 tabular-nums truncate">
                        {snapshot[r.key] == null || snapshot[r.key] === ''
                          ? '—'
                          : `${snapshot[r.key]}${r.suffix || ''}`}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <p className="text-[10px] text-slate-400">Time spent</p>
                    <p className="text-xs font-medium text-slate-800 tabular-nums">{fmtMs(snapshot.timeSpentMs)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <p className="text-[10px] text-slate-400">Clock offset</p>
                    <p className="text-xs font-medium text-slate-800 tabular-nums">{fmtMs(clockOffset)}</p>
                  </div>
                </div>
              </section>

              {/* Time controls */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Dev time controls</h3>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => bumpClock(15 * 60 * 1000)}>
                    +15 min
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bumpClock(60 * 60 * 1000)}>
                    +1 hr
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bumpClock(8 * 60 * 60 * 1000)}>
                    +8 hr
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => bumpClock(-15 * 60 * 1000)}>
                    −15 min
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetClock}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Fast-forwards the session clock to skip Spaced Cram sitting waits, budget trimming, and sleep stop-time.
                </p>
              </section>

              {/* Event log */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Event log</h3>
                  <button
                    type="button"
                    onClick={clearEvents}
                    className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 max-h-52 overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="text-xs text-slate-400 px-3 py-3">No events yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {events.map((ev) => (
                        <li key={ev.id} className="px-3 py-1.5 text-xs">
                          <span className="text-slate-400 tabular-nums mr-2">{fmtTs(ev.ts)}</span>
                          <span className="text-slate-800">{ev.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Terms table */}
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                  Terms ({dbg.termsSnap?.length || 0})
                </h3>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          {TERM_COLS.map(([key, label]) => (
                            <th
                              key={key}
                              onClick={() => toggleSort(key)}
                              className="px-2 py-1.5 text-left font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap"
                            >
                              {label}
                              {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedTerms.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="px-2 py-1.5 font-medium text-slate-900 max-w-[120px] truncate">
                              {t.term}
                            </td>
                            <td className="px-2 py-1.5 text-slate-600">{t.tier}</td>
                            <td className="px-2 py-1.5 text-slate-600">{t.confidence}</td>
                            <td className="px-2 py-1.5 text-slate-600 tabular-nums">{priority(t).toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-slate-600 tabular-nums">{t.correctStreak || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="text-[11px] text-slate-500 cursor-pointer">Recall history (per term)</summary>
                  <div className="mt-1 max-h-48 overflow-auto rounded border border-slate-200">
                    <ul className="text-[11px] divide-y divide-slate-100">
                      {sortedTerms.map((t) => (
                        <li key={t.id} className="px-2 py-1">
                          <span className="font-medium">{t.term}:</span>{' '}
                          <span className="text-slate-500">
                            {(t.recallHistory || []).length
                              ? (t.recallHistory || []).map((h) => h.result).join(', ')
                              : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </section>
            </div>

            <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-400">
              Toggle panel: ? · Dev mode: Ctrl+Shift+D
            </div>
          </motion.aside>
        </>
      )}
    </>
  );
}