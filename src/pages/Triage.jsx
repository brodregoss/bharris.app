import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tierFromDifficulty, confidenceFromTriage, normalizeExamType } from '@/lib/studyUtils';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Loader2, Sparkles, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import TriageCard from '@/components/triage/TriageCard';

const TIERS = [
  { id: 'blank', label: 'Blank', sub: "Don't know", bg: '#FF8A8A' },
  { id: 'shaky', label: 'Shaky', sub: 'Kind of know', bg: '#FFC078' },
  { id: 'know_it', label: 'Know it', sub: 'Know it', bg: '#8CE99A' },
];

const MAX_TERMS = 15;

function rankTerms(terms) {
  // dependencyScore: how many other terms depend on this one (foundational)
  const depCount = {};
  terms.forEach((t) => { depCount[t.term] = 0; });
  terms.forEach((t) => {
    (t.depends_on || []).forEach((d) => {
      if (depCount[d] !== undefined) depCount[d] += 1;
    });
  });
  const maxDiff = Math.max(...terms.map((t) => t.difficulty || 1), 1);
  const maxDep = Math.max(...Object.values(depCount), 1);

  const scored = terms.map((t) => {
    const diffNorm = (t.difficulty || 1) / maxDiff;
    const depNorm = (depCount[t.term] || 0) / maxDep;
    // higher priority = harder + more foundational = needs learning first = blank
    const priority = diffNorm * 0.6 + depNorm * 1.2;
    return { ...t, _priority: priority };
  });

  const sorted = [...scored].sort((a, b) => b._priority - a._priority);
  const n = sorted.length;
  const blankEnd = Math.max(1, Math.round(n * 0.35));
  const shakyEnd = blankEnd + Math.max(1, Math.round(n * 0.35));

  return sorted.map((t, i) => ({
    ...t,
    tier: i < blankEnd ? 'blank' : i < shakyEnd ? 'shaky' : 'know_it',
  }));
}

