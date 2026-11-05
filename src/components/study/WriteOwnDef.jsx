import React from 'react';
import { ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import StudyScreenShell from '@/components/study/StudyScreenShell';
import { invokeLlm } from '@/api/invokeLlm';
import { cn } from '@/lib/utils';
import AiWait from '@/components/AiWait';

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
  onBack,
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

  const frameScreen = (node, { action, current: stepCurrent, total: stepTotal } = {}) => {
    if (!onBack) return node;
    return (
      <StudyScreenShell
        onBack={onBack}
        current={stepCurrent}
        total={stepTotal}
        action={action}
        shellRef={fitRef}
        shellStyle={fitStyle}
      >
        {node}
      </StudyScreenShell>
    );
  };

  if (step === 'add') {
    return (
      <div ref={fitRef} style={fitStyle} className="flex min-h-0 flex-col overflow-y-auto px-gutter pb-6 pt-8">
        <div className="mx-auto flex w-full max-w-study flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep('intro')}
            className="self-start text-meta text-primary underline-offset-4 hover:underline"
          >
            Back
          </button>
          <h2 className="text-title text-foreground">Add others</h2>
          <p className="text-body text-muted-foreground">
            Tap any extra terms you want in this round.
          </p>
          <div className="flex flex-col gap-2">
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
                      'press w-full rounded-card border p-4 text-left transition-colors duration-150 ease-out',
                      on ? 'border-primary bg-surface-1' : 'option-surface',
                    )}
                  >
                    <p className="text-body font-semibold text-foreground">{t.term}</p>
                    <p className="mt-1 line-clamp-2 text-meta text-muted-foreground">{t.definition}</p>
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
              className="w-full h-12 rounded-full font-semibold"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'intro') {
    const introAction = (
      <div className="flex flex-col gap-3">
        <Button onClick={() => startWriting(list)} className="w-full">
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-meta text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {skipLabel || 'Keep going'}
          </button>
        )}
      </div>
    );
    const introBody = (
      <>
        <h2 className="text-title text-foreground">
          {variant === 'defMode' ? 'Write your own def' : 'Feeling stuck?'}
        </h2>
        <p className="text-body text-muted-foreground">
          Try writing your own definition to lock it in.
        </p>
        <div className="overflow-hidden rounded-card border border-border bg-surface-1">
          {list.map((t) => (
            <div key={t.id} className="flex h-action items-center border-b border-border px-4 last:border-b-0">
              <p className="truncate text-body text-foreground">{t.term}</p>
            </div>
          ))}
        </div>
        {variant === 'defMode' && allTerms?.length > list.length && (
          <button
            type="button"
            onClick={() => setStep('add')}
            className="self-start text-meta text-primary underline-offset-4 hover:underline"
          >
            Add more terms
          </button>
        )}
      </>
    );
    if (onBack) return frameScreen(introBody, { action: introAction });
    return (
      <div ref={fitRef} style={fitStyle} className="flex min-h-0 flex-col overflow-y-auto px-gutter pb-6 pt-8">
        <div className="mx-auto flex w-full max-w-study flex-col gap-6">
          {introBody}
          {introAction}
        </div>
      </div>
    );
  }

  if (!current) return null;

  const cardActions = (
    <div className={cn(idx > 0 && 'grid grid-cols-2 gap-3')}>
      {idx > 0 && (
        <Button variant="outline" onClick={goPrevCard}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      )}
      <Button onClick={finishCard} disabled={!own.trim()} className="w-full">
        Next
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );

  const cardBody = (
    <>
      {!onBack && list.length > 1 && (
        <p className="text-meta text-muted-foreground">
          {idx + 1}/{list.length}
        </p>
      )}
      <p className="text-label uppercase text-muted-foreground">Term</p>
      <h3 className="break-words text-display text-foreground">{current.term}</h3>
        {!frame.keyboard && (
          <p className="text-body text-muted-foreground">
            {typing
              ? 'Hold the definition to peek. Let go, then type your own version.'
              : 'Look at the definition. Try to memorize it. Don’t just rewrite — paraphrase and recall information to build a definition you will remember.'}
          </p>
        )}
        <div
          className={cn(
            'relative shrink-0 rounded-card border border-border bg-surface-1 p-6 select-none',
            typing && !peeking && 'touch-none cursor-pointer',
          )}
          style={typing ? { WebkitTouchCallout: 'none' } : undefined}
          onPointerDown={typing ? beginPeek : undefined}
          onPointerUp={typing ? endPeek : undefined}
          onPointerCancel={typing ? endPeek : undefined}
          onLostPointerCapture={typing ? endPeek : undefined}
          onContextMenu={typing ? (e) => e.preventDefault() : undefined}
        >
          <p className="text-label uppercase text-muted-foreground">Definition</p>
          <p className={cn(
            'mt-3 break-words text-body text-foreground',
            typing && !peeking && 'select-none blur-xl',
          )}
          >
            {current.definition}
          </p>
          {typing && (
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-card bg-surface-1 transition-opacity duration-200 ease-out',
                peeking ? 'pointer-events-none opacity-0' : 'opacity-100',
              )}
              aria-hidden={peeking}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-pill border border-border bg-surface-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
              </span>
              <p className="text-meta text-muted-foreground">Hold to peek</p>
            </div>
          )}
        </div>
        {current?.id && (helps[current.id]?.explain || helps[current.id]?.example) && (
          <div className="flex flex-col gap-6">
            {helps[current.id]?.explain && (
              <div className="animate-reveal-in shrink-0 rounded-card border border-border bg-surface-1 p-6">
                <p className="text-label uppercase text-muted-foreground">Explanation</p>
                <p className="mt-3 break-words text-body text-foreground">{helps[current.id].explain}</p>
              </div>
            )}
            {helps[current.id]?.example && (
              <div className="animate-reveal-in shrink-0 rounded-card border border-border bg-surface-1 p-6">
                <p className="text-label uppercase text-muted-foreground">Example</p>
                <p className="mt-3 break-words text-body text-foreground">{helps[current.id].example}</p>
              </div>
            )}
          </div>
        )}
        {current?.id && (!helps[current.id]?.explain || !helps[current.id]?.example) && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
            {!helps[current.id]?.explain && (
              <button
                type="button"
                onClick={() => askHelp('explain')}
                disabled={!!helping}
                className="text-meta text-primary underline-offset-4 hover:underline disabled:text-tertiary"
              >
                {helping === 'explain' ? (
                  <AiWait compact label="Explaining" estimateMs={8000} />
                ) : 'Explain the term'}
              </button>
            )}
            {!helps[current.id]?.example && (
              <button
                type="button"
                onClick={() => askHelp('example')}
                disabled={!!helping}
                className="text-meta text-primary underline-offset-4 hover:underline disabled:text-tertiary"
              >
                {helping === 'example' ? (
                  <AiWait compact label="Thinking" estimateMs={8000} />
                ) : 'Give an example'}
              </button>
            )}
          </div>
        )}
        <div>
          {typing ? (
            <>
              <p className="mb-2 text-label uppercase text-muted-foreground">Explain the term</p>
              <Textarea
                value={own}
                onChange={(e) => {
                  const id = current.id;
                  const value = e.target.value;
                  setDrafts((prev) => ({ ...prev, [id]: value }));
                }}
                onFocus={(e) => {
                  if (window.scrollY > 0) window.scrollTo(0, 0);
                  const scroller = e.currentTarget.closest('.overflow-y-auto');
                  if (!scroller) return;
                  const field = e.currentTarget.getBoundingClientRect();
                  const box = scroller.getBoundingClientRect();
                  if (field.bottom > box.bottom - 8) {
                    scroller.scrollTop += field.bottom - box.bottom + 16;
                  }
                }}
                autoFocus
                rows={4}
                placeholder="Don’t just rewrite — paraphrase and recall information to build a definition you will remember"
                className="resize-none"
              />
            </>
          ) : (
            <Button type="button" onClick={() => setTyping(true)} className="w-full">
              Start typing
            </Button>
          )}
        </div>
        {!onBack ? cardActions : null}
    </>
  );

  if (onBack) {
    return frameScreen(cardBody, {
      action: cardActions,
      current: idx + 1,
      total: list.length,
    });
  }

  return (
    <div ref={fitRef} style={fitStyle} className="flex min-h-0 flex-col overflow-y-auto px-gutter pb-6 pt-8">
      <div className="mx-auto flex w-full max-w-study flex-col gap-6">
        {cardBody}
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
