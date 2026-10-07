import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { invokeLlm } from '@/api/invokeLlm';
import { cn } from '@/lib/utils';

export const STUCK_AFTER_ROTATIONS = 3;

function useFitAboveKeyboard(step, typing) {
  const ref = React.useRef(null);
  const [frame, setFrame] = React.useState({ height: null, keyboard: false });

  React.useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    };

    if (typing) {
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = '0px';
      body.style.width = '100%';
      window.scrollTo(0, 0);
    }

    const measure = () => {
      const node = ref.current;
      const vv = window.visualViewport;
      if (!node || !vv) return;
      if (typing && window.scrollY > 0) window.scrollTo(0, 0);
      const top = Math.max(0, node.getBoundingClientRect().top);
      const keyboardGap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setFrame({
        height: Math.max(220, Math.round(vv.height - top)),
        keyboard: keyboardGap > 80,
      });
    };

    measure();
    const vv = window.visualViewport;
    const onViewport = () => measure();
    vv?.addEventListener('resize', onViewport);
    vv?.addEventListener('scroll', onViewport);
    window.addEventListener('resize', onViewport);
    window.addEventListener('orientationchange', onViewport);
    const pinTimers = typing
      ? [window.setTimeout(measure, 60), window.setTimeout(measure, 280)]
      : [];

    return () => {
      pinTimers.forEach((id) => window.clearTimeout(id));
      vv?.removeEventListener('resize', onViewport);
      vv?.removeEventListener('scroll', onViewport);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('orientationchange', onViewport);
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
    };
  }, [step, typing]);

  return [ref, frame];
}

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

function spoken(definition) {
  const def = String(definition || '').trim().replace(/\s+/g, ' ');
  if (!def) return '';
  return /[.!?]$/.test(def) ? def : `${def}.`;
}

function localHelp(kind, term, definition) {
  const name = String(term || '').trim() || 'This term';
  const def = spoken(definition);
  if (kind === 'example') {
    if (!def) return `Picture a real moment where ${name} shows up, and describe that scene.`;
    const body = def.charAt(0).toLowerCase() + def.slice(1).replace(/[.!?]$/, '');
    return `For example, ${name} is what is going on when ${body}.`;
  }
  if (!def) return `${name} is the idea on this card. Say what it does in your own words.`;
  return `${name} means ${def.charAt(0).toLowerCase()}${def.slice(1)}`;
}

