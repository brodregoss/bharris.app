import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Loader2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { makePhotoSource } from '@/lib/notesSource';
import { copyFileList, fileToJpegDataUrl, stashPhotos, validateNotePhotos } from '@/lib/imageData';
import { isOnboarded } from '@/lib/onboarding';
import { useAuth } from '@/lib/AuthContext';
import { workerRequest } from '@/lib/workerClient';
import { PHOTO_INVITE_ONLY, PHOTO_UPLOAD_NOTICE } from '@/lib/photoCopy';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

export default function Welcome() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();
  const photosOn = user?.photoFeatureEnabled === true;
  const unlocked = photosOn && !!user?.photoUnlocked;
  const [agreed, setAgreed] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [reading, setReading] = React.useState(false);
  const [readError, setReadError] = React.useState('');
  const [accessCode, setAccessCode] = React.useState('');
  const [redeeming, setRedeeming] = React.useState(false);
  const inputRef = React.useRef(null);

  const canGoBack = typeof window !== 'undefined' ? isOnboarded() : false;

  const redeemCode = async (event) => {
    event.preventDefault();
    if (redeeming) return;
    if (!agreed) {
      setReadError('Check the box to continue.');
      return;
    }
    if (!accessCode.trim()) {
      setReadError('Enter an access code.');
      return;
    }
    setRedeeming(true);
    setReadError('');
    try {
      await workerRequest('POST', '/v1/notes/photo-access', {
        code: accessCode.trim(),
        acceptPhotoTerms: true,
      });
      setAccessCode('');
      await checkUserAuth();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setReadError(message || 'That code can\'t be used.');
    } finally {
      setRedeeming(false);
    }
  };

  const takeFiles = async (fileList) => {
    if (reading || !unlocked) return;
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
      navigate('/highlight-notes', {
        state: { source: makePhotoSource({ name, title: '' }) },
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

          {photosOn && unlocked ? (
            <>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{PHOTO_UPLOAD_NOTICE}</p>
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
            </>
          ) : photosOn ? (
            <form
              onSubmit={redeemCode}
              className="w-full rounded-3xl border border-border bg-card px-6 py-10 flex flex-col items-center gap-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-base font-semibold">Photo import is locked</p>
                <p className="text-xs text-muted-foreground mt-1">{PHOTO_INVITE_ONLY}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed text-left">{PHOTO_UPLOAD_NOTICE}</p>
              <div className="flex items-start gap-3 text-left">
                <Checkbox
                  id="photo-terms"
                  checked={agreed}
                  onCheckedChange={(value) => setAgreed(value === true)}
                  className="mt-0.5"
                />
                <label htmlFor="photo-terms" className="text-sm leading-relaxed text-muted-foreground">
                  I agree to the{' '}
                  <Link to="/terms" className="font-medium text-foreground underline underline-offset-4">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="font-medium text-foreground underline underline-offset-4">Privacy Policy</Link>
                  . I confirm I&apos;m at least 18 years old, that I&apos;ll only upload my own study materials, and that I won&apos;t upload sexually explicit, illegal, or non-consensual content. I understand content that breaks these rules may be removed and my account terminated.
                </label>
              </div>
              <Input
                name="photo-access-code"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                maxLength={64}
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="Access code"
                aria-label="Photo access code"
                className="h-12 rounded-2xl text-center"
              />
              <Button
                type="submit"
                size="lg"
                disabled={redeeming || !accessCode.trim()}
                className="w-full h-12 rounded-2xl text-base font-semibold"
              >
                {redeeming ? 'Checking…' : 'Unlock'}
              </Button>
              <button
                type="button"
                onClick={() => navigate('/create-notes')}
                className="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground"
              >
                create manually
              </button>
            </form>
          ) : (
            <Button
              type="button"
              className="h-12 rounded-2xl text-base font-semibold"
              onClick={() => navigate('/create-notes')}
            >
              Type your notes
            </Button>
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
