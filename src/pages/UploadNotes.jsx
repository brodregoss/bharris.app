import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Moon, Camera, FileText, Check, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SAMPLE_NOTES = [
  {
    id: 'psych-101',
    title: 'Psych 101 — Core Concepts',
    meta: 'Classical & operant conditioning, memory, perception',
    terms: 24,
  },
  {
    id: 'test-sample',
    title: 'Sample Test Notes',
    meta: 'Mixed terms for demo: cognition, biology, stats',
    terms: 18,
  },
];

function UploadNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const setup = location.state?.setup;
  const [selected, setSelected] = React.useState(null); // { kind, ... }

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSelected({ kind: 'photo', name: file.name, url });
  };

  const pickSample = (s) => setSelected({ kind: 'sample', ...s });

  const clear = () => {
    if (selected?.kind === 'photo') URL.revokeObjectURL(selected.url);
    setSelected(null);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-foreground flex flex-col">
      {/* Header */}
      <header className="px-6 pt-safe pb-2 flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 text-white">
          <Moon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none">Last Minute Study</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">Cram smarter, not harder</p>
        </div>
      </header>

      <main className="flex-1 px-6 pt-4 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight mb-1">Upload your notes</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Snap a photo of your notes, or grab a sample set to test the app.
          </p>

          {/* Photo upload */}
          <button
            type="button"
            onClick={() => document.getElementById('photo-input').click()}
            className={cn(
              'w-full rounded-2xl border-2 border-dashed p-6 flex flex-col items-center gap-2 transition',
              selected?.kind === 'photo'
                ? 'border-slate-900 bg-slate-900/5'
                : 'border-border bg-card hover:border-slate-400'
            )}
          >
            <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center">
              <Camera className="w-5 h-5 text-slate-700" />
            </div>
            <span className="text-sm font-semibold">Take or upload a photo</span>
            <span className="text-xs text-muted-foreground">JPG / PNG · your handwritten or printed notes</span>
          </button>
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={pickPhoto}
          />

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or use sample notes</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Sample notes */}
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

          {/* Selected preview */}
          {selected && (
            <div className="mt-5 rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
              {selected.kind === 'photo' ? (
                <img src={selected.url} alt="notes" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-700" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {selected.kind === 'photo' ? 'Photo selected' : selected.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.kind === 'photo' ? selected.name : `${selected.terms} sample terms`}
                </p>
              </div>
              <button onClick={clear} className="p-1.5 rounded-lg hover:bg-accent" aria-label="remove">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer CTA */}
      <footer className="px-6 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto w-full">
          <Button
            size="lg"
            disabled={!selected}
            onClick={() => navigate('/triage', { state: { source: selected, setup } })}
            className={cn(
              'w-full h-14 rounded-2xl text-base font-semibold transition-all',
              selected
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20'
                : 'bg-muted text-muted-foreground'
            )}
          >
            Start Triage
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default UploadNotes;