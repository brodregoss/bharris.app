import React from 'react';
import { Button } from '@/components/ui/button';
import { loadSpacedMetrics } from '@/lib/spacedMetrics';
import { modeTimeLine, sittingEventLine, spacedLogView } from '@/lib/spacedLogView';

export default function SpacedMetricsPanel() {
  const [log, setLog] = React.useState(() => loadSpacedMetrics());
  const [copied, setCopied] = React.useState(false);
  const view = spacedLogView(log);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Sitting log</h3>
      {view.sittings.length === 0 ? (
        <p className="text-[11px] text-slate-400">No sittings logged yet.</p>
      ) : (
        <ul className="text-[11px] text-slate-600 space-y-1 mb-2">
          {view.sittings.map((event, index) => (
            <li key={`${event.type}-${event.at || index}`}>{sittingEventLine(event)}</li>
          ))}
        </ul>
      )}
      <ul className="text-[11px] text-slate-600 space-y-1 mb-2">
        {view.modes.map((mode) => (
          <li key={mode.mode}>{modeTimeLine(mode)}</li>
        ))}
      </ul>
      <Button size="sm" variant="outline" onClick={copy}>
        {copied ? 'Copied' : 'Copy as JSON'}
      </Button>
      <button
        type="button"
        onClick={() => {
          setLog(loadSpacedMetrics());
          setCopied(false);
        }}
        className="ml-2 text-[11px] text-slate-400 underline underline-offset-2"
      >
        Refresh
      </button>
    </section>
  );
}
