import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Minimal destination for the settings icon. Kept intentionally light so the
// home screen's top-corner control always goes somewhere functional — but it
// also houses the "why" behind the app's quieter behaviors for the curious.
export default function Settings() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold tracking-tight">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <div className="max-w-md mx-auto">
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold tracking-tight">Why we ask when you're sleeping</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your brain does real work locking in what you studied <em>while you sleep</em> — this is called
              memory consolidation. Cramming more new material in the last 30–45 minutes before bed usually
              doesn't help, and can even cost you sleep that would have helped more. So once you're close to
              your stop time, we stop introducing new material and just help you review what's already shaky.
              You're always free to keep going — we just won't push new stuff on you that late.
            </p>
          </section>
          <p className="text-[11px] text-muted-foreground text-center mt-8">Version 1.0.1</p>
        </div>
      </div>
    </div>
  );
}