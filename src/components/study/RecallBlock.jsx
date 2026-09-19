import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Check, X, ArrowRight } from 'lucide-react';
import { fmtTime, normalizeExamType, flashcardDef } from '@/lib/studyUtils';
import { useDebug } from '@/lib/DebugContext';
import WriteOwnDef, {
  STUCK_AFTER_ROTATIONS,
  cardsAtStuckThreshold,
  writtenReviewPlan,
} from '@/components/study/WriteOwnDef';

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
  blockBudgetMs = 0,
  singlePass = false,
  blockLabel,
  examType = 'mixed',
  onUpdateTerm,
  onLogAttempt,
  onDone,
  onOpenCheat,
}) {
  const { logEvent } = useDebug() || {};
  const timed = Number(blockBudgetMs) > 0;
  const byId = React.useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const idsKey = terms.map((t) => t.id).filter((id) => id != null && id !== '').join('|');

  const [st, setSt] = React.useState(() => ({
    queue: terms.map((t) => t.id).filter((id) => id != null && id !== ''),
    pos: 0,
    round: 1,
  }));
  const [revealed, setRevealed] = React.useState(false);
  const [timeLeftMs, setTimeLeftMs] = React.useState(blockBudgetMs);
  const [gotCount, setGotCount] = React.useState(0);
  const [recogSelected, setRecogSelected] = React.useState(null);
  const [recogOptions, setRecogOptions] = React.useState(null);
  const [cardSeq, setCardSeq] = React.useState(0);
  const gotRef = React.useRef(0);
  const doneRef = React.useRef(false);
  const idsKeyRef = React.useRef(idsKey);
  const skipFinishRef = React.useRef(false);
  const advancingRef = React.useRef(false);
  const missCountRef = React.useRef({});
  const deferredRef = React.useRef(new Set());
  const writtenRef = React.useRef(new Set());
  const leftoverRef = React.useRef(null);
  const [stuck, setStuck] = React.useState(null);
  const [defMode, setDefMode] = React.useState(false);
  const [skipped, setSkipped] = React.useState(false);
  const [reviewing, setReviewing] = React.useState(false);

  const finish = React.useCallback(
    (reason) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone({ got: gotRef.current, total: terms.length, reason });
    },
    [onDone, terms.length]
  );

  // New term set (empty Critical → Core, resume, etc.) — don't keep the old empty queue.
  React.useLayoutEffect(() => {
    if (idsKeyRef.current === idsKey) return;
    idsKeyRef.current = idsKey;
    const ids = terms.map((t) => t.id).filter((id) => id != null && id !== '');
    doneRef.current = false;
    gotRef.current = 0;
    skipFinishRef.current = true;
    setGotCount(0);
    setStuck(null);
    setDefMode(false);
    setSkipped(false);
    setReviewing(false);
    missCountRef.current = {};
    deferredRef.current = new Set();
    writtenRef.current = new Set();
    leftoverRef.current = null;
    setSt({ queue: ids, pos: 0, round: 1 });
    setTimeLeftMs(blockBudgetMs);
  }, [idsKey, terms, blockBudgetMs]);

  // Block countdown — ends block on time budget exhausted.
  React.useEffect(() => {
    if (!timed) return undefined;
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
  }, [timed, blockBudgetMs, finish]);

  // Finish as soon as the queue is empty so we never sit on "Wrapping up…"
  React.useLayoutEffect(() => {
    if (skipFinishRef.current) {
      skipFinishRef.current = false;
      return;
    }
    if (doneRef.current) return;
    if (stuck || defMode) return;
    if (!singlePass && st.queue.length === 0) {
      if (leftoverRef.current?.length) {
        const rest = leftoverRef.current;
        leftoverRef.current = null;
        skipFinishRef.current = true;
        setReviewing(false);
        setSt((s) => ({ ...s, queue: rest, pos: 0 }));
        return;
      }
      finish('retired');
    } else if (singlePass && st.pos >= st.queue.length) finish('pass');
  }, [st.queue.length, st.pos, singlePass, finish, stuck, defMode]);

  const currentId = st.queue[st.pos];
  const current = currentId != null ? byId[currentId] : null;

  const style = cardStyle(examType, st.pos);

  // Reset per-card interaction state when the card (or attempt) changes.
  // Options are shuffled once here and held until the card is answered.
  React.useEffect(() => {
    advancingRef.current = false;
    setRevealed(false);
    setRecogSelected(null);
    if (current && style === 'recognition') {
      const distractors = pickRecallDistractors(terms, current, 3);
      setRecogOptions(shuffle([current.definition, ...distractors]));
    } else {
      setRecogOptions(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, st.pos, st.round, cardSeq]);

  React.useLayoutEffect(() => {
    if (singlePass || stuck || defMode || !current) return;
    if (deferredRef.current.has(current.id) || writtenRef.current.has(current.id)) return;
    if (String(current.ownDefinition || '').trim()) return;
    if ((missCountRef.current[current.id] || 0) < STUCK_AFTER_ROTATIONS) return;
    const skip = new Set([...deferredRef.current, ...writtenRef.current]);
    const batch = cardsAtStuckThreshold(st.queue, byId, missCountRef.current, skip);
    if (batch.length) {
      setRevealed(false);
      setRecogSelected(null);
      setStuck(batch);
    }
  }, [currentId, st.queue, stuck, defMode, singlePass, current, byId]);

  const handleGot = () => {
    if (!current || advancingRef.current) return;
    advancingRef.current = true;
    const newStreak = (current.correctStreak || 0) + 1;
    onUpdateTerm(current.id, { correctStreak: newStreak });
    onLogAttempt(current.id, 'got_it');
    missCountRef.current[current.id] = 0;
    deferredRef.current.delete(current.id);
    setRevealed(false);
    setRecogSelected(null);
    setCardSeq((n) => n + 1);

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

  const requeueMissed = (missedId) => {
    advancingRef.current = true;
    setRevealed(false);
    setRecogSelected(null);
    setCardSeq((n) => n + 1);

    if (singlePass) {
      setSt((s) => ({ ...s, pos: s.pos + 1 }));
      return;
    }

    setSt((s) => {
      const nq = [...s.queue];
      const at = nq.indexOf(missedId);
      if (at >= 0) nq.splice(at, 1);
      if (nq.length === 0) {
        return { queue: [missedId], pos: 0, round: s.round + 1 };
      }
      const nextPos = at < 0 ? s.pos : (at >= nq.length ? 0 : at);
      const offset = 3 + Math.floor(Math.random() * 4);
      const insertAt = Math.min(nextPos + offset, nq.length);
      nq.splice(insertAt, 0, missedId);
      const pos = insertAt <= nextPos ? nextPos + 1 : nextPos;
      const wrapped = nextPos === 0 && at !== 0;
      return { queue: nq, pos, round: wrapped ? s.round + 1 : s.round };
    });
  };

  const handleMissed = () => {
    if (!current) return;
    const lastInRotation = !singlePass && st.queue.length === 1;
    if (advancingRef.current && !lastInRotation) return;
    const missedId = current.id;
    onUpdateTerm(missedId, { correctStreak: 0 });
    onLogAttempt(missedId, 'missed');
    logEvent?.(`Term "${current.term}" missed${singlePass ? '' : ', requeued'}`);
    const misses = (missCountRef.current[missedId] || 0) + 1;
    missCountRef.current[missedId] = misses;

    if (lastInRotation) {
      advancingRef.current = false;
      setRevealed(false);
      setRecogSelected(null);
      if (
        !singlePass &&
        misses >= STUCK_AFTER_ROTATIONS &&
        !deferredRef.current.has(missedId) &&
        !writtenRef.current.has(missedId) &&
        !String(byId[missedId]?.ownDefinition || '').trim() &&
        !stuck
      ) {
        const skip = new Set([...deferredRef.current, ...writtenRef.current]);
        const batch = cardsAtStuckThreshold(st.queue, byId, missCountRef.current, skip);
        if (batch.length) setStuck(batch);
      }
      return;
    }

    requeueMissed(missedId);
  };

  const startWrittenReview = (entries, fallbackCards) => {
    const { ids, defs, leftover } = writtenReviewPlan(entries, fallbackCards || [], st.queue);
    if (!ids.length) {
      setStuck(null);
      setDefMode(false);
      return;
    }
    ids.forEach((id) => {
      missCountRef.current[id] = 0;
      deferredRef.current.delete(id);
      writtenRef.current.add(id);
      if (defs[id]) onUpdateTerm(id, { ownDefinition: defs[id] });
    });
    leftoverRef.current = leftover;
    skipFinishRef.current = true;
    setReviewing(true);
    setStuck(null);
    setDefMode(false);
    setRevealed(false);
    setRecogSelected(null);
    setSt((s) => ({ queue: ids, pos: 0, round: s.round }));
    setCardSeq((n) => n + 1);
  };

  const promptLabel =
    style === 'explain'
      ? 'Explain in your own words'
      : style === 'recognition'
      ? 'Pick the correct definition'
      : 'Term';

  const defCards = cardsAtStuckThreshold(st.queue, byId, missCountRef.current, writtenRef.current);
  const writeCards = stuck?.length ? stuck : defMode ? defCards : null;

  if (writeCards?.length) {
    return (
      <div className="flex-1 flex flex-col">
        <WriteOwnDef
          cards={writeCards}
          allTerms={defMode ? terms : undefined}
          variant={defMode ? 'defMode' : 'stuck'}
          onComplete={(entries) => startWrittenReview(entries, writeCards)}
          onSkip={() => {
            if (defMode) {
              setDefMode(false);
              return;
            }
            (stuck || []).forEach((c) => deferredRef.current.add(c.id));
            setSkipped(true);
            setStuck(null);
          }}
        />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex items-center justify-center px-8 py-16">
        <p className="text-sm text-muted-foreground">Wrapping up…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-4">
      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>{reviewing ? 'Practice your wording' : blockLabel}</span>
        <span>
          {timed ? `${fmtTime(timeLeftMs)} left · ` : ''}round {st.round}
        </span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm text-center min-h-[280px] flex flex-col items-center justify-center">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">{promptLabel}</p>
          <p className="text-3xl font-bold tracking-tight">{current.term}</p>

          {style === 'recognition' ? (
            <div className="mt-5 w-full space-y-2 text-left">
              {(recogOptions || []).map((opt, i) => {
                const selected = recogSelected === opt;
                const isCorrect = opt === current.definition;
                return (
                  <button
                    key={i}
                    onClick={() => !recogSelected && setRecogSelected(opt)}
                    className={`w-full text-left rounded-xl border px-4 py-3 text-lg leading-relaxed transition ${
                      recogSelected
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
          ) : revealed ? (
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">{flashcardDef(current)}</p>
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
                className="w-full h-12 rounded-2xl font-semibold"
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
              className="w-full h-12 rounded-2xl font-semibold"
            >
              <Eye className="w-4 h-4 mr-2" /> Show answer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleMissed}
                variant="destructive"
                className="h-12 rounded-2xl font-semibold"
              >
                <X className="w-4 h-4 mr-2" /> Missed
              </Button>
              <Button
                onClick={handleGot}
                variant="success"
                className="h-12 rounded-2xl font-semibold"
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
        {defCards.length > 0 && skipped && !singlePass && (
          <button
            type="button"
            onClick={() => setDefMode(true)}
            className="mt-3 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Def mode · {defCards.length}
          </button>
        )}
        {onOpenCheat && (
          <button
            type="button"
            onClick={onOpenCheat}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Cheat sheet
          </button>
        )}
      </div>
    </div>
  );
}