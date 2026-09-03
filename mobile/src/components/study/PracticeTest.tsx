import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Timer, RotateCcw, ArrowRight } from 'lucide-react-native';
import { Button } from '@/src/components/ui/Button';
import { fmtTime } from '@/src/core/studyUtils';
import { gradeShortAnswer, explainShortAnswer } from '@/src/services/aiService';
import type { StudyTerm } from '@/src/core/types';
import { colors, radii, shadows } from '@/src/theme';

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function pickDistractors(terms: StudyTerm[], correct: StudyTerm, n: number) {
  const same = terms.filter((t) => t.id !== correct.id && t.tier === correct.tier);
  const other = terms.filter((t) => t.id !== correct.id && t.tier !== correct.tier);
  return [...same, ...other].slice(0, n).map((t) => t.definition);
}

type Question = {
  id: string;
  term: string;
  definition: string;
  tier: string;
  type: 'mcq' | 'short';
  options: string[] | null;
};

function buildQuestions(terms: StudyTerm[], examType: string, missedIds: string[]): Question[] {
  const N = Math.min(terms.length, 12);
  const missedSet = new Set(missedIds);
  const rank: Record<string, number> = { critical: 0, core: 1, passive: 2 };
  const ordered = [...terms].sort((a, b) => {
    const am = missedSet.has(a.id) ? 0 : 1;
    const bm = missedSet.has(b.id) ? 0 : 1;
    if (am !== bm) return am - bm;
    return rank[a.tier] - rank[b.tier];
  });
  return ordered.slice(0, N).map((t, i) => {
    const type =
      examType === 'mixed' ? (i % 2 === 0 ? 'mcq' : 'short') : examType === 'multiple_choice' ? 'mcq' : 'short';
    return {
      id: t.id,
      term: t.term,
      definition: t.definition,
      tier: t.tier,
      type,
      options: type === 'mcq' ? shuffle([t.definition, ...pickDistractors(terms, t, 3)]) : null,
    };
  });
}

type Props = {
  terms: StudyTerm[];
  examType: string;
  budgetMs: number;
  priorMissed: string[];
  onDone: (result: { missedIds: string[]; questionIds: string[] }) => void;
};

