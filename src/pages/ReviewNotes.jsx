import React from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function ReviewNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const source = location.state?.source;
  const setup = location.state?.setup;

  const [items, setItems] = React.useState(() => {
    if (!source?.items?.length) return [];
    return source.items.map((t, i) => ({
      id: t.id || `r${i}`,
      term: t.term || '',
      definition: t.definition || '',
      difficulty: t.difficulty,
      depends_on: t.depends_on,
    }));
  });

  if (!source) {
    return <Navigate to="/welcome" replace />;
  }

  const update = (id, patch) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const filled = items.filter((t) => t.term.trim() && t.definition.trim());

  const saveAndBack = () => {
    const nextItems = filled.map((t, i) => ({
      id: t.id || `r${i}`,
      term: t.term.trim(),
      definition: t.definition.trim(),
      difficulty: t.difficulty,
      depends_on: t.depends_on,
    }));
    navigate('/setup', {
      state: {
        setup,
        source: {
          ...source,
          terms: nextItems.length || source.terms,
          items: nextItems.length ? nextItems : source.items,
        },
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-foreground flex flex-col">
      <header className="px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={saveAndBack}
          aria-label="Back"
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight leading-none truncate">
            {source.title || 'Your notes'}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">
            {items.length} term{items.length === 1 ? '' : 's'} — tap a card to edit
          </p>
        </div>
      </header>

      <main className="flex-1 px-6 pt-4 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-3 pb-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No terms to look over yet. Terms will be extracted after you start.
            </p>
          ) : (
            items.map((item, i) => (
              <div key={item.id} className="rounded-2xl border border-border bg-white p-4 space-y-3 shadow-sm">
                <span className="text-xs font-medium text-muted-foreground">Term {i + 1}</span>
                <Input
                  value={item.term}
                  onChange={(e) => update(item.id, { term: e.target.value })}
                  placeholder="Term"
                  className="h-11 rounded-xl font-semibold"
                />
                <Textarea
                  value={item.definition}
                  onChange={(e) => update(item.id, { definition: e.target.value })}
                  placeholder="Definition"
                  className="min-h-[88px] rounded-xl"
                />
              </div>
            ))
          )}
        </div>
      </main>

      <footer className="px-6 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto w-full">
          <Button
            size="lg"
            onClick={saveAndBack}
            className="w-full h-14 rounded-2xl text-base font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20"
          >
            <Check className="w-5 h-5 mr-2" />
            Done
          </Button>
        </div>
      </footer>
    </div>
  );
}
