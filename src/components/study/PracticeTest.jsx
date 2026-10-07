import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Timer, RotateCcw, ArrowRight, Loader2, ChevronDown } from 'lucide-react';
import { invokeLlm } from '@/api/invokeLlm';
import { fmtTime, localGradeShortAnswer, parseGradeResponse, inferRankMode, tierLabelsFor, tierHintsFor } from '@/lib/studyUtils';
import { fillMcqWrongAnswers, mcqNeedsGeneratedWrongs } from '@/lib/distractors';
import useFillBelow from '@/components/study/useFillBelow';

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
  const seen = new Set([String(correct.term || '').trim().toLowerCase()]);
  const out = [];
  for (const t of [...same, ...other]) {
    const term = String(t.term || '').trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= n) break;
  }
  return out;
}

function buildQuestions(terms, examType, missedIds, distractorPool = terms) {
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
    const distractors = pickDistractors(distractorPool, t, 3);
    return {
      id: t.id,
      term: t.term,
      definition: t.definition,
      tier: t.tier,
      type,
      options: type === 'mcq' ? shuffle([t.term, ...distractors]) : null,
    };
  });
}

const MAX_SHORT_ANSWER_CHARS = 100;

function clampChars(text, max) {
  return String(text).slice(0, max);
}

function hintFromDefinition(definition) {
  const text = String(definition || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const words = text.split(' ');
  if (words.length <= 2) return `${words[0]}…`;
  const keep = Math.min(5, Math.max(2, Math.ceil(words.length * 0.28)));
  const n = Math.min(keep, words.length - 1);
  return `${words.slice(0, n).join(' ')}…`;
}

// Screen D — timed self-test weighted toward previously-missed items.
export default function PracticeTest({ terms, examType, budgetMs, priorMissed, onDone, rankMode }) {
  const mode = inferRankMode(terms, { rankMode });
  const labels = tierLabelsFor(mode);
  const hints = tierHintsFor(mode);
  const [questions, setQuestions] = React.useState(() => buildQuestions(terms, examType, priorMissed));
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({}); // qid -> { selected?, correct }
  const [submitted, setSubmitted] = React.useState(false);
  const [shortAnswer, setShortAnswer] = React.useState('');
  const [showHint, setShowHint] = React.useState(false);
  const [grading, setGrading] = React.useState(false);
  const [gradeResult, setGradeResult] = React.useState(null);
  const [gradeError, setGradeError] = React.useState(false);
  const [explanation, setExplanation] = React.useState(null);
  const [explaining, setExplaining] = React.useState(false);
  const [qTimeLeft, setQTimeLeft] = React.useState(budgetMs);
  const [phase, setPhase] = React.useState('taking');
  const [openTier, setOpenTier] = React.useState(null);
  const [prepping, setPrepping] = React.useState(
    () =>
      terms.length < 4 &&
      (examType === 'multiple_choice' || examType === 'mixed' || examType === 'mcq')
  );
  const [prepError, setPrepError] = React.useState(false);
  const [prepTick, setPrepTick] = React.useState(0);
  const doneRef = React.useRef(false);
  const taking = phase === 'taking' && !prepping && !prepError;
  const fit = useFillBelow(taking);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('results');
  };

  // Overall test cap. Don't burn the clock while extra MCQ choices are generated.
  React.useEffect(() => {
    if (prepping || prepError) return;
    const start = Date.now();
    const iv = setInterval(() => {
      if (Date.now() - start > budgetMs) {
        clearInterval(iv);
        finish();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [budgetMs, prepping, prepError]);

  // Small decks don't have enough real defs for 4 MCQ choices. Invent the rest.
  React.useEffect(() => {
    if (!prepping) return;
    if (!mcqNeedsGeneratedWrongs(terms, questions)) {
      setPrepping(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const filled = await fillMcqWrongAnswers(questions);
        if (cancelled) return;
        setQuestions(filled);
        setPrepError(false);
      } catch {
        if (cancelled) return;
        setPrepError(true);
      }
      if (!cancelled) setPrepping(false);
    })();
    return () => {
      cancelled = true;
    };
    // questions is the deck at prep start; don't re-run after fill updates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepTick]);

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
    setShowHint(false);
    setGradeResult(null);
    setGradeError(false);
    setGrading(false);
    setExplanation(null);
    setExplaining(false);
  };

  const applyGrade = (result) => {
    setGradeResult(result);
    record(q.id, { correct: result.correct });
  };

  const markIWasRight = () => {
    applyGrade({ correct: true, feedback: 'Marked as correct.' });
  };

  // Grade typed answers locally first, then with AI. Local exact matches win so
  // case/punctuation never mark a right answer wrong; AI covers paraphrases.
  const gradeWithAI = async () => {
    const answer = clampChars(shortAnswer, MAX_SHORT_ANSWER_CHARS).trim();
    if (!answer) return;
    setSubmitted(true);
    setGrading(true);
    setGradeError(false);
    setGradeResult(null);
    const local = localGradeShortAnswer(answer, q.definition);
    if (local?.correct) {
      applyGrade(local);
      setGrading(false);
      return;
    }
    try {
      const res = await invokeLlm({
        prompt:
          `You are grading a student's short-answer response for an exam-prep app.\n` +
          `Term: ${q.term}\nCorrect definition: ${q.definition}\nStudent's answer: ${answer}\n\n` +
          `Mark correct if the student shows the same meaning — ignore case, punctuation, extra words, and wording. ` +
          `If they restated the term or the definition, that is correct. Only mark incorrect when the meaning is wrong.\n` +
          `Respond with JSON { "correct": boolean, "feedback": "one short sentence" }.`,
        feature: 'grade',
        response_json_schema: {
          type: 'object',
          properties: { correct: { type: 'boolean' }, feedback: { type: 'string' } },
          required: ['correct', 'feedback'],
        },
      });
      const parsed = parseGradeResponse(res);
      if (!parsed) throw new Error('unreadable grade');
      applyGrade(parsed);
    } catch {
      if (local) applyGrade(local);
      else setGradeError(true);
    }
    setGrading(false);
  };

  // Explain why a wrong free-response answer was incorrect.
  const explain = async () => {
    setExplaining(true);
    try {
      const res = await invokeLlm({
        prompt:
          `A student is studying the term "${q.term}". The correct definition is: "${q.definition}". ` +
          `The student answered: "${clampChars(shortAnswer, MAX_SHORT_ANSWER_CHARS)}". ` +
          `In 2-3 short sentences, explain the concept clearly so the student understands why the correct definition is the right answer. Focus on helping them understand the correct answer.`,
        feature: 'explain',
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
    if (phase !== 'taking' || !q || hasAnswered || submitted || prepping || prepError) return;
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
  }, [idx, phase, hasAnswered, submitted, prepping, prepError]);

  // Dev-only: lets the floating checkmark button skip the current question and
  // mark it correct without answering or grading.
  const skipCorrectRef = React.useRef(() => {});
  skipCorrectRef.current = () => {
    if (phase !== 'taking' || !q || hasAnswered || prepping || prepError) return;
    record(q.id, { correct: true });
    next();
  };
  React.useEffect(() => {
    const handler = () => skipCorrectRef.current();
    window.addEventListener('dev:skip-correct', handler);
    return () => window.removeEventListener('dev:skip-correct', handler);
  }, []);

  const correctCount = Object.values(answers).filter((a) => a?.correct).length;

  if (prepping || prepError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        {prepError ? (
          <>
            <p className="text-sm font-medium">Couldn't finish the answer choices</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              This test needs a few extra wrong answers. Try again in a moment.
            </p>
            <Button
              type="button"
              onClick={() => {
                setPrepError(false);
                setPrepping(true);
                setPrepTick((n) => n + 1);
              }}
              className="mt-2 rounded-2xl"
            >
              Try again
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            <p className="text-sm font-medium">Writing extra answer choices…</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              There aren't enough terms yet for a full multiple-choice question.
            </p>
          </>
        )}
      </div>
    );
  }

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
      const built = buildQuestions(sub, examType, [], terms);
      setQuestions(built);
      setAnswers({});
      setIdx(0);
      setSubmitted(false);
      setShortAnswer('');
      setShowHint(false);
      setGradeResult(null);
      setGradeError(false);
      setGrading(false);
      setExplanation(null);
      setExplaining(false);
      doneRef.current = false;
      setOpenTier(null);
      setPhase('taking');
      if (mcqNeedsGeneratedWrongs(terms, built)) {
        setPrepError(false);
        setPrepping(true);
        setPrepTick((n) => n + 1);
      }
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
          <p className="text-[11px] text-muted-foreground mb-2">Tap a level to see which terms.</p>
          <div className="space-y-2 mb-5">
            {['critical', 'core', 'passive']
              .filter((t) => byTier[t])
              .map((t) => {
                const open = openTier === t;
                const ranked = terms.filter((term) => term.tier === t);
                return (
                  <div key={t} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenTier((cur) => (cur === t ? null : t))}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                      aria-expanded={open}
                    >
                      <span className="text-sm font-semibold">{labels[t]}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-sm text-muted-foreground">
                          {byTier[t].correct}/{byTier[t].total}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-border px-4 py-3 space-y-2">
                        <p className="text-xs text-muted-foreground">{hints[t]}</p>
                        {ranked.map((term) => {
                          const tested = questions.some((qq) => qq.id === term.id);
                          const gotIt = answers[term.id]?.correct;
                          return (
                            <div key={term.id} className="rounded-lg bg-muted/60 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold">{term.term}</p>
                                {tested && (
                                  <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                                      gotIt
                                        ? 'bg-emerald-500 text-white dark:bg-emerald-600'
                                        : 'bg-rose-500 text-white dark:bg-rose-600'
                                    }`}
                                    aria-label={gotIt ? 'Got it' : 'Missed'}
                                  >
                                    {gotIt ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{term.definition}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          {missedIds.length > 0 && (
            <Button variant="outline" onClick={retake} className="h-11 rounded-2xl mb-2 font-semibold">
              <RotateCcw className="w-4 h-4 mr-2" /> Retake weak areas
            </Button>
          )}
          <Button
            onClick={() => onDone({ missedIds, questionIds })}
            className="h-12 rounded-2xl font-semibold"
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

  const mcq = q.type === 'mcq';

  return (
    <div
      ref={fit.ref}
      style={fit.style}
      className="flex flex-col px-5 pt-3 pb-safe overflow-hidden"
    >
      <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground shrink-0">
        <span>
          Practice test · {idx + 1}/{questions.length}
        </span>
        <span className="flex items-center gap-1">
          <Timer className="w-3.5 h-3.5" />
          {fmtTime(qTimeLeft)}
        </span>
      </div>
      <div className="max-w-md mx-auto w-full flex-1 min-h-0 flex flex-col">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm min-h-0 flex flex-col overflow-hidden">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 shrink-0">
            {mcq ? 'Pick the term' : 'Short answer'} · {labels[q.tier] || q.tier}
          </p>
          {mcq ? (
            <>
              <p
                data-mcq-prompt="definition"
                className="text-base font-semibold leading-snug overflow-y-auto min-h-0 overscroll-contain"
              >
                {q.definition}
              </p>
              <div className="mt-3 space-y-2 shrink-0">
                {q.options.map((opt, i) => {
                  const selected = answered?.selected === opt;
                  const isCorrect = opt === q.term;
                  return (
                    <button
                      key={i}
                      onClick={() => !answered && record(q.id, { selected: opt, correct: isCorrect })}
                      className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-base leading-snug transition ${
                        answered
                          ? isCorrect
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100'
                            : selected
                            ? 'border-rose-500 bg-rose-50 text-rose-950 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-100'
                            : 'border-border'
                          : 'border-border hover:border-muted-foreground bg-card'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-tight shrink-0">{q.term}</p>
              <div className="min-h-0 overflow-y-auto">
              {!submitted ? (
                <>
                  <textarea
                    value={shortAnswer}
                    maxLength={MAX_SHORT_ANSWER_CHARS}
                    onChange={(e) => setShortAnswer(clampChars(e.target.value, MAX_SHORT_ANSWER_CHARS))}
                    placeholder="Type your answer — we'll grade it with AI…"
                    autoCapitalize="sentences"
                    autoCorrect="on"
                    enterKeyHint="done"
                    className="w-full rounded-xl border border-border bg-card p-3 text-base min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                      {shortAnswer.length >= MAX_SHORT_ANSWER_CHARS
                        ? 'You’ve hit the character limit'
                        : `${shortAnswer.length}/${MAX_SHORT_ANSWER_CHARS}`}
                    </p>
                    {!showHint ? (
                      <button
                        type="button"
                        onClick={() => setShowHint(true)}
                        className="text-xs text-muted-foreground hover:text-foreground underline font-medium shrink-0"
                      >
                        Hint
                      </button>
                    ) : null}
                  </div>
                  {showHint ? (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {hintFromDefinition(q.definition)}
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="space-y-2">
                  {gradeResult && (
                    <div
                      className={`rounded-xl p-3 text-sm ${
                        gradeResult.correct
                          ? 'bg-emerald-50 border border-emerald-300 text-emerald-950 dark:bg-emerald-400/10 dark:border-emerald-400/30 dark:text-emerald-100'
                          : 'bg-rose-50 border border-rose-300 text-rose-950 dark:bg-rose-400/10 dark:border-rose-400/30 dark:text-rose-100'
                      }`}
                    >
                      <p className={`font-semibold ${gradeResult.correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                        {gradeResult.correct ? 'Got it' : 'Missed'}
                      </p>
                      {gradeResult.feedback && (
                        <p className="mt-1 text-muted-foreground">{gradeResult.feedback}</p>
                      )}
                    </div>
                  )}
                  <div className="rounded-xl bg-muted p-3 text-lg leading-relaxed">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Your answer</p>
                    <p className="mt-1 whitespace-pre-wrap">{clampChars(shortAnswer, MAX_SHORT_ANSWER_CHARS).trim()}</p>
                  </div>
                  <div className="rounded-xl bg-muted p-3 text-lg leading-relaxed">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Correct answer</p>
                    <p className="mt-1">{q.definition}</p>
                  </div>
                  {gradeResult && (!explanation || !gradeResult.correct) && (
                    <div className="flex items-center gap-4">
                      {!explanation && (
                        <button
                          type="button"
                          onClick={explain}
                          disabled={explaining}
                          className="text-xs text-muted-foreground hover:text-foreground underline font-medium disabled:opacity-60"
                        >
                          {explaining ? 'Explaining…' : 'Explain'}
                        </button>
                      )}
                      {!gradeResult.correct && (
                        <button
                          type="button"
                          onClick={markIWasRight}
                          className="text-xs text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 underline font-medium"
                        >
                          I was right
                        </button>
                      )}
                    </div>
                  )}
                  {explanation && (
                    <p className="text-xs text-muted-foreground leading-relaxed pl-1">{explanation}</p>
                  )}
                </div>
              )}
              </div>
            </>
          )}
        </div>
        <div className="shrink-0 pt-3">
          {q.type === 'mcq' ? (
            <Button
              disabled={!answered}
              onClick={next}
              className="w-full h-12 rounded-2xl font-semibold"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : !submitted ? (
            <Button
              onClick={gradeWithAI}
              disabled={!shortAnswer.trim()}
              className="w-full h-12 rounded-2xl font-semibold"
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
              className="w-full h-12 rounded-2xl font-semibold"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="destructive"
                onClick={() => {
                  record(q.id, { correct: false });
                  next();
                }}
                className="h-12 rounded-2xl font-semibold"
              >
                <X className="w-4 h-4 mr-2" /> Missed
              </Button>
              <Button
                variant="success"
                onClick={() => {
                  record(q.id, { correct: true });
                  next();
                }}
                className="h-12 rounded-2xl font-semibold"
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