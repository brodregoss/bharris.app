import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { flashcardDef } from '@/lib/studyUtils';
import { savedAttemptForMiss } from '@/lib/spacedCram';

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function SpacedFreeRecall({
  terms,
  blockLabel = 'Free recall',
  onLogAttempt,
  onUpdateTerm,
  onCardTimed,
  onDone,
}) {
  const [queue] = React.useState(() =>
    shuffle((Array.isArray(terms) ? terms : []).filter((t) => t?.id))
  );
  const [pos, setPos] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const [revealed, setRevealed] = React.useState(false);
  const doneRef = React.useRef(false);
  const shownAtRef = React.useRef(Date.now());

  React.useLayoutEffect(() => {
    shownAtRef.current = Date.now();
  }, [pos]);

  const current = queue[pos];
  const earlierAttempt = current ? savedAttemptForMiss(current) : '';

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone?.({ got: 0, total: queue.length, reason: 'pass' });
  }, [onDone, queue.length]);

  React.useLayoutEffect(() => {
    if (!queue.length) finish();
  }, [queue.length, finish]);

  const advance = (result) => {
    if (!current) return;
    onCardTimed?.({ mode: 'free', ms: Math.max(0, Date.now() - shownAtRef.current) });
    onLogAttempt?.(current.id, result);
    const typed = String(draft || '').trim();
    if (typed) onUpdateTerm?.(current.id, { freeAttempt: typed });
    if (pos + 1 >= queue.length) {
      finish();
      return;
    }
    setPos((p) => p + 1);
    setDraft('');
    setRevealed(false);
  };

  if (!current) {
    return (
      <div className="flex items-center justify-center px-8 py-16">
        <p className="text-sm text-muted-foreground">Wrapping up…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>{blockLabel}</span>
        <span>
          {pos + 1}/{queue.length}
        </span>
      </div>
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full max-w-md flex-1 flex flex-col">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Term</p>
          <p className="text-3xl font-bold tracking-tight mb-3">{current.term}</p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Think it or say it out loud. Typing is optional.
          </p>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type it if you want…"
            className="min-h-[6rem] rounded-2xl text-base leading-relaxed"
          />
          {revealed && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {earlierAttempt && (
                <div className="rounded-2xl border border-border bg-muted/40 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    What you wrote
                  </p>
                  <p className="text-base leading-relaxed">{earlierAttempt}</p>
                </div>
              )}
              <div className={earlierAttempt ? 'rounded-2xl border border-border bg-card p-4' : 'rounded-2xl border border-border bg-card p-4 sm:col-span-2'}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  Definition
                </p>
                <p className="text-base leading-relaxed">{flashcardDef(current)}</p>
              </div>
            </div>
          )}
          <div className="mt-4 pb-4">
            {!revealed ? (
              <Button
                onClick={() => setRevealed(true)}
                className="w-full h-12 rounded-2xl font-semibold"
              >
                <Eye className="w-4 h-4 mr-2" /> Show answer
              </Button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => advance('missed')}
                  variant="destructive"
                  className="h-12 rounded-2xl font-semibold px-2"
                >
                  <X className="w-4 h-4 mr-1" /> Missed
                </Button>
                <Button
                  onClick={() => advance('partly')}
                  variant="outline"
                  className="h-12 rounded-2xl font-semibold px-2"
                >
                  Partly
                </Button>
                <Button
                  onClick={() => advance('got_it')}
                  variant="success"
                  className="h-12 rounded-2xl font-semibold px-2"
                >
                  <Check className="w-4 h-4 mr-1" /> Got it
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
