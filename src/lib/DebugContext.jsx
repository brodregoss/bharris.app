import React from 'react';
import { devToolsUnlocked } from '@/lib/devToolsLock';

// Debug plumbing stays hidden until Settings unlocks it with the dev code.
// After that, Ctrl+Shift+D toggles dev mode and ? toggles the panel.
const DebugContext = React.createContext(null);
const DEV_KEY = 'lms_dev';

function initialEnabled() {
  if (!devToolsUnlocked()) return false;
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
  const [clockAt, setClockAtState] = React.useState(null);
  const clockAtRef = React.useRef(null);
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

  const bumpClock = React.useCallback((ms) => {
    if (!devToolsUnlocked()) return;
    if (Number.isFinite(clockAtRef.current)) {
      clockAtRef.current += ms;
      setClockAtState(clockAtRef.current);
      return;
    }
    setClockOffset((o) => o + ms);
  }, []);
  const setClockAt = React.useCallback((ms) => {
    if (!devToolsUnlocked()) return;
    const next = Number.isFinite(ms) ? ms : null;
    clockAtRef.current = next;
    setClockAtState(next);
    if (next != null) setClockOffset(0);
  }, []);
  const resetClock = React.useCallback(() => {
    if (!devToolsUnlocked()) return;
    clockAtRef.current = null;
    setClockAtState(null);
    setClockOffset(0);
  }, []);
  const reportSession = React.useCallback((p) => setSnapshot((s) => ({ ...s, ...p })), []);
  const reportTerms = React.useCallback((t) => setTermsSnap(t), []);
  const clearEvents = React.useCallback(() => setEvents([]), []);

  // Hidden keyboard shortcuts: Ctrl+Shift+D toggles dev mode, ? toggles panel.
  React.useEffect(() => {
    if (!devToolsUnlocked()) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setEnabled((en) => {
          if (!devToolsUnlocked()) return false;
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

  const setEnabledSafe = React.useCallback((next) => {
    if (!devToolsUnlocked()) {
      setEnabled(false);
      return;
    }
    setEnabled(next);
  }, []);

  const value = {
    enabled: devToolsUnlocked() && enabled,
    setEnabled: setEnabledSafe,
    isOpen,
    setOpen,
    events,
    logEvent,
    clearEvents,
    clockOffset,
    clockAt,
    setClockAt,
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