import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Timer, RotateCcw, ArrowRight, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { fmtTime } from '@/lib/studyUtils';

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function pickDistractors(terms, correct, n) {
  const same = terms.filter((t) => t.id !== correct.id && t.tier === correct.tier);
  const other = terms.filter((t) => t.id !== correct.id && t.tier !== correct.tier);
  return [...same, ...other].slice(0, n).map((t) => t.definition);
}

function buildQuestions(terms, examType, missedIds) {
  const N = Math.min(terms.length, 12);
  const missedSet = new Set(missedIds);
  const rank = { critical: 0, core: 1, passive: 2 };
  const ordered = [...terms].sort((a, b) => {
    const am = missedSet.has(a.id) ? 0 : 1;
    const bm = missedSet.has(b.id) ? 0 : 1;
    if (am !== bm) return am - bm;
    return rank[a.tier] - rank[b.tier];
  });
  const chosen = ordered.slice(0, N);
  return chosen.map((t, i) => {
    const type =
      examType === 'mixed' ? (i % 2 === 0 ? 'mcq' : 'short') : examType === 'multiple_choice' ? 'mcq' : 'short';
    const distractors = pickDistractors(terms, t, 3);
    return {
      id: t.id,
      term: t.term,
      definition: t.definition,
      tier: t.tier,
      type,
      options: type === 'mcq' ? shuffle([t.definition, ...distractors]) : null,
    };
  });
}