function Triage() {
  const location = useLocation();
  const navigate = useNavigate();
  const source = location.state?.source;
  const setup = location.state?.setup;
  const sourceTitle = source?.title || 'Intro Psychology';
  const canned = Array.isArray(source?.items) ? source.items : null;

  const lockIn = () => {
    const studyTerms = ranked.map((t) => ({
      id: t.id,
      term: t.term,
      definition: t.definition,
      difficulty: t.difficulty,
      tier: tierFromDifficulty(t.difficulty, normalizeExamType(setup?.examType)),
      confidence: confidenceFromTriage(t.tier),
      depends_on: t.depends_on || [],
    }));
    navigate('/study', { state: { terms: studyTerms, setup } });
  };

  const [loading, setLoading] = React.useState(!canned?.length);
  const [ranked, setRanked] = React.useState(() => {
    if (!canned?.length) return [];
    return rankTerms(
      canned.map((t, i) => ({
        ...t,
        id: `t${i}`,
        depends_on: t.depends_on || [],
      }))
    );
  });
  const [animating, setAnimating] = React.useState(true);

  // Rank canned sample decks locally; otherwise AI extracts terms from the source.
  React.useEffect(() => {
    let mounted = true;
    const finish = (raw) => {
      if (!mounted) return;
      const withIds = raw.map((t, i) => ({
        ...t,
        id: `t${i}`,
        depends_on: t.depends_on || [],
      }));
      const next = rankTerms(withIds);
      setRanked(next);
      setLoading(false);
      const total = next.length * 0.06 + 0.6;
      setTimeout(() => mounted && setAnimating(false), total * 1000);
    };

    if (canned?.length) {
      const total = ranked.length * 0.06 + 0.6;
      setTimeout(() => mounted && setAnimating(false), total * 1000);
      return () => { mounted = false; };
    }

    (async () => {
      const count = Math.min(source?.terms || 12, MAX_TERMS);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are building a last-minute study triage for a student about to cram "${sourceTitle}". Generate exactly ${count} key terms/concepts a student must know for this exam. For each term provide: term (short name), definition (one concise sentence), difficulty (integer 1-10, 10 = hardest), depends_on (array of OTHER term names from your list that this concept builds upon; foundational concepts others rely on should have empty or few dependencies, advanced concepts should reference foundational ones). Include a healthy mix of foundational and advanced concepts. Return exactly ${count} terms.`,
        response_json_schema: {
          type: 'object',
          properties: {
            terms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  term: { type: 'string' },
                  definition: { type: 'string' },
                  difficulty: { type: 'number' },
                  depends_on: { type: 'array', items: { type: 'string' } },
                },
                required: ['term', 'definition', 'difficulty', 'depends_on'],
              },
            },
          },
          required: ['terms'],
        },
      });
      if (!mounted) return;
      const raw = (res.terms || res.output?.terms || res || []).slice(0, count);
      finish(raw);
    })();
    return () => { mounted = false; };
  }, []);

  const moveAllToBlank = () => {
    setRanked((prev) => prev.map((t) => ({ ...t, tier: 'blank' })));
  };

  const onDragEnd = (result) => {
    const { destination, source: src, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === src.droppableId && destination.index === src.index) return;
    setRanked((prev) => {
      const item = prev.find((t) => t.id === draggableId);
      if (!item) return prev;
      return prev.map((t) => (t.id === draggableId ? { ...t, tier: destination.droppableId } : t));
    });
  };

  const termCount = ranked.length;
  const totalDone = ranked.filter((t) => t.tier === 'know_it').length;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="px-6 pt-safe pb-2 flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground">
          <Moon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold tracking-tight leading-none">Last Minute Study</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">Triage — {sourceTitle}</p>
        </div>
        {!loading && (
          <span className="text-xs font-medium text-muted-foreground">{totalDone}/{termCount} ready</span>
        )}
      </header>

      {/* Loading */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-sm font-medium">Analyzing your notes…</p>
          <p className="text-xs text-muted-foreground max-w-xs">Extracting terms and ranking by difficulty and concept relationships.</p>
        </div>
      ) : (
        <>
          {/* Subtitle */}
          <div className="px-6 pb-2">
            <h2 className="text-lg font-bold tracking-tight">Triage your terms</h2>
            <p className="text-xs text-muted-foreground">
              {canned?.length
                ? 'Ranked by difficulty — drag any card to move it between tiers.'
                : 'AI ranked them — drag any card to move it between tiers.'}
            </p>
          </div>

          {/* Board */}
          <main className="flex-1 px-3 pb-4 flex flex-row gap-2 overflow-hidden">
            <DragDropContext onDragEnd={onDragEnd}>
              {TIERS.map((tier) => {
                const items = ranked.filter((t) => t.tier === tier.id);
                return (
                  <div key={tier.id} className="flex-1 basis-0 min-w-0 flex flex-col overflow-hidden">
                    <div
                      style={{ background: tier.bg }}
                      className="rounded-t-lg px-3 py-2 flex items-center justify-between"
                    >
                      <span className="font-bold text-black text-sm leading-none">{tier.label}</span>
                      <span className="text-[10px] text-black/60 leading-none">{items.length}</span>
                    </div>
                    <Droppable droppableId={tier.id} direction="vertical">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="flex-1 min-h-0 overflow-y-auto bg-muted p-2 flex flex-col gap-2"
                        >
                          {items.map((item, idx) => (
                            <TriageCard
                              key={item.id}
                              item={item}
                              tier={tier.id}
                              index={idx}
                              animationDelay={idx * 0.06}
                            />
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                    {tier.id === 'blank' && (
                      <div className="bg-muted px-2 pb-2 shrink-0 rounded-b-lg">
                        <button
                          type="button"
                          onClick={moveAllToBlank}
                          disabled={ranked.length > 0 && ranked.every((t) => t.tier === 'blank')}
                          className="w-full rounded-lg border border-rose-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:pointer-events-none"
                        >
                          Move all
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </DragDropContext>
          </main>

          {/* Footer */}
          <footer className="px-6 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="max-w-md mx-auto w-full">
              <Button
                onClick={lockIn}
                className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Lock in triage
              </Button>
            </div>
          </footer>
        </>
      )}

      {/* Ranking toast */}
      <AnimatePresence>
        {animating && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          >
            <div className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-medium px-4 py-2.5 rounded-full shadow-lg">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              {canned?.length
                ? 'Ranked by difficulty and card relations'
                : 'AI ranking based on difficulty and card relations'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default Triage;