export function PracticeTest({ terms, examType, budgetMs, priorMissed, onDone }: Props) {
  const [questions, setQuestions] = useState(() => buildQuestions(terms, examType, priorMissed));
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selected?: string; correct?: boolean }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [shortAnswer, setShortAnswer] = useState('');
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [qTimeLeft, setQTimeLeft] = useState(budgetMs);
  const [phase, setPhase] = useState<'taking' | 'results'>('taking');
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('results');
  };

  useEffect(() => {
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
  const perQMs = (type: string) => (type === 'mcq' ? 30000 : 90000);
  const hasAnswered = !!answers[q?.id];

  const record = (qid: string, payload: { selected?: string; correct?: boolean }) =>
    setAnswers((a) => ({ ...a, [qid]: payload }));

  const next = () => {
    if (idx + 1 >= questions.length) {
      finish();
      return;
    }
    setIdx((i) => i + 1);
    setSubmitted(false);
    setShortAnswer('');
    setGradeResult(null);
    setGrading(false);
    setExplanation(null);
    setExplaining(false);
  };

  const gradeWithAI = async () => {
    if (!shortAnswer.trim() || !q) return;
    setSubmitted(true);
    setGrading(true);
    try {
      const res = await gradeShortAnswer(q.term, q.definition, shortAnswer);
      setGradeResult(res);
      record(q.id, { correct: res.correct });
    } catch {
      setGradeResult({ correct: false, feedback: 'Could not grade — try again or self-score.' });
      record(q.id, { correct: false });
    }
    setGrading(false);
  };

  const explain = async () => {
    if (!q) return;
    setExplaining(true);
    try {
      setExplanation(await explainShortAnswer(q.term, q.definition, shortAnswer));
    } catch {
      setExplanation('Could not generate an explanation right now.');
    }
    setExplaining(false);
  };

  useEffect(() => {
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

  const correctCount = Object.values(answers).filter((a) => a?.correct).length;

  if (phase === 'results') {
    const score = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    const byTier: Record<string, { correct: number; total: number }> = {};
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
        .filter(Boolean) as StudyTerm[];
      if (!sub.length) return;
      setQuestions(buildQuestions(sub, examType, []));
      setAnswers({});
      setIdx(0);
      setSubmitted(false);
      setShortAnswer('');
      setGradeResult(null);
      doneRef.current = false;
      setPhase('taking');
    };

    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.resultsContent}>
        <Text style={styles.title}>Practice test</Text>
        <Text style={styles.sub}>Here's how you did.</Text>
        <View style={styles.scoreCard}>
          <Text style={styles.score}>{score}%</Text>
          <Text style={styles.scoreSub}>
            {correctCount} of {questions.length} correct
          </Text>
        </View>
        {(['critical', 'core', 'passive'] as const)
          .filter((t) => byTier[t])
          .map((t) => (
            <View key={t} style={styles.tierRow}>
              <Text style={styles.tierLabel}>{t}</Text>
              <Text style={styles.tierScore}>
                {byTier[t].correct}/{byTier[t].total}
              </Text>
            </View>
          ))}
        <Button label="Retake weak areas" variant="secondary" onPress={retake} icon={<RotateCcw size={16} color={colors.foreground} />} style={{ marginBottom: 8 }} />
        <Button label="Continue" onPress={() => onDone({ missedIds, questionIds })} icon={<ArrowRight size={16} color="#fff" />} iconPosition="right" />
      </ScrollView>
    );
  }

  if (!q) return null;
  const answered = answers[q.id];

  return (
    <View style={styles.wrap}>
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          Practice test · {idx + 1}/{questions.length}
        </Text>
        <View style={styles.timerRow}>
          <Timer size={14} color={colors.muted} />
          <Text style={styles.metaText}>{fmtTime(qTimeLeft)}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.prompt}>
          {q.type === 'mcq' ? 'MULTIPLE CHOICE' : 'SHORT ANSWER'} · {q.tier.toUpperCase()}
        </Text>
        <Text style={styles.term}>{q.term}</Text>
        {q.type === 'mcq' ? (
          <View style={styles.options}>
            {(q.options || []).map((opt, i) => {
              const selected = answered?.selected === opt;
              const isCorrect = opt === q.definition;
              return (
                <Pressable
                  key={i}
                  disabled={!!answered}
                  onPress={() => record(q.id, { selected: opt, correct: isCorrect })}
                  style={[
                    styles.option,
                    answered &&
                      (isCorrect ? styles.optionCorrect : selected ? styles.optionWrong : null),
                  ]}
                >
                  <Text style={styles.optionText}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : !submitted ? (
          <TextInput
            value={shortAnswer}
            onChangeText={setShortAnswer}
            placeholder="Type your answer — we'll grade it with AI…"
            multiline
            style={styles.textarea}
          />
        ) : (
          <View style={{ marginTop: 16, gap: 8 }}>
            {gradeResult && (
              <View style={[styles.gradeBox, gradeResult.correct ? styles.gradeOk : styles.gradeBad]}>
                <Text style={styles.gradeTitle}>{gradeResult.correct ? 'Got it' : 'Missed'}</Text>
                {gradeResult.feedback ? <Text style={styles.gradeFeedback}>{gradeResult.feedback}</Text> : null}
              </View>
            )}
            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>CORRECT ANSWER</Text>
              <Text style={styles.answerText}>{q.definition}</Text>
            </View>
            {gradeResult && !explanation && (
              <Pressable onPress={explain} disabled={explaining}>
                <Text style={styles.explainLink}>{explaining ? 'Explaining…' : 'Explain'}</Text>
              </Pressable>
            )}
            {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {q.type === 'mcq' ? (
          <Button label="Next" disabled={!answered} onPress={next} icon={<ArrowRight size={16} color="#fff" />} iconPosition="right" />
        ) : !submitted ? (
          <Button label="Grade answer" disabled={!shortAnswer.trim()} onPress={gradeWithAI} />
        ) : grading ? (
          <View style={styles.grading}>
            <ActivityIndicator color={colors.muted} />
            <Text style={styles.metaText}> Grading…</Text>
          </View>
        ) : gradeResult ? (
          <Button label="Next" onPress={next} icon={<ArrowRight size={16} color="#fff" />} iconPosition="right" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metaText: { fontSize: 12, color: colors.muted },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: {
    borderRadius: radii.flashcard,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 24,
    minHeight: 260,
    ...shadows.card,
  },
  prompt: { fontSize: 11, letterSpacing: 1, color: colors.muted, marginBottom: 8 },
  term: { fontSize: 22, fontWeight: '700' },
  options: { marginTop: 16, gap: 8 },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 12 },
  optionCorrect: { borderColor: colors.emerald400, backgroundColor: colors.emerald50 },
  optionWrong: { borderColor: colors.rose400, backgroundColor: colors.rose50 },
  optionText: { fontSize: 14 },
  textarea: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  gradeBox: { borderRadius: radii.lg, padding: 12, borderWidth: 1 },
  gradeOk: { backgroundColor: colors.emerald50, borderColor: colors.emerald400 },
  gradeBad: { backgroundColor: colors.rose50, borderColor: colors.rose400 },
  gradeTitle: { fontWeight: '700' },
  gradeFeedback: { marginTop: 4, fontSize: 13, color: colors.muted },
  answerBox: { backgroundColor: colors.slate100, borderRadius: radii.lg, padding: 12 },
  answerLabel: { fontSize: 11, color: colors.muted, letterSpacing: 1 },
  answerText: { marginTop: 4, fontSize: 14 },
  explainLink: { fontSize: 12, color: colors.muted, textDecorationLine: 'underline' },
  explanation: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  actions: { marginTop: 16 },
  grading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16 },
  resultsContent: { paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 14, color: colors.muted, marginBottom: 20 },
  scoreCard: {
    borderRadius: radii.flashcard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    ...shadows.card,
  },
  score: { fontSize: 48, fontWeight: '700' },
  scoreSub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 8,
    backgroundColor: colors.card,
  },
  tierLabel: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  tierScore: { fontSize: 14, color: colors.muted },
});
