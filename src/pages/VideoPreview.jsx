import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PracticeFlashcards from '@/components/practice/PracticeFlashcards';

const PSYCH_TERMS = [
  { id: 'hippocampus', term: 'Hippocampus', definition: 'The part of the brain that forms new memories.', mastery: 0 },
  { id: 'conditioning', term: 'Classical conditioning', definition: 'Learning by pairing two things that happen together.', mastery: 0 },
  { id: 'working-memory', term: 'Working memory', definition: 'The small workspace that holds what you are using right now.', mastery: 0 },
  { id: 'synapse', term: 'Synapse', definition: 'The gap where one neuron signals the next.', mastery: 0 },
  { id: 'cognitive-load', term: 'Cognitive load', definition: 'How much of that workspace a task is using.', mastery: 0 },
];

function PreviewHome({ onStart }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-start justify-between gap-3 px-5 pt-safe">
        <h1 className="min-w-0 text-4xl font-bold tracking-tight leading-[1.05] pt-1">
          bharris.app
        </h1>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground mb-4">
          <Timer className="w-6 h-6" />
        </div>
        <p className="text-3xl font-bold tracking-tight leading-tight">Good Evening, Smith</p>
        <p className="text-base text-muted-foreground mt-3 max-w-xs leading-relaxed">
          Ready when you are.
        </p>
      </div>

      <footer className="px-5 pb-safe pt-2">
        <div className="max-w-md mx-auto w-full flex flex-col items-stretch gap-3 pb-4">
          <Button onClick={onStart} className="h-14 rounded-full text-lg font-semibold">
            Start next session
          </Button>
        </div>
      </footer>
    </div>
  );
}

function PreviewCards({ onBack }) {
  const [terms, setTerms] = React.useState(PSYCH_TERMS);
  const updateTerm = React.useCallback((id, patch) => {
    setTerms((prev) => prev.map((term) => (term.id === id ? { ...term, ...patch } : term)));
  }, []);

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col">
      <header className="shrink-0 px-3 pt-safe pb-1 flex items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>
      <PracticeFlashcards
        terms={terms}
        onUpdateTerm={updateTerm}
        onDone={onBack}
        heading="Psych"
      />
    </div>
  );
}

export default function VideoPreview() {
  const [step, setStep] = React.useState('home');
  if (step === 'cards') return <PreviewCards onBack={() => setStep('home')} />;
  return <PreviewHome onStart={() => setStep('cards')} />;
}
