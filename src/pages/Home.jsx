import React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Clock, GraduationCap, CalendarClock, ArrowRight, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { termCount, setupReturnPath } from '@/lib/notesSource';
import { markOnboarded } from '@/lib/onboarding';

const WHEEL_ITEM = 40;
const WHEEL_VISIBLE = 5;
const WHEEL_PAD = ((WHEEL_VISIBLE - 1) / 2) * WHEEL_ITEM;
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

function splitStudyTime(hours) {
  const total = Math.max(0, Math.round((Number(hours) || 0) * 60));
  let hourPart = Math.min(24, Math.floor(total / 60));
  let minutePart = Math.round((total % 60) / 5) * 5;
  if (minutePart === 60) {
    hourPart = Math.min(24, hourPart + 1);
    minutePart = 0;
  }
  return { hourPart, minutePart };
}

function wheelUnit(label, n) {
  if (label === 'Hours') return n === 1 ? 'hour' : 'hours';
  return 'min';
}

function indexOfValue(options, value) {
  const index = options.indexOf(value);
  return index < 0 ? 0 : index;
}

function snapOffset(offset, count) {
  const max = Math.max(0, (count - 1) * WHEEL_ITEM);
  const clamped = Math.max(0, Math.min(max, offset));
  return Math.round(clamped / WHEEL_ITEM) * WHEEL_ITEM;
}

