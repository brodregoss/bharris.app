import React from 'react';

function isComputerNow() {
  return typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function useIsComputer() {
  const [computer, setComputer] = React.useState(isComputerNow);
  React.useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const apply = () => setComputer(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return computer;
}

export function flashcardKeyAction(event, { revealed }) {
  if (!event || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return null;
  const el = event.target;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return null;
  if (event.key === ' ' || event.code === 'Space') return revealed ? null : 'flip';
  if (!revealed) return null;
  if (event.key === 'ArrowLeft') return 'miss';
  if (event.key === 'ArrowRight') return 'know';
  return null;
}

export function useFlashcardShortcuts({ enabled, revealed, onFlip, onMiss, onKnow }) {
  const api = React.useRef({ enabled, revealed, onFlip, onMiss, onKnow });
  api.current = { enabled, revealed, onFlip, onMiss, onKnow };

  React.useEffect(() => {
    const onKey = (event) => {
      const current = api.current;
      if (!current.enabled) return;
      const action = flashcardKeyAction(event, current);
      const isSpace = event.key === ' ' || event.code === 'Space';
      if (!action && !isSpace) return;
      event.preventDefault();
      if (action === 'flip') current.onFlip();
      else if (action === 'miss') current.onMiss();
      else if (action === 'know') current.onKnow();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function ShortcutKey({ children }) {
  return (
    <kbd className="rounded-md border border-current/30 bg-background/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide">
      {children}
    </kbd>
  );
}
