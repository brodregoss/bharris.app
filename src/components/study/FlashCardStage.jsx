import { Eye, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CardProgress from '@/components/study/CardProgress';

export default function FlashCardStage({
  done = 0,
  total = 0,
  caption,
  label,
  meta,
  promptLabel = 'Term',
  prompt,
  promptClass = 'text-3xl font-bold tracking-tight',
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
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-3 shrink-0">
        <CardProgress done={done} total={total} caption={caption} />
      </div>
      <div className="flex-1 flex flex-col px-5 pt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0 mb-3 gap-3">
          <span className="min-w-0">{label}</span>
          {meta ? <span className="shrink-0">{meta}</span> : null}
        </div>
        <div className="w-full max-w-md mx-auto flex flex-col flex-1 items-center justify-center">
          <div className="w-full rounded-3xl border border-border bg-card shadow-sm flex flex-col p-8 text-center min-h-[280px] items-center justify-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 shrink-0">{promptLabel}</p>
            <p className={promptClass}>{prompt}</p>
            {revealed ? (
              <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{answer}</p>
            ) : (
              <p className="mt-5 text-xs text-muted-foreground">{hint}</p>
            )}
          </div>
          <div className="w-full shrink-0 max-w-md mt-4">
            {!revealed ? (
              <Button
                onClick={onReveal}
                aria-keyshortcuts="Space"
                className="w-full h-12 rounded-2xl font-semibold"
              >
                <Eye className="w-4 h-4 mr-2" /> Show answer
                {revealExtra ? <span className="ml-2 inline-flex">{revealExtra}</span> : null}
              </Button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={onMiss}
                  variant="destructive"
                  aria-keyshortcuts="ArrowLeft"
                  className="h-12 rounded-2xl font-semibold"
                >
                  <X className="w-4 h-4 mr-2" /> Missed
                  {missExtra ? <span className="ml-2 inline-flex">{missExtra}</span> : null}
                </Button>
                <Button
                  onClick={onKnow}
                  variant="success"
                  aria-keyshortcuts="ArrowRight"
                  className="h-12 rounded-2xl font-semibold"
                >
                  <Check className="w-4 h-4 mr-2" /> Got it
                  {knowExtra ? <span className="ml-2 inline-flex">{knowExtra}</span> : null}
                </Button>
              </div>
            )}
          </div>
          {footer ? <p className="text-xs text-muted-foreground shrink-0 mt-4">{footer}</p> : null}
          {below}
        </div>
      </div>
    </div>
  );
}
