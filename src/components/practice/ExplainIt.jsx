import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Loader2 } from 'lucide-react';
import { invokeLlm } from '@/api/invokeLlm';
import { parseExplainGrade, MASTERY_LEVELS, localExplainLevel } from '@/lib/mastery';
import UnderstandingPyramid from './UnderstandingPyramid';
import TermPicker from '@/components/practice/TermPicker';

const MAX_EXPLAIN_CHARS = 200;

function clampChars(text, max) {
  return String(text).slice(0, max);
}

export default function ExplainIt({ terms, onUpdateTerm, onDone, rankMode }) {
  const [picked, setPicked] = React.useState(null);
  const queue = React.useMemo(() => (picked || []).map((t) => t.id), [picked]);
  const byId = React.useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const [pos, setPos] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const [grading, setGrading] = React.useState(false);
  const [grade, setGrade] = React.useState(null);
  const [finished, setFinished] = React.useState(false);

  const current = byId[queue[pos]];

  React.useEffect(() => {
    setDraft('');
    setGrade(null);
    setGrading(false);
  }, [pos]);

  const gradeExplanation = async () => {
    const text = clampChars(draft, MAX_EXPLAIN_CHARS).trim();
    if (!text || !current) return;
    if (text.length < 20) {
      const result = {
        level: MASTERY.GUESS,
        pointsHit: [],
        pointsMissed: ['Needs a real explanation, not a short guess.'],
        feedback: 'Too short to show you could teach this. Say it like you would to a classmate.',
      };
      setGrade(result);
      onUpdateTerm(current.id, { mastery: result.level });
      return;
    }
    setGrading(true);
    try {
      const related = (current.depends_on || []).join(', ') || 'none listed';
      const res = await invokeLlm({
        prompt:
          `You are grading whether a student can TEACH a concept, not whether they can recite a definition.\n` +
          `Term: ${current.term}\n` +
          `Correct meaning: ${current.definition}\n` +
          `Related ideas: ${related}\n` +
          `Student explanation:\n${text}\n\n` +
          `Score 1–4:\n` +
          `1 Guess — vague, mostly wrong, or just restates the term.\n` +
          `2 Getting there — some correct ideas, missing important points.\n` +
          `3 Solid — would help a classmate; a few gaps.\n` +
          `4 Mastered — teaches it fully: what it is, why it matters, and the key related points, as if explaining to a beginner. Do not give 4 for a short paraphrase of the definition.\n` +
          `Return JSON { "level": 1-4, "points_hit": ["..."], "points_missed": ["..."], "feedback": "one or two sentences" }.`,
        feature: 'explain',
        response_json_schema: {
          type: 'object',
          properties: {
            level: { type: 'number' },
            points_hit: { type: 'array', items: { type: 'string' } },
            points_missed: { type: 'array', items: { type: 'string' } },
            feedback: { type: 'string' },
          },
          required: ['level', 'points_hit', 'points_missed', 'feedback'],
        },
      });
      const parsed = parseExplainGrade(res);
      if (!parsed) throw new Error('unreadable');
      setGrade(parsed);
      onUpdateTerm(current.id, { mastery: parsed.level });
    } catch {
      const level = localExplainLevel(text, current.definition);
      const fallback = {
        level,
        pointsHit: [],
        pointsMissed: [],
        feedback:
          'Couldn’t reach AI grading, so this is a rough keyword check. Mastered is only awarded by a full teaching grade.',
      };
      setGrade(fallback);
      onUpdateTerm(current.id, { mastery: fallback.level });
    }
    setGrading(false);
  };

  const next = () => {
    if (pos + 1 >= queue.length) setFinished(true);
    else setPos((p) => p + 1);
  };

  if (!picked) {
    return (
      <TermPicker
        terms={terms}
        rankMode={rankMode}
        verb="explain"
        action="Start explaining"
        onStart={setPicked}
      />
    );
  }

  if (!queue.length || finished) {
    return (
      <div className="flex-1 flex flex-col px-5 pt-6">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col items-center text-center pt-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">
            {!queue.length ? 'Nothing left to explain' : 'Explain-it wrap'}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {!queue.length
              ? 'Every term is already mastered. Keep it that way with a practice test now and then.'
              : 'Your pyramid for each term is saved. Mastered only stays if you earned the peak.'}
          </p>
          <Button
            onClick={onDone}
            className="w-full h-12 rounded-2xl font-semibold"
          >
            Back to practice
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  const atCharLimit = draft.length >= MAX_EXPLAIN_CHARS;

  const label = MASTERY_LEVELS.find((l) => l.level === grade?.level)?.label;

  return (
    <div className="flex-1 flex flex-col px-5 pt-4 overflow-y-auto">
      <p className="text-xs text-muted-foreground mb-3">
        Explain it · {pos + 1}/{queue.length}
      </p>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col pb-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Teach this</p>
          <p className="text-3xl font-bold tracking-tight">{current.term}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Explain it like you would to a classmate who has never heard the term. Cover what it is and why it matters.
          </p>
        </div>

        {!grade ? (
          <>
            <Textarea
              value={draft}
              maxLength={MAX_EXPLAIN_CHARS}
              onChange={(e) => setDraft(clampChars(e.target.value, MAX_EXPLAIN_CHARS))}
              placeholder="Start with what it is, then how you'd teach it…"
              className="mt-4 min-h-[160px] rounded-2xl text-base p-4"
            />
            <p className="mt-2 text-xs text-muted-foreground tabular-nums" aria-live="polite">
              {atCharLimit
                ? 'You’ve hit the character limit'
                : `${draft.length}/${MAX_EXPLAIN_CHARS}`}
            </p>
            <Button
              onClick={gradeExplanation}
              disabled={!draft.trim() || grading}
              className="mt-4 w-full h-12 rounded-2xl font-semibold"
            >
              {grading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Grading…
                </>
              ) : (
                'Grade my explanation'
              )}
            </Button>
          </>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-3xl border border-border bg-card p-5">
              <UnderstandingPyramid level={grade.level} size="lg" showLabels />
              <p className="text-center text-sm font-semibold mt-3">{label}</p>
              {grade.feedback && (
                <p className="text-sm text-muted-foreground mt-2 text-center leading-relaxed">{grade.feedback}</p>
              )}
            </div>
            {grade.pointsHit.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold mb-1">You hit</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {grade.pointsHit.map((p, i) => (
                    <li key={`hit-${i}`}>· {p}</li>
                  ))}
                </ul>
              </div>
            )}
            {grade.pointsMissed.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold mb-1">Work on</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {grade.pointsMissed.map((p, i) => (
                    <li key={`miss-${i}`}>· {p}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-xl bg-muted p-3 text-lg leading-relaxed">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">For reference</p>
              <p className="mt-1">{current.definition}</p>
            </div>
            <Button
              onClick={next}
              className="w-full h-12 rounded-2xl font-semibold"
            >
              {pos + 1 >= queue.length ? 'Finish' : 'Next term'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
