import React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Timer, Clock, GraduationCap, CalendarClock, ArrowRight, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
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

function Wheel({ label, options, value, onChange }) {
  const scroller = React.useRef(null);
  const settleTimer = React.useRef(null);
  const skipScroll = React.useRef(false);
  const valueRef = React.useRef(value);
  const [active, setActive] = React.useState(value);
  valueRef.current = value;

  const indexFor = React.useCallback((next) => {
    const index = options.indexOf(next);
    return index < 0 ? 0 : index;
  }, [options]);

  const scrollTo = React.useCallback((next, behavior) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: indexFor(next) * WHEEL_ITEM, behavior });
  }, [indexFor]);

  React.useLayoutEffect(() => {
    setActive(value);
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    scrollTo(value, 'auto');
  }, [value, scrollTo]);

  const settle = React.useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const index = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / WHEEL_ITEM)));
    const next = options[index];
    if (next !== valueRef.current) {
      skipScroll.current = true;
      onChange(next);
      return;
    }
    if (Math.abs(el.scrollTop - index * WHEEL_ITEM) > 1) {
      el.scrollTo({ top: index * WHEEL_ITEM, behavior: 'smooth' });
    }
  }, [onChange, options]);

  const onScroll = () => {
    const el = scroller.current;
    if (el) {
      const index = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / WHEEL_ITEM)));
      setActive(options[index]);
    }
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 80);
  };

  React.useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const move = (dir) => {
    const index = indexFor(value);
    const next = options[Math.max(0, Math.min(options.length - 1, index + dir))];
    if (next !== value) onChange(next);
  };

  return (
    <div
      ref={scroller}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        }
      }}
      className="relative z-10 h-full overflow-y-auto overscroll-y-contain snap-y snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div style={{ height: WHEEL_PAD }} />
      {options.map((opt) => {
        const selected = opt === active;
        return (
          <div
            key={opt}
            role="option"
            aria-selected={opt === value}
            onClick={() => onChange(opt)}
            className={`snap-center flex h-10 w-full items-center justify-center text-lg tabular-nums ${
              selected ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground/70'
            }`}
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
      <header className="px-3 pt-safe pb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={goBack}
          aria-label={source.returnTo === '/history' ? 'Back' : 'Back to notes'}
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground">
          <Timer className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight leading-none truncate">bharris.app</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1 truncate">How much time do you have?</p>
        </div>
      </header>

      <main className="flex-1 px-6 pt-4 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight mb-1">How much time do you have?</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Tell us the clock and the test — we'll build a plan that fits.
          </p>

          <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted text-muted-foreground shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{notesLabel}</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {count > 0
                    ? `${count} term${count === 1 ? '' : 's'} ready`
                    : 'Terms will be extracted from your notes'}
                </p>
              </div>
              <button
                type="button"
                onClick={lookOver}
                className="text-xs font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground shrink-0"
              >
                Look over notes
              </button>
            </div>
          </div>

          <div className="space-y-5">
            <Field
              icon={<Clock className="w-4 h-4" />}
              label="Time available"
              hint={hoursHint}
            >
              <div className="relative h-[200px]">
                <div
                  className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-10 -translate-y-1/2 rounded-xl bg-muted"
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
                <SelectTrigger className="h-14 rounded-2xl text-base">
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
                <SelectTrigger className="h-14 rounded-2xl text-base">
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

      <footer className="px-6 pt-2 pb-safe">
        <div className="max-w-md mx-auto w-full">
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
            className={cn(
              'w-full h-14 rounded-2xl text-base font-semibold transition-all',
              canStart
                ? 'shadow-lg'
                : 'bg-muted text-muted-foreground'
            )}
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
