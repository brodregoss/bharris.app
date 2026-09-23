import React from 'react';
import { Link } from 'react-router-dom';
import { Flag, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { flashcardDef } from '@/lib/studyUtils';

function useLandscape() {
  const [landscape, setLandscape] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const onChange = () => setLandscape(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return landscape;
}

export default function PartnerCockpit({
  categories,
  termsById,
  currentId,
  flaggedTermIds,
  coveredIds,
  categoryName,
  passLabel,
  coveredCount,
  totalCount,
  onJumpToTerm,
  onGotIt,
  onMissed,
}) {
  const landscape = useLandscape();
  const [hideRotate, setHideRotate] = React.useState(false);
  const [directionsOpen, setDirectionsOpen] = React.useState(
    () => coveredCount === 0 && passLabel === 'First pass'
  );
  const current = termsById.get(currentId);
  const showRotate = !landscape && !hideRotate && !directionsOpen;
  const missed = React.useMemo(() => new Set(flaggedTermIds || []), [flaggedTermIds]);
  const covered = React.useMemo(() => new Set(coveredIds || []), [coveredIds]);
  const currentRef = React.useRef(null);

  React.useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentId]);

  const list = (
    <div
      className={cn(
        'shrink-0 overflow-y-auto border-border bg-card/60',
        landscape ? 'w-56 border-r' : 'w-full max-h-[38vh] border-b'
      )}
    >
      <div className="px-2 py-2 space-y-3">
        {(categories || []).map((cat) => (
          <div key={cat.id}>
            <p className="px-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground truncate">
              {cat.name}
            </p>
            <div className="mt-1 space-y-0.5">
              {(cat.termIds || []).map((id, i) => {
                const term = termsById.get(id);
                const isCurrent = id === currentId;
                const isMissed = missed.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    ref={isCurrent ? currentRef : undefined}
                    onClick={() => onJumpToTerm?.(id)}
                    className={cn(
                      'w-full flex items-start gap-1.5 rounded-lg px-1.5 py-1 text-left transition',
                      isCurrent ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                    )}
                  >
                    <span
                      className={cn(
                        'shrink-0 w-6 h-6 rounded-md text-[11px] font-bold tabular-nums flex items-center justify-center',
                        isCurrent && !isMissed && 'bg-primary-foreground/20 text-primary-foreground',
                        isCurrent && isMissed && 'bg-rose-500/25 text-rose-50',
                        !isCurrent && isMissed && 'bg-rose-500/15 text-rose-800 dark:text-rose-200',
                        !isCurrent && !isMissed && covered.has(id) && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                        !isCurrent && !isMissed && !covered.has(id) && 'bg-muted text-muted-foreground'
                      )}
                      aria-label={
                        isMissed
                          ? `${i + 1}, missed`
                          : covered.has(id)
                            ? `${i + 1}, got it`
                            : `Question ${i + 1}`
                      }
                    >
                      {i + 1}
                    </span>
                    <span className={cn(
                      'min-w-0 flex-1 text-[11px] leading-snug font-medium pt-0.5',
                      isCurrent ? 'text-primary-foreground' : 'text-foreground'
                    )}
                    >
                      {term?.term || 'Term'}
                    </span>
                    {isMissed && (
                      <Flag
                        className={cn(
                          'w-3.5 h-3.5 shrink-0 mt-1',
                          isCurrent ? 'text-amber-300 fill-amber-300' : 'text-amber-500 fill-amber-500'
                        )}
                        aria-label="Coming back to this term"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 pt-safe pb-2 border-b border-border flex items-center gap-3">
        <Link
          to="/"
          aria-label="Home"
          className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-primary-foreground shrink-0 hover:bg-primary/90 transition"
        >
          <Home className="w-4 h-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground truncate">{passLabel}</p>
          <p className="text-sm font-bold tracking-tight truncate">{categoryName}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums shrink-0">
          {coveredCount} / {totalCount}
        </p>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        {showRotate && (
          <div className="absolute inset-0 z-30 bg-background/95 flex flex-col items-center justify-center px-8 text-center">
            <RotateCcw className="w-8 h-8 mb-3 text-muted-foreground" />
            <p className="text-lg font-bold tracking-tight">Rotate for cockpit view</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Landscape puts every category and term beside the card so your partner can see the whole deck.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-6 rounded-2xl"
              onClick={() => setHideRotate(true)}
            >
              Study in portrait anyway
            </Button>
          </div>
        )}

        <div className={cn('flex-1 flex min-h-0', landscape ? 'flex-row' : 'flex-col')}>
          {list}
          <div className="flex-1 flex flex-col min-h-0 px-5 py-4">
            {current ? (
              <>
                <div className="flex-1 overflow-y-auto">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Term
                  </p>
                  <div className="flex items-start gap-2">
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight flex-1 min-w-0">{current.term}</p>
                    {missed.has(current.id) && (
                      <Flag className="w-6 h-6 shrink-0 mt-1 text-amber-500 fill-amber-500" aria-label="Coming back to this term" />
                    )}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-5 mb-1.5">
                    Definition
                  </p>
                  <p className="text-lg sm:text-xl font-medium leading-snug text-muted-foreground">
                    {flashcardDef(current)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 pb-safe">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 rounded-2xl text-base font-semibold"
                    onClick={onMissed}
                  >
                    Missed
                  </Button>
                  <Button type="button" className="h-14 rounded-2xl text-base font-semibold" onClick={onGotIt}>
                    Got it
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground m-auto">No terms in this list.</p>
            )}
          </div>
        </div>
      </div>

      <Dialog open={directionsOpen} onOpenChange={setDirectionsOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Before you start</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>Ask your friend what the definition of the term is, and let them think hard about it.</p>
                <p>When they get stuck, help them and correct the parts of the definition they missed.</p>
                <p>Any terms they missed will be reviewed again later.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            className="h-12 rounded-2xl text-base font-semibold"
            onClick={() => setDirectionsOpen(false)}
          >
            Start
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
