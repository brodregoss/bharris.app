import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function BlockSummary({ title, message, onContinue, continueLabel = 'Continue' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
        <CheckCircle2 className="w-7 h-7 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8">{message}</p>
      <Button onClick={onContinue} className="h-12 px-8 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold">
        {continueLabel}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}