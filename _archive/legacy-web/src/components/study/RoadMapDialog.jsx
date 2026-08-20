import React from 'react';
import { Map } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import FlowChart from '@/components/dev/FlowChart';
import { priority } from '@/lib/studyUtils';

const TERM_COLS = [
  ['term', 'Term'],
  ['tier', 'Tier'],
  ['confidence', 'Conf'],
  ['priority', 'Pri'],
  ['correctStreak', 'Streak'],
];

export default function RoadMapDialog({ terms, phase }) {
  const [open, setOpen] = React.useState(false);
  const [sortKey, setSortKey] = React.useState('tier');
  const [sortDir, setSortDir] = React.useState('asc');

  const sorted = React.useMemo(() => {
    const arr = [...(terms || [])];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'priority':
          av = priority(a);
          bv = priority(b);
          break;
        case 'correctStreak':
          av = a.correctStreak || 0;
          bv = b.correctStreak || 0;
          break;
        case 'confidence':
          av = a.confidence || '';
          bv = b.confidence || '';
          break;
        case 'tier':
        default:
          av = a.tier || '';
          bv = b.tier || '';
          break;
      }
      if (typeof av === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [terms, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition"
        >
          road map
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[88dvh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Map className="w-4 h-4" /> Session road map
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <section className="shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Session flow
            </h3>
            <div className="rounded-xl border border-border p-3">
              <FlowChart currentStep={phase} />
            </div>
          </section>

          <section className="shrink-0">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
              Terms ({sorted.length})
            </h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="max-h-[36dvh] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {TERM_COLS.map(([key, label]) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className="px-2 py-1.5 text-left font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                        >
                          {label}
                          {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sorted.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/50">
                        <td className="px-2 py-1.5 font-medium text-foreground max-w-[140px] truncate">
                          {t.term}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{t.tier}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{t.confidence}</td>
                        <td className="px-2 py-1.5 text-muted-foreground tabular-nums">
                          {priority(t).toFixed(2)}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground tabular-nums">
                          {t.correctStreak || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}