import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export const STUCK_AFTER_ROTATIONS = 3;

export function definitionHint(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const n = Math.max(1, Math.min(words.length, Math.ceil(words.length * 0.35)));
  return words.slice(0, n).join(' ') + (n < words.length ? '…' : '');
}

export function cardsAtStuckThreshold(ids, byId, missCount, skipIds) {
  const skip = skipIds instanceof Set ? skipIds : new Set(skipIds || []);
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (!id || seen.has(id) || skip.has(id)) continue;
    seen.add(id);
    if (String(byId[id]?.ownDefinition || '').trim()) continue;
    if ((missCount[id] || 0) >= STUCK_AFTER_ROTATIONS && byId[id]) out.push(byId[id]);
  }
  return out;
}

export function writtenDefsFrom(entries) {
  const ids = [];
  const defs = {};
  for (const e of entries || []) {
    const id = typeof e === 'string' ? e : e?.id;
    if (!id) continue;
    ids.push(id);
    const text = typeof e === 'object' ? String(e.ownDefinition || '').trim() : '';
    if (text) defs[id] = text;
  }
  return { ids, defs };
}

export function writtenReviewPlan(entries, fallbackCards, currentQueue = []) {
  const { ids, defs } = writtenDefsFrom(entries);
  const written = [...new Set(ids.length ? ids : (fallbackCards || []).map((c) => c.id).filter(Boolean))];
  const drop = new Set(written);
  const leftover = (currentQueue || []).filter((id) => !drop.has(id));
  return { ids: written, defs, leftover };
}

