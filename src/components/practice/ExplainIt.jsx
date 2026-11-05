import React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Loader2 } from 'lucide-react';
import { invokeLlm } from '@/api/invokeLlm';
import { parseExplainGrade, MASTERY, MASTERY_LEVELS, localExplainLevel } from '@/lib/mastery';
import UnderstandingPyramid from './UnderstandingPyramid';
import TermPicker from '@/components/practice/TermPicker';
import StudyScreenShell from '@/components/study/StudyScreenShell';

const MAX_EXPLAIN_CHARS = 200;

function clampChars(text, max) {
  return String(text).slice(0, max);
}

export default function ExplainIt({ terms, onUpdateTerm, onDone, onBack, rankMode }) {
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
      onUpdateTerm(current.id, { mastery: result.level, practiceCorrect: result.level >= MASTERY.SOLID });
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
      onUpdateTerm(current.id, { mastery: parsed.level, practiceCorrect: parsed.level >= MASTERY.SOLID });
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
      onUpdateTerm(current.id, { mastery: fallback.level, practiceCorrect: fallback.level >= MASTERY.SOLID });
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
        onBack={onBack}
        onStart={setPicked}
      />
    );
  }

  if (!queue.length || finished) {
    const doneBody = (
      <div className="text-center">
        <h2 className="text-title text-foreground">
          {!queue.length ? 'Nothing left to explain' : 'Explain-it wrap'}
        </h2>
        <p className="mt-3 text-body text-muted-foreground">
          {!queue.length
            ? 'Every term is already mastered. Keep it that way with a practice test now and then.'
            : 'Your pyramid for each term is saved. Mastered only stays if you earned the peak.'}
        </p>
      </div>
    );
    const doneAction = (
      <Button onClick={onDone} className="w-full">
        Back to practice
        <ArrowRight className="h-4 w-4" />
      </Button>
    );
    if (onBack) {
      return <StudyScreenShell onBack={onBack} action={doneAction}>{doneBody}</StudyScreenShell>;
    }
    return (
      <div className="flex flex-1 flex-col px-gutter pt-8">
        <div className="mx-auto flex w-full max-w-study flex-1 flex-col gap-6">
          {doneBody}
          {doneAction}
        </div>
      </div>
    );
  }

  const atCharLimit = draft.length >= MAX_EXPLAIN_CHARS;

  const label = MASTERY_LEVELS.find((l) => l.level === grade?.level)?.label;

  const explainBody = (
    <>
      <div className="animate-reveal-in rounded-card border border-border bg-surface-1 p-8">
        <p className="text-label uppercase text-muted-foreground">Teach this</p>
        <p className="mt-6 text-center text-display text-foreground">{current.term}</p>
        <p className="mt-6 text-meta text-muted-foreground">
          Explain it like you would to a classmate who has never heard the term. Cover what it is and why it matters.
        </p>
      </div>

      {!grade ? (
        <>
          <label className="text-label uppercase text-muted-foreground" htmlFor="explain-draft">Explain the term</label>
          <Textarea
            id="explain-draft"
            value={draft}
            maxLength={MAX_EXPLAIN_CHARS}
            onChange={(e) => setDraft(clampChars(e.target.value, MAX_EXPLAIN_CHARS))}
            placeholder="Start with what it is, then how you'd teach it…"
          />
          <p className="text-meta tabular-nums text-muted-foreground" aria-live="polite">
            {atCharLimit
              ? 'You’ve hit the character limit'
              : `${draft.length}/${MAX_EXPLAIN_CHARS}`}
          </p>
        </>
      ) : (
        <>
          <div className="rounded-card border border-border bg-surface-1 p-6">
            <UnderstandingPyramid level={grade.level} size="lg" showLabels />
            <p className="mt-4 text-center text-body font-semibold text-foreground">{label}</p>
            {grade.feedback && (
              <p className="mt-2 text-center text-meta text-muted-foreground">{grade.feedback}</p>
            )}
          </div>
          {grade.pointsHit.length > 0 && (
            <div>
              <p className="text-label uppercase text-know">You hit</p>
              <ul className="mt-2 space-y-1 text-body text-muted-foreground">
                {grade.pointsHit.map((p, i) => (
                  <li key={`hit-${i}`}>· {p}</li>
                ))}
              </ul>
            </div>
          )}
          {grade.pointsMissed.length > 0 && (
            <div>
              <p className="text-label uppercase text-shaky">Work on</p>
              <ul className="mt-2 space-y-1 text-body text-muted-foreground">
                {grade.pointsMissed.map((p, i) => (
                  <li key={`miss-${i}`}>· {p}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-card border border-border bg-surface-1 p-6">
            <p className="text-label uppercase text-muted-foreground">For reference</p>
            <p className="mt-3 text-body text-foreground">{current.definition}</p>
          </div>
        </>
      )}
    </>
  );

  const explainAction = !grade ? (
    <Button
      onClick={gradeExplanation}
      disabled={!draft.trim() || grading}
      className="w-full"
    >
      {grading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Grading…
        </>
      ) : (
        'Grade my explanation'
      )}
    </Button>
  ) : (
    <Button onClick={next} className="w-full">
      {pos + 1 >= queue.length ? 'Finish' : 'Next term'}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );

  if (onBack) {
    return (
      <StudyScreenShell
        onBack={onBack}
        current={pos + 1}
        total={queue.length}
        action={explainAction}
      >
        {explainBody}
      </StudyScreenShell>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-gutter pt-8">
      <div className="mx-auto flex w-full max-w-study flex-1 flex-col gap-6 pb-6">
        <p className="text-meta text-muted-foreground">
          Explain it · {pos + 1}/{queue.length}
        </p>
        {explainBody}
        {explainAction}
      </div>
    </div>
  );
}
