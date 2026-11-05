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
    <div className="flex flex-1 flex-col px-gutter pb-6 pt-8">
      <div className="mx-auto flex w-full max-w-study flex-1 flex-col gap-6">
        <div className="flex items-center justify-between text-meta text-muted-foreground">
          <span>{blockLabel}</span>
          <span>
            {pos + 1}/{queue.length}
          </span>
        </div>
        <div className="rounded-card border border-border bg-surface-1 p-8">
          <p className="text-label uppercase text-muted-foreground">Term</p>
          <p className="mt-6 break-words text-display text-foreground">{current.term}</p>
          <p className="mt-6 text-body text-muted-foreground">
            Think it or say it out loud. Typing is optional.
          </p>
        </div>
        <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type it if you want…"
          />
          {revealed && (
            <div className="grid gap-6 sm:grid-cols-2">
              {earlierAttempt && (
                <div className="animate-reveal-in rounded-card border border-border bg-surface-1 p-6">
                  <p className="text-label uppercase text-muted-foreground">
                    What you wrote
                  </p>
                  <p className="mt-3 break-words text-body text-foreground">{earlierAttempt}</p>
                </div>
              )}
              <div className={earlierAttempt ? 'animate-reveal-in rounded-card border border-know/30 bg-know/12 p-6' : 'animate-reveal-in rounded-card border border-know/30 bg-know/12 p-6 sm:col-span-2'}>
                <p className="text-label uppercase text-know">
                  Definition
                </p>
                <p className="mt-3 break-words text-body text-foreground">{flashcardDef(current)}</p>
              </div>
            </div>
          )}
          <div>
            {!revealed ? (
              <Button
                onClick={() => setRevealed(true)}
                className="w-full h-12 rounded-full font-semibold"
              >
                <Eye className="w-4 h-4 mr-2" /> Show answer
              </Button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => advance('missed')}
                  variant="destructive"
                  className="h-12 rounded-full font-semibold px-2"
                >
                  <X className="w-4 h-4 mr-1" /> Missed
                </Button>
                <Button
                  onClick={() => advance('partly')}
                variant="shaky"
                className="px-2"
                >
                  Partly
                </Button>
                <Button
                  onClick={() => advance('got_it')}
                  variant="success"
                  className="h-12 rounded-full font-semibold px-2"
                >
                  <Check className="w-4 h-4 mr-1" /> Got it
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
