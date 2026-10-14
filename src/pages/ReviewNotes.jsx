import React from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { extractTermsFromPhotos, generateDefinitions, regenerateDefinition } from '@/lib/extractNotes';
import { peekPhotos, peekPhoto, peekExtractPlan, clearPhoto } from '@/lib/imageData';
import { patchNote, saveManualNote } from '@/lib/notesUpload';
import { adsEnabledFor } from '@/lib/adAccess';
import { watchAdForCredit } from '@/lib/adCredit';
import { endRewarded, publishRewardProgress, showRewarded } from '@/lib/ads';
import { getCurrentUser, subscribeAccount } from '@/lib/accountStore';
import {
  addExtractPass,
  formatExtractRemaining,
  planDefinitions,
  snapshotExtractProgress,
  startExtractProgress,
} from '@/lib/extractProgress';

function photosFor(source) {
  const plan = peekExtractPlan();
  if (plan?.length) return plan;
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
  const readLocked = source?.kind === 'photo' && !source?.items?.length && photosFor(source).length > 0;
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
  const [extracting, setExtracting] = React.useState(() => readLocked);
  const [extractHint, setExtractHint] = React.useState('Finding terms…');
  const [extractError, setExtractError] = React.useState('');
  const [regenId, setRegenId] = React.useState(null);
  const [creditBusy, setCreditBusy] = React.useState(false);
  const [bar, setBar] = React.useState({ fraction: 0, remainingMs: null });
  const ranExtract = React.useRef(false);
  const progressRef = React.useRef(null);

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
    progressRef.current = startExtractProgress(images.length);
    setBar(snapshotExtractProgress(progressRef.current));
    setExtracting(true);
    setExtractError('');
    try {
      setExtractHint('Finding terms…');
      const found = await extractTermsFromPhotos(images, (msg) => {
        setExtractHint(msg);
        if (/Looking for more/i.test(msg)) {
          progressRef.current = addExtractPass(progressRef.current);
        }
      });
      progressRef.current = planDefinitions(progressRef.current, found.length);
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

  React.useEffect(() => {
    if (!extracting) {
      publishRewardProgress(null);
      return undefined;
    }
    const publish = () => {
      const snap = snapshotExtractProgress(progressRef.current);
      setBar(snap);
      if (adsEnabledFor(getCurrentUser())) {
        publishRewardProgress({
          fraction: snap.fraction,
          label: formatExtractRemaining(snap.remainingMs),
        });
      }
    };
    publish();
    const id = window.setInterval(publish, 250);
    return () => window.clearInterval(id);
  }, [extracting]);

  React.useEffect(() => subscribeAccount(() => {
    const next = getCurrentUser();
    if (!next?.hasBudget) return;
    setExtractError((current) => (
      /limit is used/i.test(current) ? '10 AI calls added. Try again.' : current
    ));
  }), []);

  React.useEffect(() => {
    if (!extracting || !adsEnabledFor(getCurrentUser())) return undefined;
    showRewarded('review', { prompted: true, withProgress: true });
    return () => {
      endRewarded();
    };
  }, [extracting]);

  if (!source) {
    return <Navigate to="/welcome" replace />;
  }

  const watchForCredit = async () => {
    setCreditBusy(true);
    try {
      const data = await watchAdForCredit();
      if (!data?.granted) return;
      setExtractError('');
      runExtract();
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Could not add that AI call.');
    } finally {
      setCreditBusy(false);
    }
  };

  const filled = items.filter((t) => t.term.trim() && t.definition.trim());
  const trimmedTitle = title.trim();
  const showPageBar = extracting && !extractError && !adsEnabledFor(getCurrentUser());
  const quotaUsedUp = /limit is used/i.test(extractError) && adsEnabledFor(getCurrentUser());
  const callAdded = extractError === '10 AI calls added. Try again.';

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

  const backToHighlights = () => {
    navigate('/highlight-notes', { state: { source } });
  };

  const goBack = () => {
    if (extracting || extractError) {
      backToHighlights();
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
      <header className={`px-3 pb-2 flex items-center gap-1 ${showPageBar ? 'pt-[calc(env(safe-area-inset-top)+4.25rem)]' : 'pt-safe'}`}>
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

      {showPageBar && (
        <div className="fixed top-0 inset-x-0 z-[90] bg-background px-5 pt-safe pb-2">
          <div
            className="h-1.5 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(bar.fraction * 100)}
            aria-label="Notes generating"
          >
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-300"
              style={{ width: `${Math.round(bar.fraction * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            {formatExtractRemaining(bar.remainingMs)}
          </p>
        </div>
      )}

      <main className="flex-1 px-5 pt-3 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-3 pb-4">
          {extracting && !extractError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              <p className="text-sm font-medium">{extractHint}</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {photosFor(source).some((item) => item?.scoped)
                  ? 'Reading the areas you highlighted, then writing a short definition for each term.'
                  : `Reading your photo${photosFor(source).length > 1 ? 's' : ''}, then writing a short definition for each term.`}
              </p>
            </div>
          ) : extractError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <p className="text-sm font-medium">
                {quotaUsedUp
                  ? 'This month’s AI limit is used up.'
                  : callAdded
                    ? '10 AI calls added.'
                    : "Couldn't read that photo"}
              </p>
              {!callAdded && (
                <p className="text-xs text-muted-foreground max-w-xs">{extractError}</p>
              )}
              {quotaUsedUp && (
                <Button
                  type="button"
                  onClick={watchForCredit}
                  disabled={creditBusy}
                  className="mt-2 rounded-2xl"
                >
                  {creditBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Watch an ad for 10 more calls'}
                </Button>
              )}
              <Button
                type="button"
                variant={quotaUsedUp ? 'outline' : 'default'}
                onClick={() => runExtract()}
                className="mt-2 rounded-2xl"
              >
                Try again
              </Button>
              <button
                type="button"
                onClick={backToHighlights}
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Change highlights
              </button>
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
