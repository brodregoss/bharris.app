import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Check, X, ArrowRight } from 'lucide-react';
import { fmtTime, normalizeExamType } from '@/lib/studyUtils';
import { useDebug } from '@/lib/DebugContext';

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// Distractors prefer terms sharing a depends_on concept (topic cluster),
// then same tier, then any other term — plausible near-misses, not random picks.
function pickRecallDistractors(allTerms, correct, n) {
  const depSet = new Set(correct.depends_on || []);
  const candidates = allTerms.filter((t) => t.id !== correct.id);
  const cluster = candidates.filter((t) => (t.depends_on || []).some((d) => depSet.has(d)));
  const sameTier = candidates.filter((t) => t.tier === correct.tier);
  const pool = [...cluster, ...sameTier, ...candidates];
  const seen = new Set();
  const out = [];
  for (const t of pool) {
    if (seen.has(t.definition)) continue;
    seen.add(t.definition);
    out.push(t.definition);
    if (out.length >= n) break;
  }
  return out;
}

// Per-card recall style, driven by exam type.
function cardStyle(examType, i) {
  const t = normalizeExamType(examType);
  if (t === 'mcq') return i % 4 === 3 ? 'recognition' : 'free_recall';
  if (t === 'short_answer') return i % 5 === 4 ? 'explain' : 'free_recall';
  return i % 2 === 1 ? 'recognition' : 'free_recall'; // mixed alternates card-by-card
}

