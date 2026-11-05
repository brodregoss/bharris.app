import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Clock, Brain } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fmtTime } from '@/lib/studyUtils';

export default function StudyHeader({ readiness, timeRemainingMs, blockLabel }) {
  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-border bg-background px-5 pb-3 pt-safe">
      <Link
        to="/"
        aria-label="Home"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition hover:bg-white/20"
      >
        <Home className="w-4 h-4" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none truncate">{blockLabel || 'Study session'}</p>
        <p className="text-xs font-bold tracking-tight leading-none mt-1">bharris.app</p>
      </div>
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center min-h-11 min-w-11 gap-1.5 shrink-0 focus:outline-none cursor-pointer"
              aria-label="What does readiness mean?"
            >
              <Brain className="w-3.5 h-3.5 text-gain" />
              <span className="text-sm font-bold">{readiness}%</span>
              <span className="hidden sm:inline text-[10px] text-muted-foreground">ready</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 text-xs leading-relaxed" side="bottom" align="end">
            <p className="font-semibold mb-1">Readiness score</p>
            <p className="text-muted-foreground">
              How ready you are for the exam, based on how well you've recalled each term so far this session.
            </p>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-semibold tabular-nums">{fmtTime(timeRemainingMs)}</span>
          <span className="hidden sm:inline text-[10px] text-muted-foreground">left</span>
        </div>
      </div>
    </header>
  );
}