function helpText(res) {
  if (res && typeof res === 'object') {
    const nested = res.text || res.explanation || res.example || res.result;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  const raw = typeof res === 'string' ? res.trim() : '';
  if (!raw) return '';
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(raw.slice(start, end + 1));
      if (obj && typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
    } catch {
      // The reply is plain text, not JSON.
    }
  }
  return raw.replace(/^["'\s]+|["'\s]+$/g, '').trim();
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
  const [helps, setHelps] = React.useState({});
  const [helping, setHelping] = React.useState(null);
  const writtenRef = React.useRef([]);
  const [fitRef, frame] = useFitAboveKeyboard(step, typing);
  const fitStyle = frame.height ? { height: frame.height } : undefined;

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

  const askHelp = async (kind) => {
    if (!current?.id || helping) return;
    const id = current.id;
    const term = current.term;
    const definition = current.definition;
    setHelping(kind);
    const prompt = kind === 'example'
      ? `Give one concrete everyday example of the term "${term}" in one or two sentences. ` +
        `A student is about to write their own definition and needs the idea in use, not a definition to copy. ` +
        (definition ? `Use this meaning only as a guide, and do not restate it: "${definition}". ` : '') +
        `No heading. Return JSON { "text": "..." }.`
      : `Explain the term "${term}" in two short sentences of plain language. ` +
        `A student is about to write their own definition. Help them understand it without handing them a sentence to copy. ` +
        (definition ? `Use this meaning only as a guide, and do not restate it: "${definition}". ` : '') +
        `No heading. Return JSON { "text": "..." }.`;
    let text = '';
    try {
      const res = await invokeLlm({
        prompt,
        feature: 'explain',
        response_json_schema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
        },
      });
      text = helpText(res);
    } catch {
      text = '';
    }
    setHelps((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [kind]: text || localHelp(kind, term, definition) },
    }));
    setHelping(null);
  };

  const beginPeek = (e) => {
    if (!typing) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Peek still works if the browser rejects capture.
    }
    setPeeking(true);
  };

  const endPeek = () => setPeeking(false);

  if (step === 'add') {
    return (
      <div ref={fitRef} style={fitStyle} className="flex flex-col min-h-0 overflow-hidden px-5 pt-4">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
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
          <div className="shrink-0 pb-safe">
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
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div ref={fitRef} style={fitStyle} className="flex flex-col min-h-0 overflow-hidden px-5 pt-4">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
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
          <div className="shrink-0 pb-safe">
            <Button onClick={() => startWriting(list)} className="w-full h-12 rounded-2xl font-semibold">
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="mt-3 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                {skipLabel || 'Keep going'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div ref={fitRef} style={fitStyle} className="flex flex-col min-h-0 overflow-hidden px-5 pt-3">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
        {list.length > 1 && (
          <p className="text-xs text-muted-foreground mb-1 shrink-0">
            {idx + 1}/{list.length}
          </p>
        )}
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 shrink-0">Term</p>
        <h3 className="text-xl font-bold tracking-tight mb-2 shrink-0 leading-tight">{current.term}</h3>
        {!frame.keyboard && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3 shrink-0">
            {typing
              ? 'Hold the definition to peek. Let go, then type your own version.'
              : 'Look at the definition. Try to memorize it. Don’t just rewrite — paraphrase and recall information to build a definition you will remember.'}
          </p>
        )}
        <div
          className={cn(
            'relative min-h-[4.5rem] flex-1 basis-44 max-h-44 overflow-y-auto rounded-2xl border border-border bg-card p-4 select-none',
            frame.keyboard && 'basis-28 max-h-28',
            typing && !peeking && 'touch-none cursor-pointer',
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
        {current?.id && (helps[current.id]?.explain || helps[current.id]?.example) && (
          <div className={cn('mt-2 shrink-0 space-y-2 overflow-y-auto', frame.keyboard ? 'max-h-16' : 'max-h-32')}>
            {helps[current.id]?.explain && (
              <div className="rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Explanation</p>
                <p className="text-sm leading-relaxed">{helps[current.id].explain}</p>
              </div>
            )}
            {helps[current.id]?.example && (
              <div className="rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Example</p>
                <p className="text-sm leading-relaxed">{helps[current.id].example}</p>
              </div>
            )}
          </div>
        )}
        {current?.id && (!helps[current.id]?.explain || !helps[current.id]?.example) && (
          <div className="mt-2 shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1">
            {!helps[current.id]?.explain && (
              <button
                type="button"
                onClick={() => askHelp('explain')}
                disabled={!!helping}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:opacity-60"
              >
                {helping === 'explain' ? 'Explaining…' : 'Explain the term'}
              </button>
            )}
            {!helps[current.id]?.example && (
              <button
                type="button"
                onClick={() => askHelp('example')}
                disabled={!!helping}
                className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:opacity-60"
              >
                {helping === 'example' ? 'Thinking…' : 'Give an example'}
              </button>
            )}
          </div>
        )}
        <div className="mt-3 shrink-0">
          {typing ? (
            <Textarea
              value={own}
              onChange={(e) => {
                const id = current.id;
                const value = e.target.value;
                setDrafts((prev) => ({ ...prev, [id]: value }));
              }}
              onFocus={() => {
                if (window.scrollY > 0) window.scrollTo(0, 0);
              }}
              autoFocus
              rows={3}
              placeholder="Don’t just rewrite — paraphrase and recall information to build a definition you will remember"
              className={cn(
                'rounded-2xl text-base resize-none',
                frame.keyboard ? 'h-16 min-h-0' : 'h-28 min-h-0',
              )}
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
        <div className={cn('mt-3 shrink-0', frame.keyboard ? 'pb-2' : 'pb-safe', idx > 0 && 'grid grid-cols-2 gap-3')}>
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
