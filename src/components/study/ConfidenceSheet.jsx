import React from 'react';
import { Button } from '@/components/ui/button';
import { Brain, Moon, CheckCircle2 } from 'lucide-react';
import RecallBlock from './RecallBlock';
import SleepTimePicker from './SleepTimePicker';
import { retireThresholdForTier } from '@/lib/studyUtils';

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

  const [view, setView] = React.useState('list'); // list | drill | final
  const [editingStop, setEditingStop] = React.useState(false);

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
            className="h-12 px-8 rounded-2xl font-semibold"
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

  if (view === 'final') {
    const title = examTiming === '2days' ? 'Day 1 done.' : "You're as ready as you'll be.";
    const body =
      examTiming === '2days'
        ? 'Pick up tomorrow with a quick re-check of everything, since some of this will fade overnight — that\u2019s normal.'
        : 'Recall locks in after rest. You\u2019ve put in the work — go in calm.';
    return (
      <div className="flex-1 flex flex-col px-5 pt-4 overflow-y-auto">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col items-center text-center pt-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">{body}</p>
          <div className="w-full rounded-3xl border border-border bg-card p-6 shadow-sm mb-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Test readiness</p>
            <p className="text-5xl font-bold tracking-tight mt-1">{readiness}%</p>
          </div>
          {shakyTerms.length > 0 && (
            <div className="w-full rounded-2xl border border-border bg-card p-4 mb-4 text-left">
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
          <Button
            onClick={onDone}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Done
          </Button>
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
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{readiness}%</span>
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
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Finish up
          </Button>
        ) : (
          <Button
            onClick={() => setView('drill')}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            <Brain className="w-4 h-4 mr-2" /> 5-min drill
          </Button>
        )}
      </div>
    </div>
  );
}