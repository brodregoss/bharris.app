import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function BlockSummary({ title, message, onContinue, continueLabel = 'Continue' }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8">{message}</p>
      <Button onClick={onContinue} className="h-12 px-8 rounded-2xl font-semibold">
        {continueLabel}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}