// Shared flashcard mechanic for Screen A (critical, retire=2),
// Screen B (core, retire=1), and the 5-min drill in Screen E (singlePass).
export default function RecallBlock({
  terms,
  retireThreshold,
  blockBudgetMs,
  singlePass = false,
  blockLabel,
  examType = 'mixed',
  onUpdateTerm,
  onLogAttempt,
  onDone,
}) {
  const { logEvent } = useDebug() || {};
  const byId = React.useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);

  const [st, setSt] = React.useState({ queue: terms.map((t) => t.id), pos: 0, round: 1 });
  const [revealed, setRevealed] = React.useState(false);
  const [timeLeftMs, setTimeLeftMs] = React.useState(blockBudgetMs);
  const [gotCount, setGotCount] = React.useState(0);
  const [recogSelected, setRecogSelected] = React.useState(null);
  const [recogOptions, setRecogOptions] = React.useState(null);
  const gotRef = React.useRef(0);
  const doneRef = React.useRef(false);

  const finish = React.useCallback(
    (reason) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone({ got: gotRef.current, total: terms.length, reason });
    },
    [onDone, terms.length]
  );

  // Block countdown — ends block on time budget exhausted.
  React.useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const left = blockBudgetMs - (Date.now() - start);
      setTimeLeftMs(left);
      if (left <= 0) {
        clearInterval(iv);
        finish('time');
      }
    }, 250);
    return () => clearInterval(iv);
  }, [blockBudgetMs, finish]);

  // Non-singlePass: block ends when every term has retired.
  React.useEffect(() => {
    if (!singlePass && st.queue.length === 0) finish('retired');
  }, [st.queue.length, singlePass, finish]);

  // SinglePass: block ends after one clean pass.
  React.useEffect(() => {
    if (singlePass && st.pos >= st.queue.length) finish('pass');
  }, [st.pos, st.queue.length, singlePass, finish]);

  const currentId = st.queue[st.pos];
  const current = currentId != null ? byId[currentId] : null;

  const style = cardStyle(examType, st.pos);

  // Reset per-card interaction state when the card changes.
  // Options are shuffled once here and held until the card is answered.
  React.useEffect(() => {
    setRevealed(false);
    setRecogSelected(null);
    if (current && style === 'recognition') {
      const distractors = pickRecallDistractors(terms, current, 3);
      setRecogOptions(shuffle([current.definition, ...distractors]));
    } else {
      setRecogOptions(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  if (!current) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Wrapping up…</p>
      </div>
    );
  }

  const handleGot = () => {
    const newStreak = (current.correctStreak || 0) + 1;
    onUpdateTerm(current.id, { correctStreak: newStreak });
    onLogAttempt(current.id, 'got_it');

    if (singlePass) {
      setSt((s) => ({ ...s, pos: s.pos + 1 }));
      return;
    }

    if (newStreak >= retireThreshold) {
      gotRef.current += 1;
      setGotCount(gotRef.current);
      setSt((s) => {
        const nq = [...s.queue];
        nq.splice(s.pos, 1);
        const wrapped = s.pos >= nq.length;
        return { queue: nq, pos: wrapped ? 0 : s.pos, round: wrapped ? s.round + 1 : s.round };
      });
    } else {
      setSt((s) => {
        const np = s.pos + 1;
        if (np >= s.queue.length) return { ...s, pos: 0, round: s.round + 1 };
        return { ...s, pos: np };
      });
    }
  };

  const handleMissed = () => {
    onUpdateTerm(current.id, { correctStreak: 0 });
    onLogAttempt(current.id, 'missed');
    logEvent?.(`Term "${current.term}" missed${singlePass ? '' : ', requeued'}`);

    if (singlePass) {
      setSt((s) => ({ ...s, pos: s.pos + 1 }));
      return;
    }

    setSt((s) => {
      const nq = [...s.queue];
      nq.splice(s.pos, 1);
      const offset = 3 + Math.floor(Math.random() * 4);
      const insertAt = Math.min(s.pos + offset, nq.length);
      nq.splice(insertAt, 0, current.id);
      const wrapped = s.pos >= nq.length;
      return { queue: nq, pos: wrapped ? 0 : s.pos, round: wrapped ? s.round + 1 : s.round };
    });
  };

  const promptLabel =
    style === 'explain'
      ? 'Explain in your own words'
      : style === 'recognition'
      ? 'Pick the correct definition'
      : 'Term';

  return (
    <div className="flex flex-col px-5 pt-4">
      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>{blockLabel}</span>
        <span>
          {fmtTime(timeLeftMs)} left · round {st.round}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm text-center min-h-[280px] flex flex-col items-center justify-center">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">{promptLabel}</p>
          <p className="text-2xl font-bold tracking-tight">{current.term}</p>

          {style === 'recognition' ? (
            <div className="mt-5 w-full space-y-2 text-left">
              {(recogOptions || []).map((opt, i) => {
                const selected = recogSelected === opt;
                const isCorrect = opt === current.definition;
                return (
                  <button
                    key={i}
                    onClick={() => !recogSelected && setRecogSelected(opt)}
                    className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition ${
                      recogSelected
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
          ) : revealed ? (
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">{current.definition}</p>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">
              {style === 'explain'
                ? 'Reveal the definition to self-grade your explanation.'
                : 'Reveal the definition, then grade yourself.'}
            </p>
          )}
        </div>

        <div className="w-full max-w-md mt-4">
          {style === 'recognition' ? (
            recogSelected ? (
              <Button
                onClick={() => (recogSelected === current.definition ? handleGot() : handleMissed())}
                className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button disabled className="w-full h-12 rounded-2xl bg-muted text-muted-foreground font-semibold">
                Pick an answer
              </Button>
            )
          ) : !revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              <Eye className="w-4 h-4 mr-2" /> Show answer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleMissed}
                variant="outline"
                className="h-12 rounded-2xl border-rose-300 text-rose-600 hover:bg-rose-50 font-semibold"
              >
                <X className="w-4 h-4 mr-2" /> Missed
              </Button>
              <Button
                onClick={handleGot}
                className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Got it
              </Button>
            </div>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {singlePass
            ? `${Math.min(st.pos + 1, st.queue.length)}/${st.queue.length} seen`
            : `${gotCount} retired · ${st.queue.length} in rotation`}
        </p>
      </div>
    </div>
  );
}