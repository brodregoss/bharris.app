import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { flashcardDef } from '@/lib/studyUtils';
import WriteOwnDef, {
  STUCK_AFTER_ROTATIONS,
  cardsAtStuckThreshold,
  writtenReviewPlan,
} from '@/components/study/WriteOwnDef';
import { ShortcutKey, useFlashcardShortcuts, useIsComputer } from '@/components/study/flashcardKeys';
import FlashCardStage from '@/components/study/FlashCardStage';
import { cardProgressCaption } from '@/components/study/CardProgress';

const COLUMNS = [
  { id: 'blank', label: 'Blank', sub: "Don't know" },
  { id: 'shaky', label: 'Shaky', sub: 'Kind of know' },
  { id: 'know', label: 'Know it', sub: 'Know it' },
];

function termsInColumn(terms, column) {
  return terms.filter((t) => (t.confidence || 'blank') === column);
}

function TypeGuide({ definition, value, onChange, inputRef }) {
  const guide = definition || ' ';
  return (
    <div className="relative rounded-2xl border border-border bg-card">
      <p className="invisible whitespace-pre-wrap break-words px-4 py-3 text-base leading-relaxed">
        {guide}
      </p>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-4 py-3 text-base leading-relaxed text-muted-foreground/35"
      >
        {guide}
      </div>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="absolute inset-0 resize-none overflow-hidden bg-transparent px-4 py-3 text-base leading-relaxed text-foreground caret-foreground outline-none"
      />
    </div>
  );
}

