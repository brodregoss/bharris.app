import React from 'react';
import { Button } from '@/components/ui/button';
import { Brain, Moon, CheckCircle2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import RecallBlock from './RecallBlock';
import SleepTimePicker from './SleepTimePicker';
import { redoDeckPlan, retireThresholdForTier } from '@/lib/studyUtils';

// Screen E — final compressed pass over the still-shaky terms.
export default function ConfidenceSheet({
  terms,
  recallIds,
  examTiming,
  stillShaky,
  readiness,
  onUpdateTerm,
  onLogAttempt,
  onDone,
  onPractice,
  onRedo,
  stopTime,
  onSetStopTime,
  onOpenCheat,
}) {
  // shaky = (recall-queue critical/core never fully retired) ∪ (stillShaky from practice test).
  const shakyTerms = React.useMemo(() => {
    const set = new Set(stillShaky);
    const queued = recallIds instanceof Set ? recallIds : null;
    terms.forEach((t) => {
      if ((t.tier === 'critical' || t.tier === 'core') && (t.correctStreak || 0) < retireThresholdForTier(t.tier)) {
        if (!queued || queued.has(t.id)) set.add(t.id);
      }
    });
    return terms.filter((t) => set.has(t.id));
  }, [terms, stillShaky, recallIds]);

  const [view, setView] = React.useState('list'); // list | drill | final | pick
  const [editingStop, setEditingStop] = React.useState(false);
  const [extraIds, setExtraIds] = React.useState(() => new Set());
  const redoPlan = React.useMemo(
    () => redoDeckPlan(shakyTerms.map((t) => t.id), terms.map((t) => t.id)),
    [shakyTerms, terms]
  );
  const termById = React.useMemo(() => new Map(terms.map((t) => [t.id, t])), [terms]);

  const startRedo = () => {
    if (!redoPlan.ask) {
      onRedo?.(redoPlan.startIds);
      return;
    }
    setExtraIds(new Set());
    setView('pick');
  };

  const toggleExtra = (id) => {
    setExtraIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Ask once (non-today exams): the first time the user lands here with no stop
  // time, or when they explicitly choose to change it.
  const needStopTime = examTiming !== 'today' && (!stopTime || editingStop);

  if (needStopTime) {
    return (
      <div className="flex-1 flex flex-col items-center px-6 py-12 text-center overflow-y-auto">
        <div className="m-auto flex flex-col items-center w-full max-w-xs">
          <Moon className="w-10 h-10 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold tracking-tight mb-2">What time are you planning to sleep?</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Sleep locks in recall. Pick a hard stop so we don't let you cram past the point of returns.
          </p>
          <SleepTimePicker value={stopTime} onChange={(v) => onSetStopTime?.(v)} />
          <Button
            disabled={!stopTime}
            onClick={() => setEditingStop(false)}
            className="h-12 px-8 rounded-full font-semibold"
          >
            Set stop time
          </Button>
        </div>
      </div>
    );
  }

  if (view === 'drill') {
    return (
      <RecallBlock
        key="confidence-drill"
        terms={shakyTerms}
        singlePass
        retireThreshold={1}
        blockBudgetMs={5 * 60 * 1000}
        blockLabel="5-min drill"
        onUpdateTerm={onUpdateTerm}
        onLogAttempt={onLogAttempt}
        onOpenCheat={onOpenCheat}
        onDone={() => setView('final')}
      />
    );
  }

  if (view === 'pick') {
    const stillNeed = Math.max(0, redoPlan.required - extraIds.size);
    const locked = redoPlan.lockedIds.map((id) => termById.get(id)).filter(Boolean);
    const extras = redoPlan.extraIds.map((id) => termById.get(id)).filter(Boolean);
    return (
      <div className="flex-1 flex flex-col px-5 pt-4 min-h-0">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
          <h2 className="text-xl font-bold tracking-tight">Add a few more</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {locked.length
              ? `The hard ones stay in. Pick ${redoPlan.required} more so it isn't just one or two terms going around.`
              : `Pick at least ${redoPlan.required} terms so it isn't just one or two terms going around.`}
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {locked.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-card border border-border bg-surface-2 px-4 py-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 text-left">
                  <p className="text-sm font-semibold">{t.term}</p>
                  <p className="text-xs text-muted-foreground">Hard one · already in</p>
                </div>
              </div>
            ))}
            {extras.map((t) => {
              const on = extraIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleExtra(t.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-card border px-3 py-3 text-left transition',
                    on ? 'border-foreground bg-card' : 'option-surface'
                  )}
                >
                  <span className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    on ? 'border-foreground bg-foreground text-background' : 'border-border'
                  )}>
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t.term}</span>
                    <span className="block text-xs text-muted-foreground truncate">{t.definition}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            disabled={stillNeed > 0}
            onClick={() => onRedo?.([...redoPlan.lockedIds, ...extraIds])}
            className="w-full h-12 rounded-full font-semibold"
          >
            {stillNeed > 0 ? `Pick ${stillNeed} more` : 'Start session'}
          </Button>
          <button
            type="button"
            onClick={() => setView('final')}
            className="mt-3 mb-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (view === 'final') {
    const title = examTiming === '2days' ? 'Day 1 done.' : "You're as ready as you'll be.";
    const body =
      examTiming === '2days'
        ? 'Pick up tomorrow with a quick re-check of everything, since some of this will fade overnight — that\u2019s normal.'
        : 'Recall locks in after rest. You\u2019ve put in the work — go in calm.';
    return (
      <div className="flex-1 flex flex-col px-5 pt-4 overflow-y-auto">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col items-center text-center pt-4">
          <div className="w-14 h-14 rounded-full bg-gain-soft text-gain flex items-center justify-center mb-5">
            <CheckCircle2 className="h-8 w-8 text-know" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">{body}</p>
          <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-sm mb-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Test readiness</p>
            <p className="text-5xl font-bold tracking-tight mt-1">{readiness}%</p>
          </div>
          {shakyTerms.length > 0 && (
            <div className="w-full rounded-card border border-border bg-card p-4 mb-4 text-left">
              <p className="text-xs font-semibold mb-2">Still shaky ({shakyTerms.length})</p>
              <div className="space-y-1.5">
                {shakyTerms.map((t) => (
                  <div key={t.id} className="text-xs">
                    <span className="font-medium">{t.term}</span>
                    <span className="text-muted-foreground"> — {t.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="w-full flex flex-col gap-2">
            <Button
              type="button"
              onClick={onPractice}
              className="w-full h-12 rounded-full font-semibold"
            >
              Self Practice 
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={startRedo}
              className="w-full h-12 rounded-full font-semibold"
            >
              Retry Hard Terms
            </Button>
            <button
              type="button"
              onClick={onDone}
              className="mt-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // list view
  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold tracking-tight">Confidence sheet</h2>
          <span className="text-body font-semibold text-know">{readiness}%</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {shakyTerms.length} terms still shaky — no new material, just these.
        </p>
        {examTiming !== 'today' && stopTime && (
          <button
            type="button"
            onClick={() => setEditingStop(true)}
            className="self-start text-[11px] text-muted-foreground underline-offset-4 hover:underline mb-3"
          >
            Sleep time: {stopTime} · change
          </button>
        )}
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {shakyTerms.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold">{t.term}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.definition}</p>
            </div>
          ))}
          {shakyTerms.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nothing shaky — you're solid.</p>
          )}
        </div>
        {shakyTerms.length === 0 ? (
          <Button
            onClick={() => setView('final')}
            className="w-full h-12 rounded-full font-semibold"
          >
            Finish up
          </Button>
        ) : (
          <Button
            onClick={() => setView('drill')}
            className="w-full h-12 rounded-full font-semibold"
          >
            <Brain className="w-4 h-4 mr-2" /> 5-min drill
          </Button>
        )}
      </div>
    </div>
  );
}