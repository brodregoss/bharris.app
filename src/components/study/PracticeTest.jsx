import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Timer, RotateCcw, ArrowRight, Eye } from 'lucide-react';
import { fmtTime, inferRankMode, localGradeShortAnswer, tierLabelsFor } from '@/lib/studyUtils';
import { fillMcqWrongAnswers, mcqNeedsGeneratedWrongs } from '@/lib/distractors';
import { generateChallengeQuestions } from '@/lib/practiceQuestions';
import useFillBelow from '@/components/study/useFillBelow';
import AiWait from '@/components/AiWait';

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

const ROI_BY_TIER = {
  critical: 'Highest ROI',
  core: 'ROI',
  passive: 'Lowest ROI',
};

function ReviewMark({ correct }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
        correct ? 'bg-gain text-black' : 'bg-loss text-white'
      }`}
      aria-label={correct ? 'Got it' : 'Missed'}
    >
      {correct ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

function AnswerRow({ text, tone, tag }) {
  const toneClass =
    tone === 'correct'
      ? 'border-gain bg-gain-soft text-gain'
      : tone === 'wrong'
        ? 'border-loss bg-loss-soft text-loss'
        : 'border-transparent bg-secondary text-foreground';
  return (
    <div className={`rounded-2xl border px-3.5 py-2.5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-snug">{text}</p>
        {tag ? (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide">{tag}</span>
        ) : null}
      </div>
    </div>
  );
}

function ReviewQuestion({ question, answer }) {
  const gotIt = !!answer?.correct;
  const mcq = question.type === 'mcq';
  return (
    <article className="rounded-3xl bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {mcq ? (question.prompt ? 'Question' : 'Pick the term') : 'Short answer'}
        </p>
        <ReviewMark correct={gotIt} />
      </div>
      <p className={`mt-2 leading-snug ${mcq ? 'text-base font-semibold' : 'text-lg font-bold tracking-tight'}`}>
        {questionPrompt(question)}
      </p>
      {mcq ? (
        <div className="mt-3 space-y-2">
          {(question.options || []).map((opt, i) => {
            const selected = answer?.selected === opt;
            const isCorrect = opt === questionAnswer(question);
            const tone = isCorrect ? 'correct' : selected ? 'wrong' : 'plain';
            const tag = isCorrect ? (selected ? 'Your answer' : 'Answer') : selected ? 'Your answer' : null;
            return <AnswerRow key={`${question.id}-${i}`} text={opt} tone={tone} tag={tag} />;
          })}
          {!gotIt && !answer?.selected ? <p className="text-xs font-semibold text-loss">No answer</p> : null}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {!gotIt || answer?.written ? (
            <AnswerRow
              text={answer?.written || 'No answer'}
              tone={gotIt ? 'correct' : 'wrong'}
              tag="Your answer"
            />
          ) : null}
          <AnswerRow text={questionAnswer(question)} tone="correct" tag="Answer" />
        </div>
      )}
    </article>
  );
}

function clampChars(text, max) {
  return String(text).slice(0, max);
}

function questionAnswer(question) {
  if (!question) return '';
  if (question.answer) return question.answer;
  return question.type === 'mcq' ? question.term : question.definition;
}

function questionPrompt(question) {
  if (!question) return '';
  if (question.prompt) return question.prompt;
  return question.type === 'mcq' ? question.definition : question.term;
}

function answerLimit(question) {
  return question?.prompt ? 220 : MAX_SHORT_ANSWER_CHARS;
}

function sheetAnswered(question, saved) {
  if (!saved) return false;
  if (question.type === 'mcq') return !!String(saved.selected || '').trim();
  return !!String(saved.written || '').trim();
}

function gradeSheetAnswers(list, current) {
  const graded = {};
  for (const question of list) {
    const saved = current[question.id] || {};
    if (question.type === 'mcq') {
      const selected = String(saved.selected || '');
      graded[question.id] = {
        selected,
        correct: !!selected && selected === questionAnswer(question),
      };
    } else {
      const written = String(saved.written || '').trim();
      const local = localGradeShortAnswer(written, questionAnswer(question));
      graded[question.id] = {
        written,
        correct: local?.correct === true,
      };
    }
  }
  return graded;
}

