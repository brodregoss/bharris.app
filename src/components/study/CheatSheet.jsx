import React from 'react';
import { X } from 'lucide-react';
import TermDefList from './TermDefList';

export default function CheatSheet({ terms, open, onClose, rankMode }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col px-safe">
      <header className="sticky top-0 z-20 bg-background px-4 pt-safe pb-2 flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cheat sheet"
          className="flex items-center justify-center w-11 h-11 -ml-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight leading-none">Cheat sheet</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">All terms and definitions</p>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-5 pt-3 pb-safe">
        <div className="max-w-md mx-auto w-full pb-8">
          <TermDefList terms={terms} rankMode={rankMode} />
        </div>
      </main>
    </div>
  );
}
