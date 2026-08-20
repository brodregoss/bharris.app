import React from 'react';

// Dev-only debug plumbing: a hidden mode (URL ?dev or Ctrl+Shift+D), a slide-out
// panel toggle (? key), a live session/terms snapshot, a timestamped event
// log, and a clock offset used to fast-forward time-based logic for testing.
const DebugContext = React.createContext(null);
const DEV_KEY = 'lms_dev';

function initialEnabled() {
  try {
    if (new URLSearchParams(window.location.search).has('dev')) {
      localStorage.setItem(DEV_KEY, '1');
      return true;
    }
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
}

export function DebugProvider({ children }) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [isOpen, setOpen] = React.useState(false);
  const [events, setEvents] = React.useState([]);
  const [clockOffset, setClockOffset] = React.useState(0);
  const [snapshot, setSnapshot] = React.useState({});
  const [termsSnap, setTermsSnap] = React.useState([]);

  const enabledRef = React.useRef(enabled);
  React.useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // No-op when dev mode is off, so production never churns context consumers.
  const logEvent = React.useCallback(
    (message, data) => {
      if (!enabled) return;
      setEvents((prev) =>
        [
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), message, data },
          ...prev,
        ].slice(0, 300)
      );
    },
    [enabled]
  );

  const bumpClock = React.useCallback((ms) => setClockOffset((o) => o + ms), []);
  const resetClock = React.useCallback(() => setClockOffset(0), []);
  const reportSession = React.useCallback((p) => setSnapshot((s) => ({ ...s, ...p })), []);
  const reportTerms = React.useCallback((t) => setTermsSnap(t), []);
  const clearEvents = React.useCallback(() => setEvents([]), []);

  // Hidden keyboard shortcuts: Ctrl+Shift+D toggles dev mode, ? toggles panel.
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setEnabled((en) => {
          const next = !en;
          try {
            localStorage.setItem(DEV_KEY, next ? '1' : '0');
          } catch {
            // ignore
          }
          if (next) setOpen(true);
          return next;
        });
        return;
      }
      if (e.key === '?' && enabledRef.current) {
        const t = e.target;
        const tag = t && t.tagName;
        const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable);
        if (typing) return;
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = {
    enabled,
    setEnabled,
    isOpen,
    setOpen,
    events,
    logEvent,
    clearEvents,
    clockOffset,
    bumpClock,
    resetClock,
    snapshot,
    reportSession,
    termsSnap,
    reportTerms,
  };

  return <DebugContext.Provider value={value}>{children}</DebugContext.Provider>;
}

export function useDebug() {
  return React.useContext(DebugContext);
}