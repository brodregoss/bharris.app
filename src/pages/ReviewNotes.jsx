import React from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function ReviewNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const source = location.state?.source;
  const setup = location.state?.setup;
  const scrollerRef = React.useRef(null);
  const [index, setIndex] = React.useState(0);

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

  const goTo = (i) => {
    const next = Math.max(0, Math.min(items.length - 1, i));
    setIndex(next);
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.children[next];
    if (card) card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el || !items.length) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index && i >= 0 && i < items.length) setIndex(i);
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
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold tracking-tight leading-none truncate">
            {source.title || 'Your notes'}
          </h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">
            {items.length
              ? `Card ${index + 1} of ${items.length} — edit if you want`
              : 'No terms to look over yet'}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <main className="flex-1 flex items-center justify-center px-8">
          <p className="text-sm text-muted-foreground text-center">
            No terms to look over yet. Terms will be extracted after you start.
          </p>
        </main>
      ) : (
        <main className="flex-1 flex flex-col min-h-0">
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="flex-1 min-h-0 flex flex-nowrap overflow-x-auto snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {items.map((item, i) => (
              <section
                key={item.id}
                className="min-w-full h-full snap-center px-5 py-3 flex"
              >
                <div className="w-full max-w-md mx-auto rounded-3xl border border-slate-200 bg-white shadow-lg p-5 flex flex-col gap-4">
                  <p className="text-xs font-medium text-muted-foreground">Term {i + 1}</p>
                  <Input
                    value={item.term}
                    onChange={(e) => update(item.id, { term: e.target.value })}
                    placeholder="Term"
                    className="h-12 rounded-xl text-lg font-semibold"
                  />
                  <Textarea
                    value={item.definition}
                    onChange={(e) => update(item.id, { definition: e.target.value })}
                    placeholder="Definition"
                    className="flex-1 min-h-[10rem] rounded-xl text-base leading-relaxed"
                  />
                </div>
              </section>
            ))}
          </div>

          <div className="px-5 pb-2 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index <= 0}
              aria-label="Previous card"
              className={cn(
                'w-11 h-11 rounded-full border bg-white flex items-center justify-center shadow-sm',
                index <= 0 ? 'text-muted-foreground/40' : 'text-slate-800 hover:bg-slate-50'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 max-w-[40vw] overflow-hidden">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to card ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-5 bg-slate-900' : 'w-1.5 bg-slate-300'
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index >= items.length - 1}
              aria-label="Next card"
              className={cn(
                'w-11 h-11 rounded-full border bg-white flex items-center justify-center shadow-sm',
                index >= items.length - 1 ? 'text-muted-foreground/40' : 'text-slate-800 hover:bg-slate-50'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </main>
      )}

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
