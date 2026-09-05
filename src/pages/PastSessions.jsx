import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Minimal destination for the history icon + "Past sessions" link. Stats,
// streaks, and readiness scores live here (one tap deeper than the landing),
// not on the home screen.
export default function PastSessions() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-safe pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold tracking-tight">Past sessions</h1>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <History className="w-8 h-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No past sessions yet.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Completed crams will show up here.</p>
      </div>
    </div>
  );
}