function Picker({ terms, selected, setSelected, onStart, onBack, startLabel }) {
  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mb-3"
        >
          Back to skim
        </button>
        <h2 className="text-xl font-bold tracking-tight mb-1">Which terms?</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Pick a triage column, or tap individual cards.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {COLUMNS.map((col) => {
            const ids = termsInColumn(terms, col.id).map((t) => t.id);
            const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
            return (
              <button
                key={col.id}
                type="button"
                disabled={!ids.length}
                onClick={() => setSelected(new Set(ids))}
                className={cn(
                  'rounded-xl border px-2 py-3 text-center transition disabled:opacity-40',
                  allOn ? 'border-foreground bg-card' : 'border-border bg-muted/40',
                )}
              >
                <p className="text-sm font-semibold">{col.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{ids.length}</p>
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {terms.map((t) => {
            const on = selected.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={cn(
                  'w-full text-left rounded-xl border p-3 transition',
                  on ? 'border-foreground bg-card' : 'border-border bg-muted/30',
                )}
              >
                <p className="text-sm font-semibold">{t.term}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.definition}</p>
              </button>
            );
          })}
        </div>
        <Button
          disabled={!selected.size}
          onClick={onStart}
          className="w-full h-12 rounded-2xl font-semibold"
        >
          {startLabel} · {selected.size}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function FlashRound({ queue, byId, allTerms, onUpdateTerm, onDone, onBack }) {
  const computer = useIsComputer();
  const [items, setItems] = React.useState(queue);
  const deckTotalRef = React.useRef(queue.length);
  const [retired, setRetired] = React.useState(0);
  const [pos, setPos] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [misses, setMisses] = React.useState({});
  const [stuck, setStuck] = React.useState(null);
  const [defMode, setDefMode] = React.useState(false);
  const [skipped, setSkipped] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const deferredRef = React.useRef(new Set());
  const writtenRef = React.useRef(new Set());
  const leftoverRef = React.useRef(null);
  const stuckHistoryRef = React.useRef(new Set());
  const current = byId[items[pos]];
  const pool = allTerms || Object.values(byId);
  const defCards = items.length
    ? cardsAtStuckThreshold(items, byId, misses, writtenRef.current)
    : pool.filter((t) => stuckHistoryRef.current.has(t.id) && !writtenRef.current.has(t.id) && !String(t.ownDefinition || '').trim());

  React.useEffect(() => {
    setRevealed(false);
  }, [pos, items]);

  React.useEffect(() => {
    if (stuck || defMode) return;
    if (items.length > 0) return;
    if (!leftoverRef.current?.length) return;
    const rest = leftoverRef.current;
    leftoverRef.current = null;
    setReviewing(false);
    setItems(rest);
    setPos(0);
  }, [stuck, defMode, items.length]);

  React.useLayoutEffect(() => {
    if (stuck || defMode || !current) return;
    if (deferredRef.current.has(current.id) || writtenRef.current.has(current.id)) return;
    if (String(current.ownDefinition || '').trim()) return;
    if ((misses[current.id] || 0) < STUCK_AFTER_ROTATIONS) return;
    const skip = new Set([...deferredRef.current, ...writtenRef.current]);
    const batch = cardsAtStuckThreshold(items, byId, misses, skip);
    if (batch.length) setStuck(batch);
  }, [current, items, misses, stuck, defMode, byId]);

  const retireIds = (ids, defs = {}) => {
    const drop = new Set(ids);
    ids.forEach((id) => {
      writtenRef.current.add(id);
      deferredRef.current.delete(id);
      const patch = { seen: true };
      if (defs[id]) patch.ownDefinition = defs[id];
      onUpdateTerm(id, patch);
    });
    setMisses((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = 0;
      });
      return next;
    });
    setRetired((n) => n + ids.length);
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

  const startWrittenReview = (entries, fallbackCards) => {
    const { ids, defs, leftover } = writtenReviewPlan(entries, fallbackCards, items);
    if (!ids.length) {
      setStuck(null);
      setDefMode(false);
      return;
    }
    ids.forEach((id) => {
      const patch = { seen: true };
      if (defs[id]) patch.ownDefinition = defs[id];
      onUpdateTerm(id, patch);
      writtenRef.current.add(id);
      deferredRef.current.delete(id);
    });
    leftoverRef.current = leftover;
    setMisses((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = 0;
      });
      return next;
    });
    setReviewing(true);
    setItems(ids);
    setPos(0);
    setRevealed(false);
    setStuck(null);
    setDefMode(false);
  };

  const rotateMiss = (id) => {
    if (!id) return;
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
    onUpdateTerm(id, { seen: true });
  };

  const onMiss = () => {
    if (!current) return;
    const id = current.id;
    const n = (misses[id] || 0) + 1;
    if (n >= STUCK_AFTER_ROTATIONS) stuckHistoryRef.current.add(id);
    setMisses((prev) => ({ ...prev, [id]: n }));
    rotateMiss(id);
  };

  const onCard = !stuck && !defMode && items.length > 0 && !!current;
  useFlashcardShortcuts({
    enabled: onCard,
    revealed,
    onFlip: () => setRevealed(true),
    onMiss,
    onKnow: () => {
      if (current) retireIds([current.id]);
    },
  });

  const writeCards = stuck?.length ? stuck : defMode ? defCards : [];
  const writeFlow = writeCards.length > 0 && (stuck || defMode) ? (
    <div className="flex-1 flex flex-col">
      <WriteOwnDef
        cards={writeCards}
        allTerms={defMode ? pool : undefined}
        variant={defMode ? 'defMode' : 'stuck'}
        onComplete={(entries) => startWrittenReview(entries, writeCards)}
        onSkip={() => {
          if (defMode) {
            setDefMode(false);
            return;
          }
          (stuck || []).forEach((c) => deferredRef.current.add(c.id));
          setSkipped(true);
          setStuck(null);
        }}
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

  if (!current) {
    if (leftoverRef.current?.length) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Wrapping up…</p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col px-5 pt-6">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col items-center text-center pt-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">Flash cards done</h2>
          <p className="text-sm text-muted-foreground mb-6">Back to skim, or lock in the ones that kept cycling.</p>
          {defModeButton}
          <Button onClick={onDone} className="w-full h-12 rounded-2xl font-semibold mt-4">
            Back to skim
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FlashCardStage
      done={retired}
      total={deckTotalRef.current}
      caption={cardProgressCaption(deckTotalRef.current, retired)}
      label={(
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Back
        </button>
      )}
      meta={reviewing ? 'Practice your wording' : 'Flash cards'}
      prompt={current.term}
      revealed={revealed}
      answer={flashcardDef(current)}
      onReveal={() => setRevealed(true)}
      onMiss={onMiss}
      onKnow={() => retireIds([current.id])}
      footer={`${retired} retired · ${items.length} in rotation`}
      below={defModeButton}
      revealExtra={computer ? <ShortcutKey>Space</ShortcutKey> : null}
      missExtra={computer ? <ShortcutKey>←</ShortcutKey> : null}
      knowExtra={computer ? <ShortcutKey>→</ShortcutKey> : null}
    />
  );
}

export default function TypeDefMode({ terms, onUpdateTerm, onClose, startIn = 'type' }) {
  const usable = React.useMemo(
    () => (terms || []).filter((t) => t?.id && (t.term || t.definition)),
    [terms],
  );
  const [selected, setSelected] = React.useState(() => new Set());
  const [stage, setStage] = React.useState('pick');
  const [queue, setQueue] = React.useState([]);
  const [pos, setPos] = React.useState(0);
  const [typed, setTyped] = React.useState('');
  const typedById = React.useRef({});
  const inputRef = React.useRef(null);
  const byId = React.useMemo(() => Object.fromEntries(usable.map((t) => [t.id, t])), [usable]);

  const begin = (mode) => {
    const ids = usable.map((t) => t.id).filter((id) => selected.has(id));
    if (!ids.length) return;
    setQueue(ids);
    setPos(0);
    setTyped('');
    setStage(mode);
  };

  const current = byId[queue[pos]];

  React.useEffect(() => {
    if (stage !== 'type') return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [stage, pos]);

  React.useEffect(() => {
    if (stage === 'type' && queue.length && !current) onClose();
  }, [stage, queue.length, current, onClose]);

  if (stage === 'pick') {
    return (
      <Picker
        terms={usable}
        selected={selected}
        setSelected={setSelected}
        onBack={onClose}
        startLabel={startIn === 'flash' ? 'Start flash cards' : 'Start typing'}
        onStart={() => begin(startIn)}
      />
    );
  }

  if (stage === 'flash') {
    return (
      <FlashRound
        queue={queue.slice(pos)}
        byId={byId}
        allTerms={usable}
        onUpdateTerm={onUpdateTerm}
        onDone={onClose}
        onBack={() => setStage('pick')}
      />
    );
  }

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Wrapping up…</p>
      </div>
    );
  }

  const last = pos + 1 >= queue.length;
  const goNext = () => {
    onUpdateTerm(current.id, { seen: true });
    typedById.current[current.id] = typed;
    if (last) {
      onClose();
      return;
    }
    const nextPos = pos + 1;
    setTyped(typedById.current[queue[nextPos]] || '');
    setPos(nextPos);
  };
  const goPrev = () => {
    if (pos <= 0) return;
    typedById.current[current.id] = typed;
    const prev = pos - 1;
    setTyped(typedById.current[queue[prev]] || '');
    setPos(prev);
  };

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => {
              setQueue(queue.slice(pos));
              setPos(0);
              setStage('flash');
            }}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Flash cards
          </button>
          <p className="text-xs text-muted-foreground">{pos + 1}/{queue.length}</p>
        </div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Term</p>
        <h2 className="text-2xl font-bold tracking-tight mb-2">{current.term}</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Type the definition over the grey guide, then go next.
        </p>
        <TypeGuide
          definition={current.definition}
          value={typed}
          onChange={setTyped}
          inputRef={inputRef}
        />
        <div className={cn('mt-4', pos > 0 && 'grid grid-cols-2 gap-3')}>
          {pos > 0 && (
            <Button variant="outline" onClick={goPrev} className="h-12 rounded-2xl font-semibold">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          )}
          <Button onClick={goNext} className="w-full h-12 rounded-2xl font-semibold">
            {last ? 'Done' : 'Next'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
