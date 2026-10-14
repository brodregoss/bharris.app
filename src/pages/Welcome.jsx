import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { makePhotoSource } from '@/lib/notesSource';
import { copyFileList, fileToJpegDataUrl, stashPhotos, validateNotePhotos } from '@/lib/imageData';
import { uploadNoteImages } from '@/lib/notesUpload';
import { isOnboarded } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  clearNotesScanToken,
  isScanLockError,
  notesScanUnlocked,
  refreshNotesScanUnlock,
  unlockNotesScan,
} from '@/lib/notesScanLock';
export default function Welcome() {
  const navigate = useNavigate();
  const [dragging, setDragging] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [readError, setReadError] = React.useState('');
  const [unlocked, setUnlocked] = React.useState(() => notesScanUnlocked());
  const [scanPassword, setScanPassword] = React.useState('');
  const [checkingPassword, setCheckingPassword] = React.useState(false);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    let cancelled = false;
    refreshNotesScanUnlock().then((ok) => {
      if (!cancelled) setUnlocked(ok);
    });
    return () => { cancelled = true; };
  }, []);

  const canGoBack = typeof window !== 'undefined' ? isOnboarded() : false;

  const unlockScan = async (event) => {
    event.preventDefault();
    if (checkingPassword) return;
    const password = scanPassword;
    if (!password.trim()) {
      setReadError('Enter the notes password.');
      return;
    }
    setCheckingPassword(true);
    setReadError('');
    try {
      await unlockNotesScan(password);
      setScanPassword('');
      setUnlocked(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setReadError(message || 'That password is wrong.');
    } finally {
      setCheckingPassword(false);
    }
  };

  const takeFiles = async (fileList) => {
    if (reading || !notesScanUnlocked()) return;
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
      } catch (err) {
        if (isScanLockError(err)) {
          clearNotesScanToken();
          setUnlocked(false);
          setReadError(err instanceof Error ? err.message : 'Enter the notes password to upload.');
          setReading(false);
          return;
        }
        // Extract still runs from the in-memory photos; R2 persist can retry later.
      }
      navigate('/highlight-notes', {
        state: { source: { ...makePhotoSource({ name, title: '', noteId }), noteId } },
      });
    } catch {
      setReadError('Could not read that photo. Try another one.');
      setReading(false);
    }
  };

  const onPick = (fileList) => {
    const files = copyFileList(fileList);
    if (inputRef.current) inputRef.current.value = '';
    if (!files.length) return;
    takeFiles(files);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    onPick(e.dataTransfer?.files);
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
              bharris.app
            </h1>
            <p className="text-base text-muted-foreground mt-4">Lets get moving</p>
          </div>

          {unlocked ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!reading) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'relative w-full rounded-3xl border-2 border-dashed px-6 py-12 flex flex-col items-center gap-4 transition text-center',
                reading ? 'cursor-wait opacity-80' : 'cursor-pointer',
                dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:border-muted-foreground'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                disabled={reading}
                aria-label="Choose a photo of your notes"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
                onChange={(e) => onPick(e.target.files)}
              />
              <div className="pointer-events-none w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                {reading ? (
                  <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="pointer-events-none">
                <p className="text-base font-semibold">{reading ? 'Opening photo…' : 'Drop notes here'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Up to 2 photos · a page or two of notes
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!reading) navigate('/create-notes');
                }}
                className="relative z-20 text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                create manually
              </button>
            </div>
          ) : (
            <form
              onSubmit={unlockScan}
              className="w-full rounded-3xl border border-border bg-card px-6 py-10 flex flex-col items-center gap-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold">Notes are locked</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Type the notes password to scan and upload photos.
                </p>
              </div>
              <Input
                type="password"
                name="notes-scan-password"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                maxLength={128}
                value={scanPassword}
                onChange={(event) => setScanPassword(event.target.value)}
                placeholder="Password"
                aria-label="Notes password"
                className="h-12 rounded-2xl text-center"
              />
              <Button
                type="submit"
                size="lg"
                disabled={checkingPassword || !scanPassword.trim()}
                className="w-full h-12 rounded-2xl text-base font-semibold"
              >
                {checkingPassword ? 'Checking…' : 'Unlock'}
              </Button>
              <button
                type="button"
                onClick={() => navigate('/create-notes')}
                className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                create manually
              </button>
            </form>
          )}
          {readError && (
            <p className="text-xs text-rose-600 dark:text-rose-300 text-center mt-3">{readError}</p>
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
