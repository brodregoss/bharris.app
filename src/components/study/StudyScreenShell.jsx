import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function StudyScreenShell({
  onBack,
  backLabel = 'Back',
  current = 0,
  total = 0,
  counter,
  caption,
  headerExtra,
  children,
  action,
  footer,
  shellRef,
  shellStyle,
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCurrent = Math.max(0, Math.min(safeTotal, Number(current) || 0));
  const pct = safeTotal ? Math.min(100, Math.round((safeCurrent / safeTotal) * 100)) : 0;
  const countLabel = counter ?? (safeTotal > 0 ? `${safeCurrent} / ${safeTotal}` : '');

  return (
    <div
      ref={shellRef}
      style={shellStyle}
      className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground"
    >
      <div className="mx-auto flex w-full max-w-study min-h-0 flex-1 flex-col">
        <header className="flex h-tap items-center justify-between gap-3 px-gutter pt-safe">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="press -ml-2 flex h-tap w-tap items-center justify-center rounded-pill text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-tap w-tap" />
          )}
          <div className="flex min-w-0 items-center justify-end gap-3">
            {footer ? (
              <p className="shell-tight-only truncate text-meta text-muted-foreground">{footer}</p>
            ) : null}
            {headerExtra}
            {countLabel ? (
              <p className="shrink-0 text-meta tabular-nums text-muted-foreground">{countLabel}</p>
            ) : null}
          </div>
        </header>
        {safeTotal > 0 ? (
          <div className="px-gutter">
            <div
              className="mt-2 h-bar overflow-hidden rounded-pill bg-surface-2"
              role="progressbar"
              aria-valuenow={safeCurrent}
              aria-valuemin={0}
              aria-valuemax={safeTotal}
              aria-label="Progress"
            >
              <div
                className="h-full rounded-pill bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            {caption ? (
              <p className="mt-2 text-center text-meta text-tertiary">{caption}</p>
            ) : null}
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-gutter pb-6 pt-8">
          {children}
        </div>
        {(action || footer) ? (
          <div className="shrink-0 bg-background">
            <div
              className="mx-auto flex w-full max-w-study flex-col gap-3 px-4 pt-4"
              style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
            >
              {action}
              {footer ? (
                <p className="shell-roomy-only text-center text-meta text-muted-foreground">{footer}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