export default function WriteOwnDef({
  cards: initialCards,
  allTerms,
  variant = 'stuck',
  skipLabel,
  onComplete,
  onSkip,
}) {
  const [list, setList] = React.useState(() => uniqueCards(initialCards));
  const [step, setStep] = React.useState('intro');
  const [idx, setIdx] = React.useState(0);
  const [typing, setTyping] = React.useState(false);
  const [peeking, setPeeking] = React.useState(false);
  const [picked, setPicked] = React.useState(() => new Set((initialCards || []).map((c) => c.id)));
  const [drafts, setDrafts] = React.useState({});
  const writtenRef = React.useRef([]);

  const current = list[idx];
  const own = current ? (drafts[current.id] ?? current.ownDefinition ?? '') : '';
  const baseIds = React.useMemo(
    () => new Set((initialCards || []).map((c) => c.id).filter(Boolean)),
    [initialCards],
  );
  const extras = React.useMemo(
    () => (allTerms || []).filter((t) => t?.id && !baseIds.has(t.id)),
    [allTerms, baseIds],
  );

  const startWriting = (nextList) => {
    const cards = uniqueCards(nextList);
    if (!cards.length) {
      onComplete?.(writtenRef.current);
      return;
    }
    setList(cards);
    setIdx(0);
    setTyping(false);
    setPeeking(false);
    setStep('card');
  };

  const resetCardView = () => {
    setTyping(false);
    setPeeking(false);
  };

  const finishCard = () => {
    const text = String(own || '').trim();
    if (!text || !current?.id) return;
    writtenRef.current = [...writtenRef.current.filter((e) => e.id !== current.id), { id: current.id, ownDefinition: text }];
    if (idx + 1 >= list.length) {
      onComplete?.(writtenRef.current);
      return;
    }
    setIdx((i) => i + 1);
    resetCardView();
  };

  const goPrevCard = () => {
    if (idx <= 0) return;
    resetCardView();
    setIdx((i) => i - 1);
  };

  const beginPeek = (e) => {
    if (!typing) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPeeking(true);
  };

  const endPeek = () => setPeeking(false);

  if (step === 'add') {
    return (
      <div className="flex-1 flex flex-col px-5 pt-4">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <button
            type="button"
            onClick={() => setStep('intro')}
            className="self-start text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mb-3"
          >
            Back
          </button>
          <h2 className="text-xl font-bold tracking-tight mb-1">Add others</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Tap any extra terms you want in this round.
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {extras.length ? (
              extras.map((t) => {
                const on = picked.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.id) && !baseIds.has(t.id)) next.delete(t.id);
                        else next.add(t.id);
                        return next;
                      });
                    }}
                    className={cn(
                      'w-full text-left rounded-xl border p-3 transition',
                      on ? 'border-foreground bg-card' : 'border-border bg-muted/30',
                    )}
                  >
                    <p className="text-sm font-semibold">{t.term}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.definition}</p>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No other terms to add.</p>
            )}
          </div>
          <Button
            onClick={() => {
              const chosen = uniqueCards([
                ...list,
                ...(allTerms || []).filter((t) => picked.has(t.id)),
              ]);
              setList(chosen);
              setStep('intro');
            }}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="flex-1 flex flex-col px-5 pt-4">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight mb-2">
            {variant === 'defMode' ? 'Write your own def' : 'Feeling stuck?'}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            Try writing your own definition to lock it in.
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {list.map((t) => (
              <div key={t.id} className="rounded-xl border border-border bg-card px-3 py-2.5">
                <p className="text-sm font-semibold">{t.term}</p>
              </div>
            ))}
          </div>
          {variant === 'defMode' && allTerms?.length > list.length && (
            <button
              type="button"
              onClick={() => setStep('add')}
              className="mb-3 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline self-start"
            >
              Add more terms
            </button>
          )}
          <Button onClick={() => startWriting(list)} className="w-full h-12 rounded-2xl font-semibold">
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="mt-3 mb-2 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {skipLabel || 'Keep going'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        {list.length > 1 && (
          <p className="text-xs text-muted-foreground mb-2">
            {idx + 1}/{list.length}
          </p>
        )}
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Term</p>
        <h3 className="text-2xl font-bold tracking-tight mb-2">{current.term}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {typing
            ? 'Hold the definition to peek. Let go, then type your own version.'
            : 'Look at the definition. Try to memorize it. Don’t just rewrite — paraphrase and recall information to build a definition you will remember.'}
        </p>
        <div
          className={cn(
            'relative flex-1 min-h-[8.5rem] rounded-2xl border border-border bg-card p-5 select-none',
            typing && 'touch-none cursor-pointer',
          )}
          style={typing ? { WebkitTouchCallout: 'none' } : undefined}
          onPointerDown={typing ? beginPeek : undefined}
          onPointerUp={typing ? endPeek : undefined}
          onPointerCancel={typing ? endPeek : undefined}
          onLostPointerCapture={typing ? endPeek : undefined}
          onContextMenu={typing ? (e) => e.preventDefault() : undefined}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Definition</p>
          <p className={cn('text-base leading-relaxed', typing && !peeking && 'invisible')}>
            {current.definition}
          </p>
          {typing && !peeking && (
            <div className="absolute inset-0 rounded-2xl bg-muted flex items-center justify-center px-6">
              <p className="text-sm font-medium text-muted-foreground text-center">Hold to peek</p>
            </div>
          )}
        </div>
        <div className="mt-4">
          {typing ? (
            <Textarea
              value={own}
              onChange={(e) => {
                const id = current.id;
                const value = e.target.value;
                setDrafts((prev) => ({ ...prev, [id]: value }));
              }}
              autoFocus
              rows={4}
              placeholder="Don’t just rewrite — paraphrase and recall information to build a definition you will remember"
              className="rounded-2xl text-base min-h-[120px]"
            />
          ) : (
            <Button
              type="button"
              onClick={() => setTyping(true)}
              className="w-full h-12 rounded-2xl font-semibold"
            >
              Start typing
            </Button>
          )}
        </div>
        <div className={cn('mt-4', idx > 0 && 'grid grid-cols-2 gap-3')}>
          {idx > 0 && (
            <Button
              variant="outline"
              onClick={goPrevCard}
              className="h-12 rounded-2xl font-semibold"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          )}
          <Button
            onClick={finishCard}
            disabled={!own.trim()}
            className="h-12 rounded-2xl font-semibold w-full"
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function uniqueCards(cards) {
  const seen = new Set();
  const out = [];
  for (const c of cards || []) {
    if (!c?.id || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}
