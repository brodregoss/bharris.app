import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CardProgress from '@/components/study/CardProgress';
import StudyScreenShell from '@/components/study/StudyScreenShell';

export default function FlashCardStage({
  done = 0,
  total = 0,
  index,
  count,
  caption,
  label,
  meta,
  promptLabel = 'Term',
  prompt,
  revealed,
  answer,
  hint = 'Reveal the definition, then grade yourself.',
  onReveal,
  onMiss,
  onKnow,
  footer,
  below,
  revealExtra,
  missExtra,
  knowExtra,
  onBack,
}) {
  const actions = !revealed ? (
    <Button
      onClick={onReveal}
      aria-keyshortcuts="Space"
      className="w-full"
    >
      Show answer
      {revealExtra ? <span className="ml-3 inline-flex">{revealExtra}</span> : null}
    </Button>
  ) : (
    <div className="grid grid-cols-2 gap-3">
      <Button
        onClick={onMiss}
        variant="destructive"
        aria-keyshortcuts="ArrowLeft"
      >
        <X className="h-4 w-4" /> Missed
        {missExtra ? <span className="ml-2 inline-flex">{missExtra}</span> : null}
      </Button>
      <Button
        onClick={onKnow}
        variant="success"
        aria-keyshortcuts="ArrowRight"
      >
        <Check className="h-4 w-4" /> Got it
        {knowExtra ? <span className="ml-2 inline-flex">{knowExtra}</span> : null}
      </Button>
    </div>
  );

  const card = (
    <div className="animate-reveal-in flex max-h-[min(32rem,62dvh)] min-h-card w-full flex-col overflow-y-auto rounded-card border border-border bg-surface-1 px-8 py-10">
      <div className="my-auto">
        <p className="text-center text-label uppercase text-muted-foreground">{promptLabel}</p>
        <p className="mt-6 break-words text-center text-display text-foreground">{prompt}</p>
        {revealed ? (
          <p className="animate-reveal-in mt-6 break-words text-center text-body text-foreground">{answer}</p>
        ) : (
          <p className="mt-6 text-center text-meta text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );

  const stack = (
    <div className="my-auto flex w-full flex-col gap-6">
      {label ? <p className="text-label uppercase text-muted-foreground">{label}</p> : null}
      {card}
      <div className="w-full shrink-0">{actions}</div>
      {footer ? <p className="text-center text-meta text-muted-foreground">{footer}</p> : null}
      {meta ? <p className="text-center text-meta text-muted-foreground">{meta}</p> : null}
      {below}
    </div>
  );

  if (onBack) {
    return (
      <StudyScreenShell
        onBack={onBack}
        current={index || done}
        total={count || total}
        caption={caption}
      >
        {stack}
      </StudyScreenShell>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-gutter pt-3">
        <CardProgress done={done} total={total} caption={caption} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-gutter pb-6 pt-8">
        <div className="mx-auto flex w-full max-w-study flex-1 flex-col">
          {stack}
        </div>
      </div>
    </div>
  );
}
