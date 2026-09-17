import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Check, X, ArrowRight } from 'lucide-react';
import { bumpFromPractice, sortForPractice } from '@/lib/mastery';
import { flashcardDef } from '@/lib/studyUtils';
import WriteOwnDef, {
  STUCK_AFTER_ROTATIONS,
  cardsAtStuckThreshold,
  writtenDefsFrom,
} from '@/components/study/WriteOwnDef';

export default function PracticeFlashcards({ terms, onUpdateTerm, onDone }) {
  const byId = React.useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const [items, setItems] = React.useState(() => sortForPractice(terms).map((t) => t.id));
  const [pos, setPos] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [misses, setMisses] = React.useState({});
  const [stuck, setStuck] = React.useState(null);
  const [defMode, setDefMode] = React.useState(false);
  const [skipped, setSkipped] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const deferredRef = React.useRef(new Set());
  const writtenRef = React.useRef(new Set());
  const stuckHistoryRef = React.useRef(new Set());
  const penalizedRef = React.useRef({});

  const current = byId[items[pos]];
  const defCards = items.length
    ? cardsAtStuckThreshold(items, byId, misses, new Set())
    : terms.filter((t) => stuckHistoryRef.current.has(t.id) && !writtenRef.current.has(t.id));

  React.useEffect(() => {
    setRevealed(false);
  }, [pos, items]);

  React.useEffect(() => {
    if (!stuck && !defMode && !current && items.length === 0) setFinished(true);
  }, [stuck, defMode, current, items.length]);

  React.useLayoutEffect(() => {
    if (stuck || defMode || finished || !current) return;
    if (deferredRef.current.has(current.id)) return;
    if ((misses[current.id] || 0) < STUCK_AFTER_ROTATIONS) return;
    const batch = cardsAtStuckThreshold(items, byId, misses, deferredRef.current);
    if (batch.length) setStuck(batch);
  }, [current, items, misses, stuck, defMode, finished, byId]);

  const bump = (id, correct) => {
    const t = byId[id];
    if (!t) return;
    onUpdateTerm(id, { mastery: bumpFromPractice(t.mastery, { correct }) });
  };

  const retireIds = (ids, defs = {}) => {
    const drop = new Set(ids);
    ids.forEach((id) => {
      const t = byId[id];
      const patch = {};
      if (t) patch.mastery = bumpFromPractice(t.mastery, { correct: true });
      if (defs[id]) patch.ownDefinition = defs[id];
      if (Object.keys(patch).length) onUpdateTerm(id, patch);
      deferredRef.current.delete(id);
      writtenRef.current.add(id);
    });
    setMisses((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = 0;
      });
      return next;
    });
    setItems((prev) => prev.filter((x) => !drop.has(x)));
    setPos((p) => {
      const nextLen = items.filter((id) => !drop.has(id)).length;
      if (nextLen <= 0) return 0;
      const removedBefore = items.slice(0, p).filter((id) => drop.has(id)).length;
      const nextPos = p - removedBefore;
      return nextPos >= nextLen ? 0 : nextPos;
    });
    setRevealed(false);
  };

  const rotateMiss = (id) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      const at = next.indexOf(id);
      const from = at >= 0 ? at : pos;
      const [item] = next.splice(from, 1);
      next.push(item);
      return next;
    });
    setPos((p) => {
      if (items.length <= 1) return 0;
      return p >= items.length - 1 ? 0 : p;
    });
    setRevealed(false);
  };

  const onMiss = () => {
    if (!current) return;
    const id = current.id;
    if (!penalizedRef.current[id]) {
      penalizedRef.current[id] = true;
      bump(id, false);
    }
    const n = (misses[id] || 0) + 1;
    if (n >= STUCK_AFTER_ROTATIONS) stuckHistoryRef.current.add(id);
    setMisses((prev) => ({ ...prev, [id]: n }));
    rotateMiss(id);
  };

  const writeCards = stuck?.length ? stuck : defMode ? defCards : [];
  const writeFlow = writeCards.length > 0 && (stuck || defMode) ? (
    <div className="flex-1 flex flex-col">
      <WriteOwnDef
        cards={writeCards}
        allTerms={defMode ? terms : undefined}
        variant={defMode ? 'defMode' : 'stuck'}
        onComplete={(entries) => {
          const { ids, defs } = writtenDefsFrom(entries);
          retireIds(ids.length ? ids : writeCards.map((c) => c.id), defs);
          setStuck(null);
          setDefMode(false);
        }}
        onSkip={
          defMode
            ? () => setDefMode(false)
            : () => {
                (stuck || []).forEach((c) => deferredRef.current.add(c.id));
                setSkipped(true);
                setStuck(null);
              }
        }
      />
    </div>
  ) : null;

  if (writeFlow) return writeFlow;

  const defModeButton = defCards.length > 0 && (skipped || items.length === 0) && (
    <button
      type="button"
      onClick={() => setDefMode(true)}
      className="mt-3 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
    >
      Def mode · {defCards.length}
    </button>
  );

  if (finished || items.length === 0) {
    return (
      <div className="flex-1 flex flex-col px-5 pt-6">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col items-center text-center pt-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Flashcards done</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Got-it cards moved up. Misses stay in the work-on pile. Mastered still has to be earned in Explain it.
          </p>
          {defModeButton}
          <Button
            onClick={onDone}
            className="w-full h-12 rounded-2xl font-semibold mt-4"
          >
            Back to practice
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Wrapping up…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <p className="text-xs text-muted-foreground mb-3">
        Flashcards · {pos + 1}/{items.length}
      </p>
      <div className="flex-1 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm text-center min-h-[260px] flex flex-col items-center justify-center"
        >
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">
            {revealed ? 'Definition' : 'Term'}
          </p>
          <p className="text-3xl font-bold tracking-tight">{current.term}</p>
          {revealed ? (
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{flashcardDef(current)}</p>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">Tap the card to flip it.</p>
          )}
        </button>

        <div className="w-full max-w-md mt-4">
          {!revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              className="w-full h-12 rounded-2xl font-semibold"
            >
              <Eye className="w-4 h-4 mr-2" /> Flip card
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={onMiss}
                variant="destructive"
                className="h-12 rounded-2xl font-semibold"
              >
                <X className="w-4 h-4 mr-2" /> Needs work
              </Button>
              <Button
                onClick={() => retireIds([current.id])}
                variant="success"
                className="h-12 rounded-2xl font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Got it
              </Button>
            </div>
          )}
        </div>
        {defModeButton}
      </div>
    </div>
  );
}
