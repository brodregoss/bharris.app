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
import { recallTermCap } from '@/lib/studyUtils';

const STEPPER = ({ value, onChange, min = 0, step = 1, suffix }) => {
  const clamp = (v) => Math.max(min, v);
  const set = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) onChange(min);
    else onChange(clamp(Math.round(n)));
  };
  return (
    <div className="flex items-center rounded-2xl border border-border bg-card overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-ring transition">
      <button
        type="button"
        onClick={() => set(value - step)}
        className="px-4 py-4 text-2xl font-light text-muted-foreground hover:text-foreground hover:bg-accent transition"
        aria-label="decrease"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => set(e.target.value)}
        className="w-full text-center bg-transparent text-xl font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {suffix && (
        <span className="pr-1 text-sm text-muted-foreground select-none">{suffix}</span>
      )}
      <button
        type="button"
        onClick={() => set(value + step)}
        className="px-4 py-4 text-2xl font-light text-muted-foreground hover:text-foreground hover:bg-accent transition"
        aria-label="increase"
      >
        +
      </button>
    </div>
  );
};

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
  const [hours, setHours] = React.useState(location.state?.setup?.hours ?? 5);
  const [examType, setExamType] = React.useState(location.state?.setup?.examType || '');
  const [examTiming, setExamTiming] = React.useState(location.state?.setup?.examTiming || '');

  if (!source) {
    return <Navigate to="/welcome" replace />;
  }

  const count = termCount(source);
  const canStart = hours > 0 && examType && examTiming && count > 0;
  const perTerm = count && hours ? ((hours * 60) / count).toFixed(1) : null;
  const drillCap = recallTermCap(hours);
  const hoursHint = count > drillCap
    ? `We'll drill about ${drillCap} terms and skim the rest`
    : perTerm
      ? `≈ ${perTerm} min per term`
      : 'Time until the exam';
  const notesLabel = source.kind === 'photo'
    ? (source.name || 'Photo notes')
    : (source.title || 'Your notes');

  const goBack = () => {
    navigate(setupReturnPath(source), {
      state: { source, setup: { hours, examType, examTiming } },
    });
  };

  const lookOver = () => {
    if (source.items?.length) {
      navigate('/review-notes', {
        state: { source, setup: { hours, examType, examTiming } },
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
          aria-label="Back to notes"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground">
          <Timer className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none">Last Minute Study</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">How much time do you have?</p>
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
              label="Hours available"
              hint={hoursHint}
            >
              <STEPPER value={hours} onChange={setHours} min={0} step={1} suffix="hr" />
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
              navigate('/triage', {
                state: {
                  source,
                  setup: { terms: count || source.terms || 12, hours, examType, examTiming },
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
            Start cram
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
