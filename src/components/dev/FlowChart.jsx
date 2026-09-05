import React from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';

// Ordered study phases — matches StudyFlow.jsx phase machine.
const PHASES = [
  { id: 'notes_offer', label: 'Skim notes?', group: 'Start' },
  { id: 'notes_skim', label: 'Notes skim', group: 'Start' },
  { id: 'critical', label: 'Critical recall', group: 'Block A' },
  { id: 'critical_summary', label: 'Critical summary', group: 'Block A' },
  { id: 'core', label: 'Core recall', group: 'Block B' },
  { id: 'core_summary', label: 'Core summary', group: 'Block B' },
  { id: 'passive', label: 'Passive skim', group: 'Block C' },
  { id: 'passive_summary', label: 'Passive summary', group: 'Block C' },
  { id: 'test', label: 'Practice test', group: 'Block D' },
  { id: 'test_summary', label: 'Test summary', group: 'Block D' },
  { id: 'confidence', label: 'Confidence sheet', group: 'Block E' },
];

export default function FlowChart({ currentStep }) {
  const currentIdx = PHASES.findIndex((p) => p.id === currentStep);

  return (
    <div className="flex flex-col">
      {PHASES.map((phase, i) => {
        const isPast = currentIdx > i;
        const isCurrent = currentIdx === i;
        const isFuture = currentIdx < i;
        const showGroup = i === 0 || PHASES[i - 1].group !== phase.group;

        return (
          <React.Fragment key={phase.id}>
            {showGroup && i > 0 && (
              <div className="ml-[15px] border-l-2 border-dashed border-border h-3" />
            )}
            {showGroup && (
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1 ml-1">
                {phase.group}
              </div>
            )}
            <div className="flex items-center gap-2.5 relative">
              {/* Connector + node */}
              {i > 0 && !showGroup && (
                <div
                  className={`absolute left-[15px] -top-[14px] w-0.5 h-3.5 ${
                    isPast ? 'bg-emerald-400' : 'bg-border'
                  }`}
                />
              )}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition ${
                  isCurrent
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isPast
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-card border-border text-muted-foreground'
                }`}
              >
                {isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isPast ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
              <div className="flex-1 py-1">
                <span
                  className={`text-xs font-medium ${
                    isCurrent
                      ? 'text-foreground'
                      : isPast
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50'
                  }`}
                >
                  {phase.label}
                </span>
                {isCurrent && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-foreground bg-muted px-1.5 py-0.5 rounded">
                    Here
                  </span>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}