// Screen D — timed self-test weighted toward previously-missed items.
export default function PracticeTest({ terms, examType, budgetMs, priorMissed, onDone }) {
  const [questions, setQuestions] = React.useState(() => buildQuestions(terms, examType, priorMissed));
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({}); // qid -> { selected?, correct }
  const [submitted, setSubmitted] = React.useState(false);
  const [shortAnswer, setShortAnswer] = React.useState('');
  const [grading, setGrading] = React.useState(false);
  const [gradeResult, setGradeResult] = React.useState(null);
  const [gradeError, setGradeError] = React.useState(false);
  const [explanation, setExplanation] = React.useState(null);
  const [explaining, setExplaining] = React.useState(false);
  const [qTimeLeft, setQTimeLeft] = React.useState(budgetMs);
  const [phase, setPhase] = React.useState('taking');
  const doneRef = React.useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('results');
  };

  // Overall test cap.
  React.useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (Date.now() - start > budgetMs) {
        clearInterval(iv);
        finish();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [budgetMs]);

  const q = questions[idx];
  const perQMs = (type) => (type === 'mcq' ? 30000 : 90000);
  const hasAnswered = !!answers[q?.id];

  const record = (qid, payload) => setAnswers((a) => ({ ...a, [qid]: payload }));

  const next = () => {
    if (idx + 1 >= questions.length) {
      finish();
      return;
    }
    setIdx((i) => i + 1);
    setSubmitted(false);
    setShortAnswer('');
    setGradeResult(null);
    setGradeError(false);
    setGrading(false);
    setExplanation(null);
    setExplaining(false);
  };

  // AI grades the typed free-response answer against the correct definition.
  const gradeWithAI = async () => {
    if (!shortAnswer.trim()) return;
    setSubmitted(true);
    setGrading(true);
    setGradeError(false);
    setGradeResult(null);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          `You are grading a student's short-answer response for an exam-prep app.\n` +
          `Term: ${q.term}\nCorrect definition: ${q.definition}\nStudent's answer: ${shortAnswer}\n\n` +
          `Grade whether the student's answer demonstrates understanding of the term (wording need not match). ` +
          `Respond with JSON { "correct": boolean, "feedback": "one short sentence" }. Be lenient on phrasing, strict on meaning.`,
        response_json_schema: {
          type: 'object',
          properties: { correct: { type: 'boolean' }, feedback: { type: 'string' } },
          required: ['correct', 'feedback'],
        },
      });
      const correct = !!res.correct;
      setGradeResult({ correct, feedback: res.feedback || '' });
      record(q.id, { correct });
    } catch {
      setGradeError(true);
    }
    setGrading(false);
  };

  // Explain why a wrong free-response answer was incorrect.
  const explain = async () => {
    setExplaining(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          `A student is studying the term "${q.term}". The correct definition is: "${q.definition}". ` +
          `The student answered: "${shortAnswer}". ` +
          `In 2-3 short sentences, explain the concept clearly so the student understands why the correct definition is the right answer. Focus on helping them understand the correct answer.`,
      });
      setExplanation(typeof res === 'string' ? res : String(res));
    } catch {
      setExplanation('Could not generate an explanation right now.');
    }
    setExplaining(false);
  };

  // Per-question pacing: MCQ tighter, short-answer looser; mixed uses the
  // per-question type's timer. Auto-advances on expiry (unanswered = missed).
  React.useEffect(() => {
    if (phase !== 'taking' || !q || hasAnswered || submitted) return;
    const start = Date.now();
    const limit = perQMs(q.type);
    setQTimeLeft(limit);
    const iv = setInterval(() => {
      const left = limit - (Date.now() - start);
      setQTimeLeft(left);
      if (left <= 0) {
        clearInterval(iv);
        record(q.id, { correct: false });
        next();
      }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase, hasAnswered, submitted]);

  // Dev-only: lets the floating checkmark button skip the current question and
  // mark it correct without answering or grading.
  const skipCorrectRef = React.useRef(() => {});
  skipCorrectRef.current = () => {
    if (phase !== 'taking' || !q || hasAnswered) return;
    record(q.id, { correct: true });
    next();
  };
  React.useEffect(() => {
    const handler = () => skipCorrectRef.current();
    window.addEventListener('dev:skip-correct', handler);
    return () => window.removeEventListener('dev:skip-correct', handler);
  }, []);

  const correctCount = Object.values(answers).filter((a) => a?.correct).length;

  if (phase === 'results') {
    const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    const byTier = {};
    questions.forEach((qq) => {
      byTier[qq.tier] = byTier[qq.tier] || { correct: 0, total: 0 };
      byTier[qq.tier].total++;
      if (answers[qq.id]?.correct) byTier[qq.tier].correct++;
    });
    const missedIds = questions.filter((qq) => !answers[qq.id]?.correct).map((qq) => qq.id);
    const questionIds = questions.map((qq) => qq.id);

    const retake = () => {
      const sub = questions
        .filter((qq) => !answers[qq.id]?.correct)
        .map((qq) => terms.find((t) => t.id === qq.id))
        .filter(Boolean);
      if (!sub.length) return;
      setQuestions(buildQuestions(sub, examType, []));
      setAnswers({});
      setIdx(0);
      setSubmitted(false);
      setShortAnswer('');
      setGradeResult(null);
      setGradeError(false);
      setGrading(false);
      setExplanation(null);
      setExplaining(false);
      doneRef.current = false;
      setPhase('taking');
    };

    return (
      <div className="flex-1 flex flex-col px-5 pt-4 overflow-y-auto">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight mb-1">Practice test</h2>
          <p className="text-sm text-muted-foreground mb-5">Here's how you did.</p>
          <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm mb-4">
            <p className="text-5xl font-bold tracking-tight">{score}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {correctCount} of {questions.length} correct
            </p>
          </div>
          <div className="space-y-2 mb-5">
            {['critical', 'core', 'passive']
              .filter((t) => byTier[t])
              .map((t) => (
                <div
                  key={t}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="text-sm font-semibold capitalize">{t}</span>
                  <span className="text-sm text-muted-foreground">
                    {byTier[t].correct}/{byTier[t].total}
                  </span>
                </div>
              ))}
          </div>
          <Button variant="outline" onClick={retake} className="h-11 rounded-2xl mb-2 font-semibold">
            <RotateCcw className="w-4 h-4 mr-2" /> Retake weak areas
          </Button>
          <Button
            onClick={() => onDone({ missedIds, questionIds })}
            className="h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const answered = answers[q.id];

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>
          Practice test · {idx + 1}/{questions.length}
        </span>
        <span className="flex items-center gap-1">
          <Timer className="w-3.5 h-3.5" />
          {fmtTime(qTimeLeft)}
        </span>
      </div>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm min-h-[260px] flex flex-col">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            {q.type === 'mcq' ? 'Multiple choice' : 'Short answer'} · <span className="capitalize">{q.tier}</span>
          </p>
          <p className="text-xl font-bold tracking-tight">{q.term}</p>
          {q.type === 'mcq' ? (
            <div className="mt-4 space-y-2">
              {q.options.map((opt, i) => {
                const selected = answered?.selected === opt;
                const isCorrect = opt === q.definition;
                return (
                  <button
                    key={i}
                    onClick={() => !answered && record(q.id, { selected: opt, correct: isCorrect })}
                    className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition ${
                      answered
                        ? isCorrect
                          ? 'border-emerald-400 bg-emerald-50'
                          : selected
                          ? 'border-rose-400 bg-rose-50'
                          : 'border-border'
                        : 'border-border hover:border-slate-400 bg-card'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4">
              {!submitted ? (
                <textarea
                  value={shortAnswer}
                  onChange={(e) => setShortAnswer(e.target.value)}
                  placeholder="Type your answer — we'll grade it with AI…"
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <div className="space-y-2">
                  {gradeResult && (
                    <div
                      className={`rounded-xl p-3 text-sm ${
                        gradeResult.correct
                          ? 'bg-emerald-50 border border-emerald-300'
                          : 'bg-rose-50 border border-rose-300'
                      }`}
                    >
                      <p className={`font-semibold ${gradeResult.correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {gradeResult.correct ? 'Got it' : 'Missed'}
                      </p>
                      {gradeResult.feedback && (
                        <p className="mt-1 text-muted-foreground">{gradeResult.feedback}</p>
                      )}
                    </div>
                  )}
                  <div className="rounded-xl bg-muted p-3 text-sm">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Correct answer</p>
                    <p className="mt-1">{q.definition}</p>
                  </div>
                  {gradeResult && !explanation && (
                    <button
                      type="button"
                      onClick={explain}
                      disabled={explaining}
                      className="text-xs text-slate-500 hover:text-slate-700 underline font-medium self-start disabled:opacity-60"
                    >
                      {explaining ? 'Explaining…' : 'Explain'}
                    </button>
                  )}
                  {explanation && (
                    <p className="text-xs text-muted-foreground leading-relaxed pl-1">{explanation}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-4">
          {q.type === 'mcq' ? (
            <Button
              disabled={!answered}
              onClick={next}
              className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : !submitted ? (
            <Button
              onClick={gradeWithAI}
              disabled={!shortAnswer.trim()}
              className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              Grade answer
            </Button>
          ) : grading ? (
            <Button
              disabled
              className="w-full h-12 rounded-2xl bg-muted text-muted-foreground font-semibold"
            >
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Grading…
            </Button>
          ) : gradeResult ? (
            <Button
              onClick={next}
              className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  record(q.id, { correct: false });
                  next();
                }}
                className="h-12 rounded-2xl border-rose-300 text-rose-600 hover:bg-rose-50 font-semibold"
              >
                <X className="w-4 h-4 mr-2" /> Missed
              </Button>
              <Button
                onClick={() => {
                  record(q.id, { correct: true });
                  next();
                }}
                className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Got it
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}