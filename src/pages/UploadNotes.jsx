import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Moon, FileText, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SAMPLE_NOTES } from '@/lib/sampleNotes';

function UploadNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state?.source;
  const [selected, setSelected] = React.useState(() => (
    incoming?.kind === 'sample' ? incoming : null
  ));

  const pickSample = (s) => setSelected({ kind: 'sample', ...s });

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-foreground flex flex-col">
      <header className="px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => navigate('/welcome')}
          aria-label="Back"
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 text-white">
          <Moon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none">Last Minute Study</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">Use some of ours</p>
        </div>
      </header>

      <main className="flex-1 px-6 pt-4 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight mb-1">Use some of ours</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Grab a sample set to get moving right away.
          </p>

          <div className="space-y-3">
            {SAMPLE_NOTES.map((s) => {
              const active = selected?.kind === 'sample' && selected.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSample(s)}
                  className={cn(
                    'w-full text-left rounded-2xl border p-4 flex items-start gap-3 transition',
                    active
                      ? 'border-slate-900 bg-slate-900/5'
                      : 'border-border bg-card hover:border-slate-400'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-slate-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{s.title}</span>
                      {active && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.meta}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{s.terms} terms</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="px-6 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto w-full">
          <Button
            size="lg"
            disabled={!selected}
            onClick={() => navigate('/setup', { state: { source: selected } })}
            className={cn(
              'w-full h-14 rounded-2xl text-base font-semibold transition-all',
              selected
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20'
                : 'bg-muted text-muted-foreground'
            )}
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default UploadNotes;
