import { sittingEstimate } from '@/lib/spacedCram';

export function cardProgressCaption(total, done, estimateOptions) {
  const line = sittingEstimate(total, estimateOptions).line;
  return [line, done > 0 ? `${done} done` : ''].filter(Boolean).join(' · ');
}

export default function CardProgress({ done = 0, total = 0, caption }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeDone = Math.max(0, Math.min(safeTotal, Number(done) || 0));
  const pct = safeTotal ? Math.min(100, Math.round((safeDone / safeTotal) * 100)) : 0;
  return (
    <div>
      <div
        className="h-bar overflow-hidden rounded-pill bg-surface-2"
        role="progressbar"
        aria-valuenow={safeDone}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label="Cards done"
      >
        <div
          className="h-full rounded-pill bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {caption ? <p className="mt-2 text-center text-meta text-tertiary">{caption}</p> : null}
    </div>
  );
}
