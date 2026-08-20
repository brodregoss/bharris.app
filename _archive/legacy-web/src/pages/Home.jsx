import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer, BookOpen, Clock, GraduationCap, CalendarClock, ArrowRight, RotateCcw } from 'lucide-react';
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
import { loadSession } from '@/lib/sessionStore';

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
  const [terms, setTerms] = React.useState(40);
  const [hours, setHours] = React.useState(5);
  const [examType, setExamType] = React.useState('');
  const [examTiming, setExamTiming] = React.useState('');
  const [resumeSession, setResumeSession] = React.useState(null);
  React.useEffect(() => {
    setResumeSession(loadSession());
  }, []);

  const canStart = terms > 0 && hours > 0 && examType && examTiming;

  const perTerm = terms && hours ? ((hours * 60) / terms).toFixed(1) : null;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 text-foreground flex flex-col">
      {/* Header */}
      <header className="px-6 pt-10 pb-2 flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 text-white">
          <Timer className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none">Last Minute Study</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">Cram smarter, not harder</p>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 px-6 pt-4 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          {resumeSession && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 text-white shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">Resume your session</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">Pick up where you left off.</p>
              </div>
              <Button
                size="sm"
                onClick={() => navigate('/study')}
                className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white"
              >
                Resume
              </Button>
            </div>
          )}
          <h2 className="text-2xl font-bold tracking-tight mb-1">What are we cramming?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Tell us the basics — we'll build a plan that fits the time you have.
          </p>

          <div className="space-y-5">
            <Field
              icon={<BookOpen className="w-4 h-4" />}
              label="Number of terms / concepts"
              hint={perTerm ? `≈ ${perTerm} min per term` : undefined}
            >
              <STEPPER value={terms} onChange={setTerms} min={0} step={5} />
            </Field>

            <Field
              icon={<Clock className="w-4 h-4" />}
              label="Hours available"
              hint="Time until the exam"
            >
              <STEPPER value={hours} onChange={setHours} min={0} step={1} suffix="hr" />
            </Field>

            <Field
              icon={<GraduationCap className="w-4 h-4" />}
              label="Exam type"
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

      {/* Footer CTA */}
      <footer className="px-6 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto w-full">
          <Button
            size="lg"
            disabled={!canStart}
            onClick={() => {
              localStorage.setItem('lms_onboarded', '1');
              navigate('/upload-notes', {
                state: { setup: { terms, hours, examType, examTiming } },
              });
            }}
            className={cn(
              'w-full h-14 rounded-2xl text-base font-semibold transition-all',
              canStart
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20'
                : 'bg-muted text-muted-foreground'
            )}
          >
            Upload Notes
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
}