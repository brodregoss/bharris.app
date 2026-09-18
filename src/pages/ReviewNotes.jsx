import React from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { extractTermsFromPhotos, generateDefinitions, regenerateDefinition } from '@/lib/extractNotes';
import { peekPhotos, peekPhoto, clearPhoto } from '@/lib/imageData';
import { patchNote, saveManualNote } from '@/lib/notesUpload';

function photosFor(source) {
  const stashed = peekPhotos();
  if (stashed.length) return stashed;
  if (Array.isArray(source?.images) && source.images.length) return source.images.filter(Boolean);
  if (source?.image) return [source.image];
  const one = peekPhoto();
  return one ? [one] : [];
}

export default function ReviewNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const source = location.state?.source;
  const setup = location.state?.setup;
  const [title, setTitle] = React.useState(() => (
    source?.title && source.title !== 'Your notes' ? source.title : ''
  ));
  const [saving, setSaving] = React.useState(false);

  const [items, setItems] = React.useState(() => {
    if (!source?.items?.length) return [];
    return source.items.map((t, i) => ({
      id: t.id || `r${i}`,
      term: t.term || '',
      definition: t.definition || '',
      difficulty: t.difficulty,
      depends_on: t.depends_on,
    }));
  });
  const [extracting, setExtracting] = React.useState(
    () => source?.kind === 'photo' && !source?.items?.length && photosFor(source).length > 0
  );
  const [extractHint, setExtractHint] = React.useState('Finding terms…');
  const [extractError, setExtractError] = React.useState('');
  const [regenId, setRegenId] = React.useState(null);
  const foundRef = React.useRef(null);
  const ranExtract = React.useRef(false);

  const update = (id, patch) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const remove = (id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  };

  const addTerm = () => {
    setItems((prev) => [
      ...prev,
      { id: `r${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, term: '', definition: '' },
    ]);
  };

  const strippedSource = (nextItems) => {
    const { image, ...rest } = source || {};
    return {
      ...rest,
      kind: rest.kind || 'photo',
      title: (title || rest.title || '').trim(),
      terms: nextItems.length,
      items: nextItems,
      noteId: rest.noteId || source?.noteId,
    };
  };

  const runExtract = React.useCallback(async () => {
    const images = photosFor(source);
    if (!images.length) return;
    setExtracting(true);
    setExtractError('');
    try {
      let found = foundRef.current;
      if (!found?.length) {
        setExtractHint('Finding terms…');
        found = await extractTermsFromPhotos(images, setExtractHint);
        foundRef.current = found;
      }
      setExtractHint('Writing definitions…');
      const withDefs = await generateDefinitions(found, setExtractHint);
      setItems(withDefs);
      if (source?.noteId) {
        const transcript = found
          .map((t) => `${t.term}${t.notes ? `: ${t.notes}` : ''}`)
          .join('\n');
        patchNote(source.noteId, { transcript }).catch(() => {});
      }
      setExtracting(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/password|limit is used|isn’t available|upgrade|quota|sign in/i.test(message)) {
        setExtractError(message);
      } else if (message === 'empty terms') {
        setExtractError('No terms turned up on that page. Try a clearer shot, or add them by hand.');
      } else {
        setExtractError(message || "Couldn't read terms from that photo. Try again, or take a clearer shot.");
      }
      setExtracting(false);
    }
  }, [source]);

  React.useEffect(() => {
    if (ranExtract.current) return;
    const images = photosFor(source);
    if (source?.kind === 'photo' && !source?.items?.length && images.length) {
      ranExtract.current = true;
      runExtract();
    }
  }, [source, runExtract]);

  if (!source) {
    return <Navigate to="/welcome" replace />;
  }

  const filled = items.filter((t) => t.term.trim() && t.definition.trim());
  const trimmedTitle = title.trim();

  const continueSetup = async () => {
    if (!filled.length || !trimmedTitle || extracting || saving) return;
    setSaving(true);
    const nextItems = filled.map((t, i) => ({
      id: t.id || `r${i}`,
      term: t.term.trim(),
      definition: t.definition.trim(),
      difficulty: t.difficulty,
      depends_on: t.depends_on,
    }));
    let noteId = source?.noteId || '';
    try {
      if (noteId) {
        await patchNote(noteId, {
          title: trimmedTitle,
          transcript: JSON.stringify({ terms: nextItems }),
        });
      } else {
        const note = await saveManualNote({ title: trimmedTitle, terms: nextItems });
        noteId = note?.id || '';
      }
    } catch {
      // Setup still works from in-memory terms if the note doesn't persist.
    }
    navigate('/setup', {
      state: {
        setup,
        source: {
          ...strippedSource(nextItems),
          title: trimmedTitle,
          noteId,
        },
      },
    });
    clearPhoto();
  };

  const goBack = () => {
    if (extracting) {
      clearPhoto();
      navigate('/welcome');
      return;
    }
    if (setup) {
      if (filled.length) continueSetup();
      else {
        clearPhoto();
        navigate('/setup', { state: { setup, source: strippedSource([]) } });
      }
      return;
    }
    clearPhoto();
    navigate('/welcome');
  };

  const regen = async (item) => {
    if (regenId) return;
    setRegenId(item.id);
    try {
      const definition = await regenerateDefinition({
        term: item.term.trim(),
        definition: item.definition.trim(),
      });
      update(item.id, { definition });
    } catch {
      // leave the current definition
    }
    setRegenId(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-3 pt-safe pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold tracking-tight leading-none truncate">
            Review notes
          </h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">
            {extracting
              ? extractHint
              : items.length
                ? `${items.length} terms — name the set, then edit anything that looks off`
                : 'No terms to look over yet'}
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 pt-3 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-3 pb-4">
          {extracting ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              <p className="text-sm font-medium">{extractHint}</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Reading your photo{photosFor(source).length > 1 ? 's' : ''}, then writing a short definition for each term.
              </p>
            </div>
          ) : extractError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <p className="text-sm font-medium">Couldn't read that photo</p>
              <p className="text-xs text-muted-foreground max-w-xs">{extractError}</p>
              <Button
                type="button"
                onClick={() => {
                  ranExtract.current = true;
                  runExtract();
                }}
                className="mt-2 rounded-2xl"
              >
                Try again
              </Button>
              <button
                type="button"
                onClick={() => {
                  clearPhoto();
                  navigate('/welcome');
                }}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Choose a different photo
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-sm">
                <p className="text-xs font-medium text-muted-foreground">Title</p>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bio lecture 3"
                  className="h-11 rounded-xl font-semibold"
                  autoComplete="off"
                />
              </div>
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No terms to look over yet.
                </p>
              )}
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm"
                >
                  <p className="text-xs font-medium text-muted-foreground">Term {i + 1}</p>
                  <Input
                    value={item.term}
                    onChange={(e) => update(item.id, { term: e.target.value })}
                    placeholder="Term"
                    className="h-11 rounded-xl font-semibold"
                  />
                  <Textarea
                    value={item.definition}
                    onChange={(e) => update(item.id, { definition: e.target.value })}
                    placeholder="Definition"
                    className="min-h-[72px] rounded-xl"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => regen(item)}
                      disabled={!!regenId || !item.term.trim()}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      {regenId === item.id ? 'Regenerating…' : 'Regenerate definition'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addTerm}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline px-1"
              >
                Add a missed term
              </button>
            </>
          )}
        </div>
      </main>

      <footer className="px-6 pt-2 pb-safe">
        <div className="max-w-md mx-auto w-full">
          <Button
            size="lg"
            disabled={!filled.length || !trimmedTitle || extracting || saving}
            onClick={continueSetup}
            className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg"
          >
            <Check className="w-5 h-5 mr-2" />
            {saving ? 'Saving…' : 'Looks good'}
          </Button>
        </div>
      </footer>
    </div>
  );
}
