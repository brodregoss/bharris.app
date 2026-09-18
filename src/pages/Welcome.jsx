import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { makePhotoSource } from '@/lib/notesSource';
import { fileToJpegDataUrl, stashPhotos, validateNotePhotos } from '@/lib/imageData';
import { uploadNoteImages } from '@/lib/notesUpload';
import { isOnboarded } from '@/lib/onboarding';

export default function Welcome() {
  const navigate = useNavigate();
  const [dragging, setDragging] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [readError, setReadError] = React.useState('');
  const inputRef = React.useRef(null);

  const canGoBack = typeof window !== 'undefined' ? isOnboarded() : false;

  const takeFiles = async (fileList) => {
    if (reading) return;
    const checked = validateNotePhotos(fileList);
    if (checked.error) {
      setReadError(checked.error);
      return;
    }
    setReadError('');
    setReading(true);
    try {
      const images = [];
      for (const file of checked.files) {
        images.push(await fileToJpegDataUrl(file));
      }
      stashPhotos(images);
      const name = checked.files.length === 1
        ? checked.files[0].name
        : `${checked.files.length} photos`;
      let noteId = '';
      try {
        const note = await uploadNoteImages(images, { title: 'Untitled' });
        noteId = note?.id || '';
      } catch {
        // Extract still runs from the in-memory photos; R2 persist can retry later.
      }
      navigate('/review-notes', {
        state: { source: { ...makePhotoSource({ name, title: '', noteId }), noteId } },
      });
    } catch {
      setReadError('Could not read that photo. Try another one.');
      setReading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    takeFiles(e.dataTransfer.files);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
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
            <p className="text-sm font-medium tracking-wide text-muted-foreground">Welcome To</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-2 leading-[1.05]">
              Last Minute Study
            </h1>
            <p className="text-base text-muted-foreground mt-4">Lets get moving</p>
          </div>

          <div
            onClick={() => !reading && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!reading) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'w-full rounded-3xl border-2 border-dashed px-6 py-12 flex flex-col items-center gap-4 transition text-center',
              reading ? 'cursor-wait opacity-80' : 'cursor-pointer',
              dragging
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-muted-foreground'
            )}
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              {reading ? (
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-base font-semibold">{reading ? 'Opening photo…' : 'Drop notes here'}</p>
              <p className="text-xs text-muted-foreground mt-1">
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
          {readError && (
            <p className="text-xs text-rose-600 dark:text-rose-300 text-center mt-3">{readError}</p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              takeFiles(e.target.files);
              e.target.value = '';
            }}
          />

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