function Wheel({ label, options, value, onChange }) {
  const rootRef = React.useRef(null);
  const startIndex = indexOfValue(options, value);
  const offsetRef = React.useRef(startIndex * WHEEL_ITEM);
  const indexRef = React.useRef(startIndex);
  const committedRef = React.useRef(startIndex);
  const optionsRef = React.useRef(options);
  const valueRef = React.useRef(value);
  const onChangeRef = React.useRef(onChange);
  const dragRef = React.useRef(null);
  const animRef = React.useRef(0);
  const snapTimer = React.useRef(null);
  const movedRef = React.useRef(false);
  const [offset, setOffset] = React.useState(startIndex * WHEEL_ITEM);
  const [active, setActive] = React.useState(startIndex);
  optionsRef.current = options;
  valueRef.current = value;
  onChangeRef.current = onChange;

  const applyOffset = React.useCallback((next) => {
    const list = optionsRef.current;
    const max = Math.max(0, (list.length - 1) * WHEEL_ITEM);
    const clamped = Math.max(0, Math.min(max, next));
    offsetRef.current = clamped;
    setOffset(clamped);
    const index = Math.max(0, Math.min(list.length - 1, Math.round(clamped / WHEEL_ITEM)));
    if (index !== indexRef.current) {
      indexRef.current = index;
      setActive(index);
    }
  }, []);

  const commitIndex = React.useCallback((index) => {
    const list = optionsRef.current;
    const safe = Math.max(0, Math.min(list.length - 1, index));
    committedRef.current = safe;
    const next = list[safe];
    if (next !== valueRef.current) onChangeRef.current(next);
  }, []);

  const animateTo = React.useCallback((target) => {
    window.clearTimeout(snapTimer.current);
    window.cancelAnimationFrame(animRef.current);
    const dest = snapOffset(target, optionsRef.current.length);
    const from = offsetRef.current;
    const distance = dest - from;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (Math.abs(distance) < 0.5 || reduce) {
      applyOffset(dest);
      commitIndex(Math.round(dest / WHEEL_ITEM));
      return;
    }
    const duration = Math.min(520, Math.max(220, Math.abs(distance) * 2.6));
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      applyOffset(from + distance * eased);
      if (t < 1) {
        animRef.current = window.requestAnimationFrame(tick);
        return;
      }
      applyOffset(dest);
      commitIndex(Math.round(dest / WHEEL_ITEM));
    };
    animRef.current = window.requestAnimationFrame(tick);
  }, [applyOffset, commitIndex]);

  const scheduleSnap = React.useCallback(() => {
    window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      animateTo(offsetRef.current);
    }, 80);
  }, [animateTo]);

  React.useLayoutEffect(() => {
    const index = indexOfValue(options, value);
    if (dragRef.current) return;
    if (committedRef.current === index) return;
    animateTo(index * WHEEL_ITEM);
  }, [value, options, animateTo]);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      let dy = event.deltaY;
      if (event.deltaMode === 1) dy *= 16;
      if (event.deltaMode === 2) dy *= WHEEL_ITEM;
      window.cancelAnimationFrame(animRef.current);
      applyOffset(offsetRef.current + dy);
      scheduleSnap();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyOffset, scheduleSnap]);

  React.useEffect(() => () => {
    window.cancelAnimationFrame(animRef.current);
    window.clearTimeout(snapTimer.current);
  }, []);

  const move = (dir) => {
    const list = optionsRef.current;
    const index = Math.max(0, Math.min(list.length - 1, indexRef.current + dir));
    animateTo(index * WHEEL_ITEM);
  };

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        window.clearTimeout(snapTimer.current);
        window.cancelAnimationFrame(animRef.current);
        dragRef.current = {
          id: event.pointerId,
          y: event.clientY,
          origin: offsetRef.current,
          lastY: event.clientY,
          lastT: performance.now(),
          velocity: 0,
          moved: false,
        };
        movedRef.current = false;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture needs a real pointer. Drag still follows the events.
        }
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        const dy = event.clientY - drag.y;
        if (Math.abs(dy) > 3) {
          drag.moved = true;
          movedRef.current = true;
        }
        const now = performance.now();
        const dt = now - drag.lastT;
        if (dt >= 8) {
          const instant = (drag.lastY - event.clientY) / dt;
          drag.velocity = drag.velocity * 0.6 + instant * 0.4;
          drag.lastY = event.clientY;
          drag.lastT = now;
        }
        applyOffset(drag.origin - dy);
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (!drag.moved) return;
        const stale = performance.now() - drag.lastT > 70;
        const coast = stale ? 0 : Math.max(-WHEEL_ITEM * 3, Math.min(WHEEL_ITEM * 3, drag.velocity * 110));
        animateTo(offsetRef.current + coast);
      }}
      onPointerCancel={() => {
        if (!dragRef.current) return;
        dragRef.current = null;
        animateTo(offsetRef.current);
      }}
      className="relative z-10 h-full cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
    >
      <div style={{ transform: `translate3d(0, ${-offset}px, 0)` }}>
        <div style={{ height: WHEEL_PAD }} />
        {options.map((opt, index) => {
          const selected = index === active;
          return (
            <div
              key={opt}
              role="option"
              aria-selected={opt === value}
              onClick={() => {
                if (movedRef.current) {
                  movedRef.current = false;
                  return;
                }
                animateTo(index * WHEEL_ITEM);
              }}
              className={`flex w-full items-center justify-center text-lg tabular-nums ${
                selected ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground/70'
              }`}
              style={{ height: WHEEL_ITEM }}
            >
              <span className="inline-flex items-baseline gap-1.5">
                <span className="w-6 text-right">{opt}</span>
                <span className="w-11 text-left text-sm">{wheelUnit(label, opt)}</span>
              </span>
            </div>
          );
        })}
        <div style={{ height: WHEEL_PAD }} />
      </div>
    </div>
  );
}

