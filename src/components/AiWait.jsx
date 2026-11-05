import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function formatAiEta(ms) {
  if (ms <= 1500) return 'any moment';
  const sec = Math.ceil(ms / 1000);
  if (sec < 8) return 'a few seconds';
  if (sec < 60) return `about ${Math.ceil(sec / 5) * 5} sec`;
  const min = Math.max(1, Math.round(sec / 60));
  return min === 1 ? 'about 1 min' : `about ${min} min`;
}

export function useAiProgress({ estimateMs = 12000, floor = 0, ceiling = 95 } = {}) {
  const startRef = React.useRef(Date.now());
  const shownRef = React.useRef(0);
  const floorSeen = React.useRef(floor);
  const markRef = React.useRef({ estimateMs, floor, ceiling });
  const [, setTick] = React.useState(0);

  if (
    markRef.current.estimateMs !== estimateMs
    || markRef.current.floor !== floor
    || markRef.current.ceiling !== ceiling
  ) {
    markRef.current = { estimateMs, floor, ceiling };
    startRef.current = Date.now();
  }

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = Date.now() - startRef.current;
  const budget = Math.max(1000, estimateMs);
  const eased = 1 - Math.exp(-2.4 * elapsed / budget);
  const safeFloor = Math.max(0, Math.min(95, Math.round(floor)));
  const cap = Math.max(safeFloor, Math.min(95, Math.round(ceiling)));
  const next = Math.min(95, Math.max(safeFloor || 1, Math.round(safeFloor + (cap - safeFloor) * eased)));
  if (safeFloor < floorSeen.current) shownRef.current = safeFloor;
  floorSeen.current = safeFloor;
  shownRef.current = Math.max(shownRef.current, next);

  return {
    percent: shownRef.current,
    remainingMs: Math.max(0, estimateMs - elapsed),
    eta: formatAiEta(Math.max(0, estimateMs - elapsed)),
  };
}

export default function AiWait({
  label,
  detail,
  estimateMs = 12000,
  floor = 0,
  ceiling = 95,
  compact = false,
  className,
}) {
  const { percent, eta } = useAiProgress({ estimateMs, floor, ceiling });

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-foreground', className)}>
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{percent}% · {eta}</span>
      </span>
    );
  }

  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      <div>
        <p className="text-sm font-medium">{label}</p>
        {detail ? <p className="mt-1 max-w-xs text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="w-44" aria-label={`${percent} percent, ${eta}`}>
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium tabular-nums text-muted-foreground">
          <span>{percent}%</span>
          <span>{eta}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
