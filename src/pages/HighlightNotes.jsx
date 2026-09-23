import React from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { makePhotoSource } from '@/lib/notesSource';
import {
  peekPhotos,
  peekHighlightMarks,
  clearPhoto,
  clearScopedPhotos,
  stashScopedPhotos,
  stashHighlightMarks,
  buildHighlightedExtractPlan,
} from '@/lib/imageData';

const MIN_DRAG_PX = 16;

function rectFrom(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.abs(end.x - start.x),
    h: Math.abs(end.y - start.y),
  };
}

function pointIn(event, el) {
  const bounds = el.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return { x: 0, y: 0 };
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  };
}

function summarize(marks) {
  const total = marks.reduce((sum, list) => sum + list.length, 0);
  if (!total) return 'The whole page will be read.';
  if (marks.length === 1) {
    return total === 1 ? '1 area will be read.' : `${total} areas will be read.`;
  }
  return marks
    .map((list, i) => (
      list.length
        ? `Photo ${i + 1}: ${list.length} area${list.length === 1 ? '' : 's'}`
        : `Photo ${i + 1}: whole page`
    ))
    .join(' · ');
}

function HighlightBox({ mark, draft, onRemove }) {
  return (
    <div
      className="pointer-events-none absolute rounded-sm border-2 border-amber-500 bg-amber-300/45"
      style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        width: `${mark.w * 100}%`,
        height: `${mark.h * 100}%`,
      }}
    >
      {!draft && (
        <button
          type="button"
          aria-label="Remove highlight"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onRemove(mark.id)}
          className="pointer-events-auto absolute top-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default function HighlightNotes() {
  const navigate = useNavigate();
  const location = useLocation();
  const photos = React.useMemo(() => peekPhotos(), []);
  const source = location.state?.source || makePhotoSource({ name: 'Photo notes' });
  const [page, setPage] = React.useState(0);
  const [marks, setMarks] = React.useState(() => {
    const saved = peekHighlightMarks();
    if (saved.length === photos.length && saved.every(Array.isArray)) return saved;
    return photos.map(() => []);
  });
  const [draft, setDraft] = React.useState(null);
  const [frame, setFrame] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const stageRef = React.useRef(null);
  const imgRef = React.useRef(null);
  const frameRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const marksRef = React.useRef(marks);
  const pageRef = React.useRef(page);
  marksRef.current = marks;
  pageRef.current = page;

  const measure = React.useCallback(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img?.naturalWidth || !img.naturalHeight) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    setFrame({ x: (width - w) / 2, y: (height - h) / 2, w, h });
  }, []);

  React.useEffect(() => {
    stashHighlightMarks(marks);
  }, [marks]);

  React.useEffect(() => {
    if (!imgRef.current?.naturalWidth) setFrame(null);
    measure();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [measure, page]);

  if (!photos.length) {
    return <Navigate to="/welcome" replace />;
  }

  const current = marks[page] || [];
  const total = marks.reduce((sum, list) => sum + list.length, 0);

  const leave = () => {
    clearPhoto();
    navigate('/welcome');
  };

  const undo = () => {
    setMarks((prev) => prev.map((list, i) => (i === page ? list.slice(0, -1) : list)));
  };

  const removeMark = (id) => {
    setMarks((prev) => prev.map((list, i) => (
      i === page ? list.filter((mark) => mark.id !== id) : list
    )));
  };

  const onPointerDown = (event) => {
    if (busy || !frameRef.current) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that is already gone can still finish as a tap.
    }
    const start = pointIn(event, frameRef.current);
    dragRef.current = { pointerId: event.pointerId, start };
    setDraft({ ...rectFrom(start, start), id: 'draft' });
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !frameRef.current) return;
    setDraft({ ...rectFrom(drag.start, pointIn(event, frameRef.current)), id: 'draft' });
  };

  const onPointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const el = frameRef.current;
    const box = frame;
    setDraft(null);
    if (!el || !box) return;
    const next = rectFrom(drag.start, pointIn(event, el));
    const wide = next.w * box.w >= MIN_DRAG_PX;
    const tall = next.h * box.h >= MIN_DRAG_PX;
    const index = pageRef.current;
    if (!wide || !tall) {
      const hit = [...(marksRef.current[index] || [])].reverse().find((mark) => (
        eventPointHits(pointIn(event, el), mark)
      ));
      if (hit) {
        setMarks((prev) => prev.map((list, i) => (
          i === index ? list.filter((mark) => mark.id !== hit.id) : list
        )));
      }
      return;
    }
    const id = `h${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMarks((prev) => prev.map((list, i) => (
      i === index ? [...list, { ...next, id }] : list
    )));
  };

  const findTerms = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const entries = await buildHighlightedExtractPlan(photos, marks);
      if (entries.some((entry) => entry.scoped)) stashScopedPhotos(entries);
      else clearScopedPhotos();
      navigate('/review-notes', { state: { source } });
    } catch {
      setError('Could not use that highlight. Try drawing it again.');
      setBusy(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col">
      <header className="px-3 pt-safe pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={leave}
          aria-label="Back"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold tracking-tight leading-none truncate">
            Highlight terms
          </h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">
            Drag over the terms you want
          </p>
        </div>
        <button
          type="button"
          onClick={undo}
          disabled={!current.length || busy}
          className="h-11 px-2 flex items-center gap-1 text-xs font-medium text-muted-foreground disabled:opacity-40"
        >
          <Undo2 className="w-4 h-4" />
          Undo
        </button>
      </header>

      <main className="flex-1 min-h-0 px-5 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 min-h-0 flex flex-col">
        <div
          ref={stageRef}
          className="relative flex-1 min-h-[240px] rounded-2xl bg-muted overflow-hidden"
        >
          <img
            ref={imgRef}
            key={page}
            src={photos[page]}
            alt={`Notes photo ${page + 1}`}
            draggable={false}
            onLoad={measure}
            className="absolute inset-0 h-full w-full object-contain select-none pointer-events-none"
          />
          {frame && (
            <div
              ref={frameRef}
              role="application"
              aria-label="Drag to highlight the terms you want read"
              className="absolute touch-none cursor-crosshair select-none"
              style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onContextMenu={(event) => event.preventDefault()}
            >
              {current.map((mark) => (
                <HighlightBox key={mark.id} mark={mark} onRemove={removeMark} />
              ))}
              {draft && (draft.w > 0 || draft.h > 0) && (
                <HighlightBox mark={draft} draft />
              )}
              {!current.length && !draft && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
                  <p className="rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm text-center">
                    Drag over the terms you want
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-3">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  dragRef.current = null;
                  setDraft(null);
                  setPage(i);
                }}
                className={cn(
                  'h-9 px-3 rounded-full text-xs font-semibold transition',
                  page === i
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                Photo {i + 1}{marks[i].length ? ` · ${marks[i].length}` : ''}
              </button>
            ))}
          </div>
        )}
        </div>
      </main>

      <footer className="px-6 pt-2 pb-safe">
        <div className="max-w-md mx-auto w-full">
          <p className="text-xs text-muted-foreground text-center mb-2">{summarize(marks)}</p>
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-300 text-center mb-2">{error}</p>
          )}
          <Button
            size="lg"
            disabled={busy}
            onClick={findTerms}
            className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg"
          >
            {busy ? 'Preparing…' : total ? 'Find terms' : 'Use the whole page'}
            {!busy && <ArrowRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function eventPointHits(point, mark) {
  return point.x >= mark.x && point.x <= mark.x + mark.w
    && point.y >= mark.y && point.y <= mark.y + mark.h;
}