const Field = ({ icon, label, hint, children }) => (
  <div className="space-y-2.5">
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <Label className="text-sm font-medium text-foreground">{label}</Label>
    </div>
    {children}
    {hint && <p className="text-xs text-muted-foreground pl-7">{hint}</p>}
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const source = location.state?.source;
  const incomingSetup = location.state?.setup;
  const initialTime = splitStudyTime(incomingSetup?.hours ?? 5);
  const [hourPart, setHourPart] = React.useState(initialTime.hourPart);
  const [minutePart, setMinutePart] = React.useState(initialTime.minutePart);
  const setTotalMinutes = (total) => {
    const mins = Math.max(0, Math.round(Number(total) || 0));
    setHourPart(Math.floor(mins / 60));
    setMinutePart(mins % 60);
  };
  const hours = hourPart + minutePart / 60;
  const [examType, setExamType] = React.useState(incomingSetup?.examType || '');
  const [examTiming, setExamTiming] = React.useState(incomingSetup?.examTiming || '');

  if (!source) {
    return <Navigate to="/welcome" replace />;
  }

  const count = termCount(source);
  const canStart = hours > 0 && examType && examTiming && count > 0;
  const perTerm = count && hours ? ((hours * 60) / count).toFixed(1) : null;
  const hoursHint = perTerm
    ? `≈ ${perTerm} min per term`
    : 'Time you can study before the exam';
  const notesLabel = source.title || source.name || 'Your notes';

  const setupState = { ...incomingSetup, hours, examType, examTiming };

  const goBack = () => {
    navigate(setupReturnPath(source), {
      state: { source, setup: setupState },
    });
  };

  const lookOver = () => {
    if (source.items?.length) {
      navigate('/review-notes', {
        state: { source, setup: setupState },
      });
      return;
    }
    goBack();
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-5 pt-safe">
        <button
          type="button"
          onClick={goBack}
          aria-label={source.returnTo === '/history' ? 'Back' : 'Back to notes'}
          className="flex h-11 w-11 -ml-2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col px-5 pt-2">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <h1 className="text-display text-foreground">How much time?</h1>
          <p className="mb-6 mt-3 text-body text-muted-foreground">
            Tell us the clock and the test — we'll build a plan that fits.
          </p>

          <div className="option-surface mb-6 flex items-center gap-3 rounded-card px-4 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight">{notesLabel}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {count > 0
                  ? `${count} term${count === 1 ? '' : 's'} ready`
                  : 'Terms will be extracted from your notes'}
              </p>
            </div>
            <button
              type="button"
              onClick={lookOver}
              className="shrink-0 text-sm font-semibold text-foreground"
            >
              Look
            </button>
          </div>

          <div className="space-y-5">
            <Field
              icon={<Clock className="w-4 h-4" />}
              label="Time available"
              hint={hoursHint}
            >
              <p className="mb-2 text-center text-sm text-muted-foreground">Scroll to change the time</p>
              <div className="relative h-[200px]">
                <div
                  className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-10 -translate-y-1/2 rounded-full bg-muted"
                  aria-hidden
                />
                <div className="grid h-full grid-cols-2">
                  <Wheel
                    label="Hours"
                    options={HOUR_OPTIONS}
                    value={Math.min(hourPart, 24)}
                    onChange={(next) => setTotalMinutes(next * 60 + minutePart)}
                  />
                  <Wheel
                    label="Minutes"
                    options={MINUTE_OPTIONS}
                    value={MINUTE_OPTIONS.includes(minutePart) ? minutePart : 0}
                    onChange={(next) => setTotalMinutes(hourPart * 60 + next)}
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-background to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-background to-transparent" />
              </div>
            </Field>

            <Field
              icon={<GraduationCap className="w-4 h-4" />}
              label="What kind of test is it?"
            >
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger className="h-14 rounded-full text-base">
                  <SelectValue placeholder="Select exam type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                  <SelectItem value="mixed">Mixed (both)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              icon={<CalendarClock className="w-4 h-4" />}
              label="Exam timing"
              hint="Sleep-protection is tailored to how soon you test."
            >
              <Select value={examTiming} onValueChange={setExamTiming}>
                <SelectTrigger className="h-14 rounded-full text-base">
                  <SelectValue placeholder="When is the exam?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="2days">In 2 days</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </main>

      <footer className="px-5 pt-2 pb-safe">
        <div className="mx-auto w-full max-w-md">
          <Button
            size="lg"
            disabled={!canStart}
            onClick={() => {
              markOnboarded();
              navigate('/study-mode', {
                state: {
                  source,
                  setup: {
                    ...incomingSetup,
                    terms: count || source.terms || 12,
                    hours,
                    examType,
                    examTiming,
                  },
                },
              });
            }}
            className="h-action w-full"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
