import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Check, X, ArrowRight } from 'lucide-react';
import { fmtTime, normalizeExamType, flashcardDef } from '@/lib/studyUtils';
import { buildMcCard } from '@/lib/spacedCram';
import CardProgress, { cardProgressCaption } from '@/components/study/CardProgress';
import { useDebug } from '@/lib/DebugContext';
import WriteOwnDef, {
  STUCK_AFTER_ROTATIONS,
  cardsAtStuckThreshold,
  writtenReviewPlan,
} from '@/components/study/WriteOwnDef';
import useFillBelow from '@/components/study/useFillBelow';

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
function pickRecallTermDistractors(allTerms, correct, n) {
  const depSet = new Set(correct.depends_on || []);
  const candidates = allTerms.filter((t) => t.id !== correct.id);
  const cluster = candidates.filter((t) => (t.depends_on || []).some((d) => depSet.has(d)));
  const sameTier = candidates.filter((t) => t.tier === correct.tier);
  const pool = [...cluster, ...sameTier, ...candidates];
  const seen = new Set();
  const out = [];
  for (const t of pool) {
    if (seen.has(t.term)) continue;
    seen.add(t.term);
    out.push(t.term);
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
  mixReverse = false,
  cardMode = 'flash',
  mcIds = [],
  mcDirections = {},
  distractorTerms,
  onUpdateTerm,
  onLogAttempt,
  onCardTimed,
  onDone,
  onOpenCheat,
  showProgress = true,
}) {
  const { logEvent } = useDebug() || {};
  const mcSet = React.useMemo(() => new Set(mcIds || []), [mcIds]);
  const planCache = React.useRef({ key: '', plan: null });
  const shownAtRef = React.useRef(Date.now());
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

  const planKey = `${currentId}|${st.pos}|${st.round}|${cardSeq}`;
  if (planCache.current.key !== planKey) {
    let plan = null;
    const wantsMc = current && (cardMode === 'mc' || mcSet.has(current.id));
    if (wantsMc) {
      const pool = distractorTerms?.length ? distractorTerms : terms;
      const preferred = mcDirections?.[current.id] === 'def' ? 'def' : 'term';
      const built = buildMcCard(pool, current, preferred)
        || buildMcCard(pool, current, preferred === 'term' ? 'def' : 'term');
      if (built) {
        plan = { ...built, options: shuffle(built.options) };
      }
    }
    planCache.current = { key: planKey, plan };
  }
  const liveMc = planCache.current.plan;

  const reverse = !liveMc && cardMode !== 'mc' && mixReverse && st.pos % 2 === 1;
  const style = liveMc ? 'mc' : (reverse ? 'free_recall' : cardStyle(examType, st.pos));

  React.useLayoutEffect(() => {
    shownAtRef.current = Date.now();
  }, [currentId, st.pos, st.round, cardSeq]);

  // Reset per-card interaction state when the card (or attempt) changes.
  // Options are shuffled once here and held until the card is answered.
  React.useEffect(() => {
    advancingRef.current = false;
    setRevealed(false);
    setRecogSelected(null);
    if (liveMc) {
      setRecogOptions(liveMc.options);
    } else if (current && style === 'recognition') {
      const distractors = pickRecallTermDistractors(terms, current, 3);
      setRecogOptions(shuffle([current.term, ...distractors]));
    } else {
      setRecogOptions(null);
    }
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

  const reportCardTime = () => {
    if (!onCardTimed) return;
    const live = planCache.current.plan;
    const mode = live?.direction === 'def' ? 'mc_def' : live ? 'mc_term' : 'flash';
    onCardTimed({ mode, ms: Math.max(0, Date.now() - shownAtRef.current) });
  };

  const handleGot = () => {
    if (!current || advancingRef.current) return;
    advancingRef.current = true;
    const newStreak = (current.correctStreak || 0) + 1;
    onUpdateTerm(current.id, { correctStreak: newStreak });
    reportCardTime();
    onLogAttempt(current.id, 'got_it', planCache.current.plan ? 'mc' : 'flash');
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
    reportCardTime();
    onLogAttempt(missedId, 'missed', planCache.current.plan ? 'mc' : 'flash');
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

  const multipleChoice = style === 'mc';
  const defOptions = liveMc?.direction === 'def';
  const promptLabel = multipleChoice
    ? (defOptions ? 'Pick the definition' : 'Pick the term')
    : style === 'recognition'
      ? 'Pick the term'
      : reverse
        ? 'Definition'
        : style === 'explain'
          ? 'Explain in your own words'
          : 'Term';
  const recognition = style === 'recognition' || multipleChoice;
  const defCards = cardsAtStuckThreshold(st.queue, byId, missCountRef.current, writtenRef.current);
  const writeCards = stuck?.length ? stuck : defMode ? defCards : null;
  const fit = useFillBelow(recognition && !!current && !writeCards?.length);

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

  const progressTotal = singlePass ? st.queue.length : terms.length;
  const progressDone = singlePass ? Math.min(st.pos, progressTotal) : Math.min(gotCount, progressTotal);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {showProgress && progressTotal > 0 && (
        <div className="px-4 pt-3 shrink-0">
          <CardProgress
            done={progressDone}
            total={progressTotal}
            caption={cardProgressCaption(progressTotal, progressDone)}
          />
        </div>
      )}
    <div
      ref={recognition ? fit.ref : undefined}
      style={recognition ? fit.style : undefined}
      className={recognition ? 'flex flex-col px-5 pt-3 pb-safe overflow-hidden' : 'flex-1 flex flex-col px-5 pt-4'}
    >
      <div className={`flex shrink-0 items-center justify-between text-meta text-muted-foreground ${recognition ? 'mb-2' : 'mb-6'}`}>
        <span>{reviewing ? 'Practice your wording' : blockLabel}</span>
        <span>
          {timed ? `${fmtTime(timeLeftMs)} left · ` : ''}round {st.round}
        </span>
      </div>
      <div className={`mx-auto flex w-full max-w-study flex-col gap-6 ${recognition ? 'min-h-0 flex-1' : 'flex-1 items-center justify-center'}`}>
        <div
          className={`flex w-full flex-col rounded-card border border-border bg-surface-1 ${
            recognition
              ? 'min-h-0 overflow-hidden p-6 text-left'
              : 'min-h-card items-center justify-center p-8 text-center'
          }`}
        >
          <p className="shrink-0 text-label uppercase text-muted-foreground">{promptLabel}</p>
          {recognition ? (
            <p
              data-mcq-prompt={defOptions ? 'term' : 'definition'}
              className="min-h-0 overflow-y-auto overscroll-contain text-body font-semibold text-foreground"
            >
              {defOptions ? current.term : current.definition}
            </p>
          ) : (
            <p className={reverse ? 'mt-6 break-words text-body text-foreground' : 'mt-6 break-words text-display text-foreground'}>
              {reverse ? flashcardDef(current) : current.term}
            </p>
          )}

          {recognition ? (
            <div className="mt-3 w-full space-y-2 shrink-0">
              {(recogOptions || []).map((opt, i) => {
                const answer = liveMc?.answer || current.term;
                const selected = recogSelected === opt;
                const isCorrect = opt === answer;
                return (
                  <button
                    key={`${opt}-${i}`}
                    onClick={() => {
                      if (recogSelected || advancingRef.current) return;
                      setRecogSelected(opt);
                      if (!multipleChoice) return;
                      window.setTimeout(() => {
                        if (opt === answer) handleGot();
                        else handleMissed();
                      }, 450);
                    }}
                    className={`press w-full rounded-input border px-4 py-3 text-left text-body leading-snug transition-colors duration-150 ease-out ${
                      recogSelected
                        ? isCorrect
                          ? 'border-know/30 bg-know/12 text-know'
                          : selected
                          ? 'border-loss bg-loss-soft text-loss'
                          : 'border-border'
                        : 'option-surface'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : revealed ? (
            <p className="animate-reveal-in mt-6 break-words text-body text-foreground">
              {reverse ? current.term : flashcardDef(current)}
            </p>
          ) : (
            <p className="mt-6 text-meta text-muted-foreground">
              {reverse
                ? 'Say the term, then reveal.'
                : style === 'explain'
                  ? 'Reveal the definition to self-grade your explanation.'
                  : 'Reveal the definition, then grade yourself.'}
            </p>
          )}
        </div>

        <div className="w-full shrink-0">
          {multipleChoice ? null : recognition ? (
            recogSelected ? (
              <Button
                onClick={() => (recogSelected === current.term ? handleGot() : handleMissed())}
                className="w-full h-12 rounded-full font-semibold"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button disabled className="w-full">
                Pick an answer
              </Button>
            )
          ) : !revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              className="w-full h-12 rounded-full font-semibold"
            >
              <Eye className="w-4 h-4 mr-2" /> Show answer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleMissed}
                variant="destructive"
                className="h-12 rounded-full font-semibold"
              >
                <X className="w-4 h-4 mr-2" /> Missed
              </Button>
              <Button
                onClick={handleGot}
                variant="success"
                className="h-12 rounded-full font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Got it
              </Button>
            </div>
          )}
        </div>
        <p className="shrink-0 text-center text-meta text-muted-foreground">
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
    </div>
  );
}