import React from 'react';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TermDefList from './TermDefList';

export function NotesOfferPrompt({ onSkim, onSkip }) {
  return (
    <div className="w-full flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-5">
        <BookOpen className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">Skim your notes first?</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8">
        Quick look at every term and definition before flashcards start. You can skip and jump straight in.
      </p>
      <div className="w-full max-w-xs space-y-3">
        <Button type="button" onClick={onSkim} className="w-full h-12 rounded-2xl font-semibold">
          Skim notes
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full min-h-11 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Skip — start flashcards
        </button>
      </div>
    </div>
  );
}

export function NotesSkim({ terms, onDone }) {
  return (
    <div className="flex flex-col px-5 pt-4 pb-4">
      <div className="max-w-md mx-auto w-full">
        <h2 className="text-xl font-bold tracking-tight mb-1">Your notes</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Every term and definition. Scroll through, then start flashcards when you’re ready.
        </p>
        <div className="mb-4">
          <TermDefList terms={terms} />
        </div>
        <Button type="button" onClick={onDone} className="w-full h-12 rounded-2xl font-semibold">
          Start flashcards
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
