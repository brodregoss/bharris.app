import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { makePhotoSource } from '@/lib/notesSource';
import { MAX_NOTE_PHOTOS, fileToJpegDataUrl, stashPhotos, validateNotePhotos } from '@/lib/imageData';
import { uploadNoteImages } from '@/lib/notesUpload';
import { isOnboarded } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';
import {
  clearNotesScanToken,
  fetchPhotoUploadStatus,
  isScanLockError,
} from '@/lib/notesScanLock';
import { hasAiConsent, setAiConsent } from '@/lib/aiConsent';
import AiConsentModal from '@/components/account/AiConsentModal';

export default function Welcome() {
  const navigate = useNavigate();
  const [dragging, setDragging] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [readError, setReadError] = React.useState('');
  const [uploadOn, setUploadOn] = React.useState(true);
  const [showAiConsent, setShowAiConsent] = React.useState(false);
  const [photos, setPhotos] = React.useState([]);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    clearNotesScanToken();
    fetchPhotoUploadStatus()
      .then((status) => {
        if (!cancelled) setUploadOn(status?.active !== false);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const canGoBack = typeof window !== 'undefined' ? isOnboarded() : false;

  const addFiles = async (fileList) => {
    if (reading || !uploadOn) return;
    const incoming = [...(fileList || [])].filter(Boolean);
    if (!incoming.length) return;
    if (photos.length + incoming.length > MAX_NOTE_PHOTOS) {
      setReadError('You can attach up to 2 photos — a page or two of notes, not a whole book.');
      return;
    }
    const checked = validateNotePhotos(incoming);
    if (checked.error) {
      setReadError(checked.error);
      return;
    }
    setReadError('');
    setReading(true);
    try {
      const next = [];
      for (const file of checked.files) {
        next.push({
          name: file.name || 'Photo',
          image: await fileToJpegDataUrl(file),
        });
      }
      setPhotos((prev) => [...prev, ...next].slice(0, MAX_NOTE_PHOTOS));
    } catch {
      setReadError('Could not read that photo. Try another one.');
    } finally {
      setReading(false);
    }
  };

  const removePhoto = (index) => {
    if (reading) return;
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const continueToHighlight = async () => {
    if (reading || !photos.length) return;
    setReadError('');
    setReading(true);
    const images = photos.map((photo) => photo.image);
    try {
      stashPhotos(images);
      const name = photos.length === 1 ? photos[0].name : `${photos.length} photos`;
      let noteId = '';
      try {
        const note = await uploadNoteImages(images, { title: 'Untitled' });
        noteId = note?.id || '';
      } catch (err) {
        if (isScanLockError(err)) {
          setUploadOn(false);
          setReadError(err instanceof Error ? err.message : 'Photo upload is off.');
          setReading(false);
          return;
        }
      }
      navigate('/highlight-notes', {
        state: { source: { ...makePhotoSource({ name, title: '', noteId }), noteId } },
      });
    } catch {
      setReadError('Could not read that photo. Try another one.');
      setReading(false);
    }
  };

  const selectPhotos = () => {
    if (reading || !photos.length || !uploadOn) return;
    if (!hasAiConsent()) {
      setShowAiConsent(true);
      return;
    }
    continueToHighlight();
  };

  const handleAiConsentAccept = () => {
    setAiConsent(true);
    setShowAiConsent(false);
    continueToHighlight();
  };

  const handleAiConsentDecline = () => {
    setAiConsent(false);
    setShowAiConsent(false);
    setReadError('AI features are required to scan notes. You can create notes manually instead.');
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <AiConsentModal
        open={showAiConsent}
        onAccept={handleAiConsentAccept}
        onDecline={handleAiConsentDecline}
      />
      <header className="px-5 pt-safe">
        {canGoBack ? (
          <button
            type="button"
            onClick={() => navigate('/')}
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
            <p className="text-label uppercase text-muted-foreground">Welcome To</p>
            <h1 className="mt-3 text-display text-foreground">
              bharris.app
            </h1>
            <p className="mt-4 text-meta text-muted-foreground">Lets get moving</p>
          </div>

          {uploadOn ? (
            photos.length ? (
              <div className="w-full flex flex-col gap-3">
                <div className={cn('grid gap-3', photos.length > 1 && 'grid-cols-2')}>
                  {photos.map((photo, index) => (
                    <div
                      key={`${photo.name}-${index}`}
                      className="relative overflow-hidden rounded-3xl border border-border bg-muted"
                    >
                      <img
                        src={photo.image}
                        alt={photo.name || `Photo ${index + 1}`}
                        className="h-56 w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        disabled={reading}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {photos.length < MAX_NOTE_PHOTOS && (
                  <div
                    onClick={() => !reading && inputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!reading) setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={cn(
                      'press flex w-full flex-col items-center gap-2 rounded-card border border-dashed px-6 py-6 text-center transition-colors duration-150 ease-out',
                      reading ? 'cursor-wait opacity-80' : 'cursor-pointer',
                      dragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-muted-foreground'
                    )}
                  >
                    <p className="text-body font-semibold text-foreground">
                      {reading ? 'Opening photo…' : 'Add another photo'}
                    </p>
                    <p className="text-meta text-muted-foreground">Up to 2 photos</p>
                  </div>
                )}
                <Button
                  type="button"
                  size="lg"
                  disabled={reading}
                  onClick={selectPhotos}
                  className="w-full h-12 rounded-full text-base font-semibold"
                >
                  {reading ? 'Opening…' : 'Select these photos'}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    if (!reading) navigate('/create-notes');
                  }}
                  className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground self-center"
                >
                  create manually
                </button>
              </div>
            ) : (
            <div
              onClick={() => !reading && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                if (!reading) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'press flex w-full flex-col items-center gap-4 rounded-card border border-dashed px-6 py-12 text-center transition-colors duration-150 ease-out',
                reading ? 'cursor-wait opacity-80' : 'cursor-pointer',
                dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-muted-foreground'
              )}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-surface-2">
                {reading ? (
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-body font-semibold text-foreground">{reading ? 'Opening photo…' : 'Drop notes here'}</p>
                <p className="mt-1 text-meta text-muted-foreground">
                  Up to 2 photos · a page or two of notes
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!reading) navigate('/create-notes');
                }}
                className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                create manually
              </button>
            </div>
            )
          ) : (
            <div className="flex w-full flex-col items-center gap-4 rounded-card border border-border bg-surface-1 px-6 py-10 text-center">
              <div>
                <p className="text-base font-semibold">Photo upload is off</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can still type your notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/create-notes')}
                className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                create manually
              </button>
            </div>
          )}
          {readError && (
            <p className="mt-3 text-center text-meta text-blank">{readError}</p>
          )}
          {uploadOn && (
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          )}

          <button
            type="button"
            onClick={() => navigate('/upload-notes')}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline self-center"
          >
            use some of ours
          </button>
        </div>
      </main>
    </div>
  );
}
