import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import StudyScreenShell from '@/components/study/StudyScreenShell';
import { bumpFromPractice, sortForPractice } from '@/lib/mastery';
import { flashcardDef } from '@/lib/studyUtils';
import WriteOwnDef, {
  STUCK_AFTER_ROTATIONS,
  cardsAtStuckThreshold,
  writtenReviewPlan,
} from '@/components/study/WriteOwnDef';
import { ShortcutKey, useFlashcardShortcuts, useIsComputer } from '@/components/study/flashcardKeys';
import FlashCardStage from '@/components/study/FlashCardStage';
import { cardProgressCaption } from '@/components/study/CardProgress';

export default function PracticeFlashcards({ terms, onUpdateTerm, onDone, onBack, heading = 'Flashcards' }) {
  const computer = useIsComputer();
  const byId = React.useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const [items, setItems] = React.useState(() => sortForPractice(terms).map((t) => t.id));
  const deckTotalRef = React.useRef(items.length);
  const [retired, setRetired] = React.useState(0);
  const [pos, setPos] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);
  const [misses, setMisses] = React.useState({});
  const [stuck, setStuck] = React.useState(null);
  const [defMode, setDefMode] = React.useState(false);
  const [skipped, setSkipped] = React.useState(false);
  const [finished, setFinished] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);
  const deferredRef = React.useRef(new Set());
  const writtenRef = React.useRef(new Set());
  const stuckHistoryRef = React.useRef(new Set());
  const leftoverRef = React.useRef(null);
  const penalizedRef = React.useRef({});

  const current = byId[items[pos]];
  const defCards = items.length
    ? cardsAtStuckThreshold(items, byId, misses, writtenRef.current)
    : terms.filter((t) => stuckHistoryRef.current.has(t.id) && !writtenRef.current.has(t.id) && !String(t.ownDefinition || '').trim());

  React.useEffect(() => {
    setRevealed(false);
  }, [pos, items]);

  React.useEffect(() => {
    if (stuck || defMode) return;
    if (items.length > 0) return;
    if (leftoverRef.current?.length) {
      const rest = leftoverRef.current;
      leftoverRef.current = null;
      setReviewing(false);
      setItems(rest);
      setPos(0);
      return;
    }
    setFinished(true);
  }, [stuck, defMode, items.length]);

  React.useLayoutEffect(() => {
    if (stuck || defMode || finished || !current) return;
    if (deferredRef.current.has(current.id) || writtenRef.current.has(current.id)) return;
    if (String(current.ownDefinition || '').trim()) return;
    if ((misses[current.id] || 0) < STUCK_AFTER_ROTATIONS) return;
    const skip = new Set([...deferredRef.current, ...writtenRef.current]);
    const batch = cardsAtStuckThreshold(items, byId, misses, skip);
    if (batch.length) setStuck(batch);
  }, [current, items, misses, stuck, defMode, finished, byId]);

  const bump = (id, correct) => {
    const t = byId[id];
    if (!t) return;
    onUpdateTerm(id, {
      mastery: bumpFromPractice(t.mastery, { correct }),
      practiceCorrect: correct,
    });
  };

  const retireIds = (ids, defs = {}) => {
    const drop = new Set(ids);
    ids.forEach((id) => {
      const t = byId[id];
      const patch = {};
      if (t) {
        patch.mastery = bumpFromPractice(t.mastery, { correct: true });
        patch.practiceCorrect = true;
      }
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
      if (defs[id]) onUpdateTerm(id, { ownDefinition: defs[id] });
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
    setFinished(false);
    setReviewing(true);
    setItems(ids);
    setPos(0);
    setRevealed(false);
    setStuck(null);
    setDefMode(false);
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

  const onCard = !stuck && !defMode && !finished && items.length > 0 && !!current;
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
        allTerms={defMode ? terms : undefined}
        variant={defMode ? 'defMode' : 'stuck'}
        onBack={onBack}
        onComplete={(entries) => startWrittenReview(entries, writeCards)}
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

  if (items.length === 0 && leftoverRef.current?.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Wrapping up…</p>
      </div>
    );
  }

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
    const doneBody = (
      <div className="flex flex-col items-center text-center">
        <h2 className="text-title text-foreground">Flashcards done</h2>
        <p className="mt-3 text-body text-muted-foreground">
          Got it moves the term up one list. A miss moves it down one. Mastered still has to be earned in Explain it.
        </p>
        {defModeButton}
      </div>
    );
    const doneAction = (
      <Button onClick={onDone} className="w-full">
        Back to practice
        <ArrowRight className="h-4 w-4" />
      </Button>
    );
    if (onBack) {
      return (
        <StudyScreenShell onBack={onBack} action={doneAction}>
          {doneBody}
        </StudyScreenShell>
      );
    }
    return (
      <div className="flex flex-1 flex-col px-gutter pt-8">
        <div className="mx-auto flex w-full max-w-study flex-1 flex-col">
          {doneBody}
          <div className="mt-6">{doneAction}</div>
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
    <FlashCardStage
      onBack={onBack}
      done={retired}
      total={deckTotalRef.current}
      index={pos + 1}
      count={items.length}
      caption={cardProgressCaption(deckTotalRef.current, retired)}
      label={reviewing ? 'Practice your wording' : heading}
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
