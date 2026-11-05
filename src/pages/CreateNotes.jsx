import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { saveManualNote } from '@/lib/notesUpload';
import { hasAiConsent, setAiConsent } from '@/lib/aiConsent';
import AiConsentModal from '@/components/account/AiConsentModal';

function blankTerm() {
  return { id: `m${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, term: '', definition: '' };
}

function fitDefinitionBox(el) {
  if (!el) return;
  el.style.height = 'auto';
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + border}px`;
}

function DefinitionBox({ value, onChange }) {
  const ref = React.useRef(null);

  React.useLayoutEffect(() => {
    fitDefinitionBox(ref.current);
  }, [value]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder="Definition"
      rows={2}
      className="min-h-[72px] resize-none overflow-hidden rounded-xl"
    />
  );
}

export default function CreateNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state?.source;
  const [title, setTitle] = React.useState(() => (
    incoming?.kind === 'manual' && incoming.title && incoming.title !== 'My notes'
      ? incoming.title
      : ''
  ));
  const [saving, setSaving] = React.useState(false);
  const [showAiConsent, setShowAiConsent] = React.useState(false);
  const [items, setItems] = React.useState(() => {
    if (incoming?.kind === 'manual' && incoming.items?.length) {
      return incoming.items.map((t, i) => ({
        id: t.id || `m${i}`,
        term: t.term || '',
        definition: t.definition || '',
      }));
    }
    return [blankTerm()];
  });

  const filled = items.filter((t) => t.term.trim() && t.definition.trim());
  const trimmedTitle = title.trim();
  const canContinue = filled.length > 0 && trimmedTitle.length > 0;

  const update = (id, patch) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const remove = (id) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)));
  };

  const proceedToSetup = async () => {
    setSaving(true);
    const nextItems = filled.map((t, i) => ({
      id: t.id || `m${i}`,
      term: t.term.trim(),
      definition: t.definition.trim(),
    }));
    let noteId = incoming?.noteId || '';
    try {
      const note = await saveManualNote({
        title: trimmedTitle,
        terms: nextItems,
        noteId,
      });
      noteId = note?.id || noteId;
    } catch {
      // Setup still works from in-memory terms if the note doesn't persist.
    }
    navigate('/setup', {
      state: {
        source: {
          kind: 'manual',
          title: trimmedTitle,
          terms: nextItems.length,
          items: nextItems,
          noteId,
        },
      },
    });
  };

  const continueSetup = async () => {
    if (!canContinue || saving) return;
    if (!hasAiConsent()) {
      setShowAiConsent(true);
      return;
    }
    proceedToSetup();
  };

  const handleAiConsentAccept = () => {
    setAiConsent(true);
    setShowAiConsent(false);
    proceedToSetup();
  };

  const handleAiConsentDecline = () => {
    setAiConsent(false);
    setShowAiConsent(false);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <AiConsentModal
        open={showAiConsent}
        onAccept={handleAiConsentAccept}
        onDecline={handleAiConsentDecline}
      />
      <header className="px-5 pt-safe">
        <button
          type="button"
          onClick={() => navigate('/welcome')}
          aria-label="Back"
          className="flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="mt-6 text-display text-foreground">Create terms</h1>
        <p className="mt-3 text-sm text-muted-foreground">Name the set, then add the terms you need</p>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pt-5">
        <div className="max-w-md mx-auto w-full space-y-3 pb-4">
          <div className="rounded-card border border-border bg-card p-4 space-y-2 shadow-sm">
            <Label htmlFor="set-title" className="text-xs font-medium text-muted-foreground">Title</Label>
            <Input
              id="set-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Psych chapter 4"
              className="h-11 rounded-full font-semibold"
              autoComplete="off"
            />
          </div>
          {items.map((item, i) => (
            <div key={item.id} className="rounded-card border border-border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Term {i + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label="Remove term"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Input
                value={item.term}
                onChange={(e) => update(item.id, { term: e.target.value })}
                placeholder="Term"
                className="h-11 rounded-full"
              />
              <DefinitionBox
                value={item.definition}
                onChange={(e) => update(item.id, { definition: e.target.value })}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, blankTerm()])}
            className="w-full h-11 rounded-full border border-dashed border-border bg-card text-sm font-medium text-foreground hover:border-muted-foreground flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add term
          </button>
        </div>
      </main>

      <footer className="px-6 pt-2 pb-safe">
        <div className="max-w-md mx-auto w-full">
          <Button
            size="lg"
            disabled={!canContinue || saving}
            onClick={continueSetup}
            className={cn(
              'w-full h-14 rounded-full text-base font-semibold transition-all',
              canContinue
                ? 'shadow-lg'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {saving ? 'Saving…' : 'Continue'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
