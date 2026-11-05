import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  onBack,
  children,
  footer,
}) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-5 pt-safe">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="h-11" />
        )}
      </header>

      <main className="flex-1 px-6 pb-safe flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <div className="pt-6 pb-8 text-center">
            {eyebrow && (
              <p className="text-sm font-medium tracking-wide text-muted-foreground">{eyebrow}</p>
            )}
            <h1 className="mt-3 text-display text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base text-muted-foreground mt-4">{subtitle}</p>
            )}
          </div>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
