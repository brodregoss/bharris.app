import React from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';

// Ordered study phases — matches StudyFlow.jsx phase machine.
const PHASES = [
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
              <div className="ml-[15px] border-l-2 border-dashed border-slate-200 h-3" />
            )}
            {showGroup && (
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 ml-1">
                {phase.group}
              </div>
            )}
            <div className="flex items-center gap-2.5 relative">
              {/* Connector + node */}
              {i > 0 && !showGroup && (
                <div
                  className={`absolute left-[15px] -top-[14px] w-0.5 h-3.5 ${
                    isPast ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                />
              )}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition ${
                  isCurrent
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : isPast
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white border-slate-200 text-slate-300'
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
                      ? 'text-slate-900'
                      : isPast
                      ? 'text-slate-500'
                      : 'text-slate-300'
                  }`}
                >
                  {phase.label}
                </span>
                {isCurrent && (
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
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