function scrollParent(node) {
  let parent = node.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflow = `${style.overflow}${style.overflowY}`;
    if (/(auto|scroll)/.test(overflow) && parent.scrollHeight > parent.clientHeight + 1) return parent;
    parent = parent.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function AiQuestionSheet({ questions, answers, onPick, onWrite, onCheck }) {
  const nodes = React.useRef({});

  const scrollTo = (id) => {
    const node = nodes.current[id];
    if (!node) return;
    const scroller = scrollParent(node);
    const page = scroller === document.scrollingElement || scroller === document.documentElement;
    const viewHeight = page ? window.innerHeight : scroller.clientHeight;
    const scrollerTop = page ? 0 : scroller.getBoundingClientRect().top;
    const current = page ? window.scrollY : scroller.scrollTop;
    // Leave the bottom of the previous question showing, then stop on the next card.
    const offset = Math.min(160, Math.round(viewHeight * 0.28));
    const delta = node.getBoundingClientRect().top - scrollerTop - offset;
    scroller.scrollTo({ top: Math.max(0, current + delta), behavior: 'smooth' });
  };

  const answeredCount = questions.filter((question) => sheetAnswered(question, answers[question.id])).length;
  const ready = questions.length > 0 && answeredCount === questions.length;

  return (
    <div className="flex w-full flex-1 flex-col px-4 pb-safe">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-[70vh] pt-2">
        <p className="text-sm text-muted-foreground">
          {answeredCount} of {questions.length} answered. Scroll back anytime. Answers are checked at the end.
        </p>
        {questions.map((question, index) => {
          const saved = answers[question.id] || {};
          const mcq = question.type === 'mcq';
          return (
            <section
              key={question.id}
              ref={(node) => {
                nodes.current[question.id] = node;
              }}
              className="scroll-mt-4 rounded-3xl bg-card px-5 py-5"
            >
              <p className="text-xs font-semibold text-muted-foreground">
                {index + 1} of {questions.length}
              </p>
              <p className="mt-3 text-lg font-medium leading-snug">{questionPrompt(question)}</p>
              {mcq ? (
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {(question.options || []).map((opt, i) => {
                    const selected = saved.selected === opt;
                    return (
                      <button
                        key={`${question.id}-${i}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          onPick(question.id, opt);
                          const next = questions[index + 1];
                          window.requestAnimationFrame(() => scrollTo(next ? next.id : 'check'));
                        }}
                        className={`rounded-xl px-3.5 py-3 text-left text-[15px] font-medium leading-snug ${
                          selected
                            ? 'border border-primary bg-primary/10 text-foreground'
                            : 'border border-transparent bg-secondary text-foreground'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4">
                  <textarea
                    value={saved.written || ''}
                    maxLength={answerLimit(question)}
                    onChange={(event) => onWrite(question.id, clampChars(event.target.value, answerLimit(question)))}
                    placeholder="Type your answer"
                    className="min-h-28 w-full resize-none rounded-2xl bg-secondary p-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    type="button"
                    className="mt-3 h-11 w-full rounded-full"
                    onClick={() => {
                      const next = questions[index + 1];
                      scrollTo(next ? next.id : 'check');
                    }}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </section>
          );
        })}
        <div
          ref={(node) => {
            nodes.current.check = node;
          }}
          className="scroll-mt-4"
        >
          <Button
            type="button"
            disabled={!ready}
            onClick={onCheck}
            className="h-12 w-full rounded-full font-semibold"
          >
            Check answers
          </Button>
          {ready ? null : (
            <p className="mt-2 text-center text-xs text-muted-foreground">Answer each question, then check them.</p>
          )}
        </div>
      </div>
    </div>
  );
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
export default function PracticeTest({
  terms,
  examType,
  budgetMs,
  priorMissed,
  onDone,
  rankMode,
  questionSource = 'local',
  challenge = 3,
}) {
  const ai = questionSource === 'ai';
  const mode = inferRankMode(terms, { rankMode });
  const labels = tierLabelsFor(mode);
  const [questions, setQuestions] = React.useState(() => (
    ai ? [] : buildQuestions(terms, examType, priorMissed)
  ));
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({}); // qid -> { selected?, correct }
  const [submitted, setSubmitted] = React.useState(false);
  const [shortAnswer, setShortAnswer] = React.useState('');
  const [showHint, setShowHint] = React.useState(false);
  const [qTimeLeft, setQTimeLeft] = React.useState(budgetMs);
  const [phase, setPhase] = React.useState('taking');
  const [canContinue, setCanContinue] = React.useState(false);
  const [continueCue, setContinueCue] = React.useState(false);
  const [prepping, setPrepping] = React.useState(
    () =>
      ai ||
      (
        terms.length < 4 &&
        (examType === 'multiple_choice' || examType === 'mixed' || examType === 'mcq')
      )
  );
  const [prepError, setPrepError] = React.useState(false);
  const [prepTick, setPrepTick] = React.useState(0);
  const doneRef = React.useRef(false);
  const questionsRef = React.useRef(questions);
  questionsRef.current = questions;
  const taking = phase === 'taking' && !prepping && !prepError;
  const fit = useFillBelow(ai ? false : taking);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (ai) setAnswers((current) => gradeSheetAnswers(questionsRef.current, current));
    setPhase('results');
  };

  // Overall test cap. Don't burn the clock while extra MCQ choices are generated.
  React.useEffect(() => {
    if (ai || prepping || prepError) return;
    const start = Date.now();
    const iv = setInterval(() => {
      if (Date.now() - start > budgetMs) {
        clearInterval(iv);
        finish();
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [budgetMs, prepping, prepError]);

  React.useEffect(() => {
    if (!ai) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const built = await generateChallengeQuestions(terms, {
          examType,
          challenge,
          missedIds: priorMissed,
        });
        if (cancelled) return;
        setQuestions(built);
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
    // One generation per start or retry. Retakes reuse these questions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepTick, ai]);

  // Small decks don't have enough real defs for 4 MCQ choices. Invent the rest.
  React.useEffect(() => {
    if (ai || !prepping) return;
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

  const advancingRef = React.useRef(false);
  const next = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setCanContinue(false);
    if (idx + 1 >= questions.length) {
      finish();
      return;
    }
    setIdx((i) => i + 1);
    setSubmitted(false);
    setShortAnswer('');
    setShowHint(false);
  };

  React.useEffect(() => {
    advancingRef.current = false;
    setCanContinue(false);
    setContinueCue(false);
  }, [idx]);

  React.useEffect(() => {
    if (!canContinue) {
      setContinueCue(false);
      return undefined;
    }
    const id = window.requestAnimationFrame(() => setContinueCue(true));
    return () => window.cancelAnimationFrame(id);
  }, [canContinue]);

  // After a multiple-choice pick, leave the result on screen, then invite a press.
  React.useEffect(() => {
    if (ai || phase !== 'taking' || !q || q.type !== 'mcq' || !answers[q.id]) return undefined;
    const id = window.setTimeout(() => setCanContinue(true), 3000);
    return () => window.clearTimeout(id);
  }, [phase, q, idx, answers]);

  // Number keys choose the matching answer (1 is the first choice).
  React.useEffect(() => {
    if (ai || phase !== 'taking' || !q || q.type !== 'mcq' || answers[q.id] || prepping || prepError) return undefined;
    const onKey = (event) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = event.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!/^[1-9]$/.test(event.key)) return;
      const opt = q.options?.[Number(event.key) - 1];
      if (!opt) return;
      event.preventDefault();
      record(q.id, { selected: opt, correct: opt === questionAnswer(q) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, q, answers, prepping, prepError]);

  React.useEffect(() => {
    if (ai || phase !== 'taking' || !q || q.type !== 'mcq' || !answers[q.id]) return undefined;
    const onKey = (event) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (['Shift', 'Meta', 'Alt', 'Control', 'Tab'].includes(event.key)) return;
      event.preventDefault();
      next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // next is recreated each render and guarded against a double advance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, q, idx, answers]);

  const revealAnswer = () => {
    if (!clampChars(shortAnswer, answerLimit(q)).trim()) return;
    setSubmitted(true);
  };

  // Per-question pacing: MCQ tighter, short-answer looser; mixed uses the
  // per-question type's timer. Auto-advances on expiry (unanswered = missed).
  React.useEffect(() => {
    if (ai || phase !== 'taking' || !q || hasAnswered || submitted || prepping || prepError) return;
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
    if (ai || phase !== 'taking' || !q || hasAnswered || prepping || prepError) return;
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
            <p className="text-sm font-medium">{ai ? "Couldn't write the questions" : "Couldn't finish the answer choices"}</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {ai
                ? 'The harder test needs a study AI call. Try again in a moment.'
                : 'This test needs a few extra wrong answers. Try again in a moment.'}
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
            <AiWait
              label={ai ? 'Writing harder questions…' : 'Writing extra answer choices…'}
              detail={ai
                ? 'These ask you to use the idea, not just recognize the definition.'
                : "There aren't enough terms yet for a full multiple-choice question."}
              estimateMs={ai ? 15000 : 10000}
            />
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
      const built = ai
        ? questions.filter((qq) => !answers[qq.id]?.correct)
        : buildQuestions(sub, examType, [], terms);
      setQuestions(built);
      setAnswers({});
      setIdx(0);
      setSubmitted(false);
      setShortAnswer('');
      setShowHint(false);
      doneRef.current = false;
      setPhase('taking');
      if (!ai && mcqNeedsGeneratedWrongs(terms, built)) {
        setPrepError(false);
        setPrepping(true);
        setPrepTick((n) => n + 1);
      }
    };

    const tierOrder = ['critical', 'core', 'passive'];
    const tiers = tierOrder.filter((t) => byTier[t]);
    const unranked = questions.filter((qq) => !tierOrder.includes(qq.tier));

    return (
      <div className="flex-1 flex flex-col px-5 pt-4 pb-safe overflow-y-auto">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <h2 className="text-2xl font-bold tracking-tight mb-1">Practice test</h2>
          <p className="text-sm text-muted-foreground mb-5">Here's how you did.</p>
          <div className="rounded-3xl bg-card p-6 text-center mb-6">
            <p className="text-5xl font-bold tracking-tight">{score}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {correctCount} of {questions.length} correct
            </p>
          </div>
          <div className="space-y-6 mb-6">
            {tiers.map((t) => {
              const sectionQuestions = questions.filter((qq) => qq.tier === t);
              return (
                <section key={t}>
                  <div className="mb-2 flex items-center justify-between gap-3 px-1">
                    <h3 className="text-sm font-semibold">{ROI_BY_TIER[t]}</h3>
                    <span className="text-sm text-muted-foreground">
                      {byTier[t].correct}/{byTier[t].total}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {sectionQuestions.map((qq) => (
                      <ReviewQuestion key={qq.id} question={qq} answer={answers[qq.id]} />
                    ))}
                  </div>
                </section>
              );
            })}
            {unranked.length > 0 && (
              <section className="space-y-3">
                {unranked.map((qq) => (
                  <ReviewQuestion key={qq.id} question={qq} answer={answers[qq.id]} />
                ))}
              </section>
            )}
          </div>
          {missedIds.length > 0 && (
            <Button variant="outline" onClick={retake} className="h-11 rounded-full mb-2 font-semibold">
              <RotateCcw className="w-4 h-4 mr-2" /> Retake weak areas
            </Button>
          )}
          <Button
            onClick={() => onDone({ missedIds, questionIds })}
            className="h-12 rounded-full font-semibold"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  if (ai) {
    if (!questions.length) return null;
    return (
      <AiQuestionSheet
        questions={questions}
        answers={answers}
        onPick={(id, selected) => record(id, { selected })}
        onWrite={(id, written) => record(id, { written })}
        onCheck={finish}
      />
    );
  }

  if (!q) return null;

  const answered = answers[q.id];

  const mcq = q.type === 'mcq';

  const choiceClass = (selected, isCorrect) => {
    if (!answered) return 'border border-transparent bg-secondary text-foreground';
    if (isCorrect) return 'border border-gain bg-gain-soft text-gain';
    if (selected) return 'border border-loss bg-loss-soft text-loss';
    return 'border border-transparent bg-secondary text-muted-foreground';
  };

  return (
    <div
      ref={fit.ref}
      style={fit.style}
      className="flex w-full flex-1 flex-col overflow-hidden px-3 pb-safe"
    >
      <div className="flex shrink-0 items-center justify-between pb-1 text-xs font-medium text-muted-foreground">
        <span>{mcq ? '' : `${idx + 1} of ${questions.length}`}</span>
        <span className="flex items-center gap-1 tabular-nums">
          <Timer className="h-3.5 w-3.5" />
          {fmtTime(qTimeLeft)}
        </span>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        {mcq ? (
          <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col justify-start gap-4 pb-2 sm:-translate-y-8 sm:justify-center sm:py-6">
            <div className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-card px-5 py-6 sm:px-6 sm:py-7">
              <div className="flex shrink-0 items-center justify-between gap-3">
                <p className="text-xs font-semibold text-muted-foreground">{q.prompt ? 'Question' : 'Definition'}</p>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {idx + 1} of {questions.length}
                </span>
              </div>
              <p
                data-mcq-prompt="definition"
                className="mt-6 min-h-0 overflow-y-auto overscroll-contain text-lg font-medium leading-snug tracking-tight"
              >
                {questionPrompt(q)}
              </p>
              <p className="mb-3 mt-8 shrink-0 text-sm font-medium">{q.prompt ? 'Pick one' : 'Pick the term'}</p>
              <div className="grid shrink-0 grid-cols-2 gap-3">
                {q.options.map((opt, i) => {
                  const selected = answered?.selected === opt;
                  const isCorrect = opt === questionAnswer(q);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-keyshortcuts={String(i + 1)}
                      onClick={() => {
                        if (!answered) {
                          record(q.id, { selected: opt, correct: isCorrect });
                          return;
                        }
                        next();
                      }}
                      className={`flex h-full min-h-10 items-center gap-3 rounded-xl px-3.5 py-2 text-left ${choiceClass(selected, isCorrect)}`}
                    >
                      <span className="w-4 shrink-0 text-sm tabular-nums opacity-70">{i + 1}</span>
                      <span className="text-[15px] font-medium leading-snug">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0">
              <p
                className={`mb-3 h-5 text-center text-sm text-muted-foreground transition-opacity duration-700 ${
                  continueCue ? 'opacity-100' : 'opacity-0'
                }`}
                aria-live="polite"
              >
                {canContinue ? 'Press any button to continue' : ''}
              </p>
              <Button
                disabled={!answered}
                onClick={next}
                className="h-12 w-full rounded-full font-semibold"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
        <div className="shrink-0 rounded-3xl bg-card px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Short answer
            {labels[q.tier] ? ` · ${labels[q.tier]}` : ''}
          </p>
          <p className="mt-3 overflow-y-auto overscroll-contain text-3xl font-bold leading-tight tracking-tight">
            {questionPrompt(q)}
          </p>
        </div>
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            {!submitted ? (
              <>
                <textarea
                  value={shortAnswer}
                  maxLength={answerLimit(q)}
                  onChange={(e) => setShortAnswer(clampChars(e.target.value, answerLimit(q)))}
                  placeholder={q.prompt ? 'Type your answer' : 'Type the definition'}
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  enterKeyHint="done"
                  className="min-h-0 w-full flex-1 resize-none rounded-3xl bg-card p-4 text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-2 flex shrink-0 items-center justify-between gap-3">
                  <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                    {shortAnswer.length >= answerLimit(q)
                      ? 'You’ve hit the character limit'
                      : `${shortAnswer.length}/${answerLimit(q)}`}
                  </p>
                  {!showHint ? (
                    <button
                      type="button"
                      onClick={() => setShowHint(true)}
                      className="shrink-0 text-xs font-medium text-muted-foreground underline hover:text-foreground"
                    >
                      Hint
                    </button>
                  ) : null}
                </div>
                {showHint ? (
                  <p className="mt-2 shrink-0 text-sm leading-relaxed text-muted-foreground">
                    {hintFromDefinition(questionAnswer(q) || q.definition)}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your answer</p>
                  <p className="mt-2 whitespace-pre-wrap text-lg leading-relaxed">
                    {clampChars(shortAnswer, answerLimit(q)).trim()}
                  </p>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl bg-gain-soft p-4 text-gain">
                  <p className="text-[11px] font-semibold uppercase tracking-wide">Answer</p>
                  <p className="mt-2 text-lg leading-relaxed">{questionAnswer(q)}</p>
                </div>
              </div>
            )}
          </div>
          </>
        )}
        {!mcq ? (
        <div className="shrink-0 pb-1 pt-3">
          {!submitted ? (
            <Button
              onClick={revealAnswer}
              disabled={!shortAnswer.trim()}
              className="w-full h-12 rounded-full font-semibold"
            >
              <Eye className="w-4 h-4 mr-2" /> Show answer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="destructive"
                onClick={() => {
                  record(q.id, {
                    correct: false,
                    written: clampChars(shortAnswer, answerLimit(q)).trim(),
                  });
                  next();
                }}
                className="h-12 rounded-full font-semibold"
              >
                <X className="w-4 h-4 mr-2" /> Missed
              </Button>
              <Button
                variant="success"
                onClick={() => {
                  record(q.id, {
                    correct: true,
                    written: clampChars(shortAnswer, answerLimit(q)).trim(),
                  });
                  next();
                }}
                className="h-12 rounded-full font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Got it
              </Button>
            </div>
          )}
        </div>
        ) : null}
      </div>
    </div>
  );
}