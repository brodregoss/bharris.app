import React from 'react';
import { Check } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { SESSION_TYPE_META, sittingDetail, planProgress } from '@/lib/spacedCram';

const KEY_ORDER = ['new', 'rev', 'rev_plus', 'free'];

function TypeBadge({ type, muted }) {
  const meta = SESSION_TYPE_META[type];
  if (!meta) return null;
  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-md',
        muted ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
      )}
    >
      {meta.label}
    </span>
  );
}

function SleepRow() {
  return (
    <div className="flex items-center gap-3 py-1 px-1">
      <div className="w-7 h-7 rounded-full border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground">
        —
      </div>
      <p className="text-sm font-medium text-muted-foreground">Sleep</p>
      <p className="text-xs text-muted-foreground">overnight gap</p>
    </div>
  );
}

function SittingRow({ sitting, schedule, currentSitting, defaultOpen, leftover }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isCurrent = sitting.sitting === currentSitting;
  const isDone = sitting.sitting < currentSitting;
  const meta = SESSION_TYPE_META[sitting.type];
  const chunkN = schedule?.chunks?.length || 1;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'rounded-2xl border overflow-hidden',
          isCurrent ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border bg-card',
          isDone && 'opacity-70'
        )}
      >
        <CollapsibleTrigger className="w-full text-left px-4 py-3 flex items-start gap-3">
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
              isDone
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
                : isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {isDone ? <Check className="w-3.5 h-3.5" /> : sitting.sitting}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold tracking-tight">{sitting.timing}</p>
              <TypeBadge type={sitting.type} muted={!isCurrent && !isDone} />
              {isCurrent && (
                <span className="text-[10px] uppercase tracking-wide font-semibold text-primary">
                  You are here
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {isCurrent && leftover
                ? leftover
                : sitting.type === 'new' && chunkN > 1
                  ? `${meta?.label} · ${chunkN} chunks`
                  : meta?.meaning}
            </p>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3 pt-0 border-t border-border/60 ml-10 mr-3">
            <p className="text-sm text-muted-foreground leading-relaxed pt-3">
              {sittingDetail(sitting, schedule)}
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function SpacedPlan({ schedule, currentSitting = 1, spaced, terms }) {
  const items = schedule?.items || [];
  const progress = planProgress(schedule, spaced, terms);
  const leftover = progress.finishedAll ? null : progress.leftLine;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your study plan</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {schedule?.whyLine}
        </p>
        {schedule?.summaryLine && (
          <p className="text-sm text-foreground mt-1.5 font-medium">{schedule.summaryLine}</p>
        )}
      </div>

      <div className="rounded-2xl border border-primary bg-primary/5 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">You are here</p>
        <p className="text-base font-bold tracking-tight mt-0.5">{progress.hereLine}</p>
        <p className="text-sm text-muted-foreground mt-1 leading-snug">{progress.leftLine}</p>
        <div className="h-1.5 rounded-full bg-muted mt-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, progress.sittingPct))}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {progress.sittingsDone} of {progress.last} sitting{progress.last === 1 ? '' : 's'} done
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Key</p>
        <ul className="space-y-1.5">
          {KEY_ORDER.map((id) => {
            const meta = SESSION_TYPE_META[id];
            return (
              <li key={id} className="flex items-start gap-2">
                <TypeBadge type={id} />
                <p className="text-xs text-muted-foreground leading-snug pt-0.5">{meta.meaning}</p>
              </li>
            );
          })}
          <li className="flex items-start gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
              Sleep
            </span>
            <p className="text-xs text-muted-foreground leading-snug pt-0.5">
              Overnight gap — the most important consolidation point, not a sitting.
            </p>
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        {items.map((item, i) =>
          item.kind === 'sleep' ? (
            <SleepRow key={`sleep-${i}`} />
          ) : (
            <SittingRow
              key={item.sitting}
              sitting={item}
              schedule={schedule}
              currentSitting={currentSitting}
              defaultOpen={item.sitting === currentSitting}
              leftover={item.sitting === currentSitting ? leftover : null}
            />
          )
        )}
      </div>
    </div>
  );
}
