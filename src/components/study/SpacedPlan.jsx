import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { examTimingPlanCopy, sittingWhenLabel } from '@/lib/spacedCram';

function sessionSummary(session) {
  const reviewN = session.reviews.length;
  const newN = session.news.length;
  const reviewBit = reviewN ? `${reviewN} review${reviewN === 1 ? '' : 's'}` : null;
  const newBit = `${newN} new`;
  return reviewBit ? `${reviewBit} · ${newBit}` : newBit;
}

function TermList({ label, terms }) {
  if (!terms.length) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <ul className="space-y-1">
        {terms.map((t) => (
          <li key={t.id} className="text-sm leading-snug">
            {t.term}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SessionCard({ session, examTiming, currentSitting, defaultOpen }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isCurrent = session.sitting === currentSitting;
  const when = sittingWhenLabel(examTiming, session.sitting);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'rounded-2xl border shadow-sm overflow-hidden',
          isCurrent ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border bg-card'
        )}
      >
        <CollapsibleTrigger className="w-full text-left px-4 py-3 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-base font-bold tracking-tight">Sitting {session.sitting}</p>
              {isCurrent && (
                <span className="text-[10px] uppercase tracking-wide font-semibold text-primary">
                  Up next
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {when} · {sessionSummary(session)}
            </p>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 shrink-0 text-muted-foreground mt-1 transition-transform',
              open && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3 border-t border-border/60 pt-3">
            <TermList label="Review" terms={session.reviews} />
            <TermList label="New" terms={session.news} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function SpacedPlan({ forecast, examTiming, currentSitting = 1 }) {
  const sessions = forecast?.sessions || [];
  const sittingN = sessions.length;
  const copy = examTimingPlanCopy(examTiming);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your study plan</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {sittingN} sitting{sittingN === 1 ? '' : 's'} {copy}. Highest-priority terms first.
          Each sitting is flashcards — if a term keeps slipping (3 misses), you write your own
          definition, then drill those again. Later sittings bring earlier terms back as reviews,
          plus a new batch.
        </p>
      </div>
      {sessions.map((session) => (
        <SessionCard
          key={session.sitting}
          session={session}
          examTiming={examTiming}
          currentSitting={currentSitting}
          defaultOpen={currentSitting === 1 || session.sitting === currentSitting}
        />
      ))}
    </div>
  );
}
