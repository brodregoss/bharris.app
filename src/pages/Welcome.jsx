import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { makePhotoSource } from '@/lib/notesSource';
import { loadSession } from '@/lib/sessionStore';
import { ONBOARDING_FLAG } from '@/lib/onboarding';

export default function Welcome() {
  const navigate = useNavigate();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef(null);

  const canGoBack = typeof window !== 'undefined'
    ? !!(localStorage.getItem(ONBOARDING_FLAG) || loadSession())
    : false;

  const takeFile = (file) => {
    if (!file) return;
    navigate('/setup', { state: { source: makePhotoSource(file) } });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    takeFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-foreground flex flex-col">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {canGoBack ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back"
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="h-9" />
        )}
      </header>

      <main className="flex-1 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <div className="pt-6 pb-8 text-center">
            <p className="text-sm font-medium tracking-wide text-muted-foreground">Welcome To</p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-2 leading-[1.05]">
              Last Minute Study
            </h1>
            <p className="text-base text-muted-foreground mt-4">Lets get moving</p>
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'w-full rounded-3xl border-2 border-dashed px-6 py-12 flex flex-col items-center gap-4 transition text-center cursor-pointer',
              dragging
                ? 'border-slate-900 bg-slate-900/5'
                : 'border-slate-300 bg-white hover:border-slate-400'
            )}
          >
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <Upload className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <p className="text-base font-semibold">Drop notes here</p>
              <p className="text-xs text-muted-foreground mt-1">Photos of handwritten or printed notes</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/create-notes');
              }}
              className="text-sm text-slate-900 underline underline-offset-4 hover:text-slate-700"
            >
              create manually
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              takeFile(e.target.files?.[0]);
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
