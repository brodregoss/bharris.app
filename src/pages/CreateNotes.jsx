import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function blankTerm() {
  return { id: `m${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, term: '', definition: '' };
}

export default function CreateNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state?.source;
  const [items, setItems] = React.useState(() => {
    if (incoming?.kind === 'manual' && incoming.items?.length) {
      return incoming.items.map((t, i) => ({
        id: t.id || `m${i}`,
        term: t.term || '',
        definition: t.definition || '',
      }));
    }
    return [blankTerm()];
  });

  const filled = items.filter((t) => t.term.trim() && t.definition.trim());
  const canContinue = filled.length > 0;

  const update = (id, patch) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const remove = (id) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)));
  };

  const continueSetup = () => {
    if (!canContinue) return;
    navigate('/setup', {
      state: {
        source: {
          kind: 'manual',
          title: 'My notes',
          terms: filled.length,
          items: filled.map((t, i) => ({
            id: t.id || `m${i}`,
            term: t.term.trim(),
            definition: t.definition.trim(),
          })),
        },
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-3 pt-safe pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate('/welcome')}
          aria-label="Back"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none">Create terms</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">Add the terms you need to know</p>
        </div>
      </header>

      <main className="flex-1 px-6 pt-4 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-3 pb-4">
          {items.map((item, i) => (
            <div key={item.id} className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Term {i + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label="Remove term"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Input
                value={item.term}
                onChange={(e) => update(item.id, { term: e.target.value })}
                placeholder="Term"
                className="h-11 rounded-xl"
              />
              <Textarea
                value={item.definition}
                onChange={(e) => update(item.id, { definition: e.target.value })}
                placeholder="Definition"
                className="min-h-[72px] rounded-xl"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, blankTerm()])}
            className="w-full h-11 rounded-2xl border border-dashed border-border bg-card text-sm font-medium text-foreground hover:border-muted-foreground flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add term
          </button>
        </div>
      </main>

      <footer className="px-6 pt-2 pb-safe">
        <div className="max-w-md mx-auto w-full">
          <Button
            size="lg"
            disabled={!canContinue}
            onClick={continueSetup}
            className={cn(
              'w-full h-14 rounded-2xl text-base font-semibold transition-all',
              canContinue
                ? 'shadow-lg'
                : 'bg-muted text-muted-foreground'
            )}
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
