import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Eye, Check, X, ArrowRight } from 'lucide-react-native';
import { Button } from '@/src/components/ui/Button';
import { fmtTime, normalizeExamType } from '@/src/core/studyUtils';
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

function pickRecallDistractors(allTerms: StudyTerm[], correct: StudyTerm, n: number) {
  const depSet = new Set(correct.depends_on || []);
  const candidates = allTerms.filter((t) => t.id !== correct.id);
  const cluster = candidates.filter((t) => (t.depends_on || []).some((d) => depSet.has(d)));
  const sameTier = candidates.filter((t) => t.tier === correct.tier);
  const pool = [...cluster, ...sameTier, ...candidates];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of pool) {
    if (seen.has(t.definition)) continue;
    seen.add(t.definition);
    out.push(t.definition);
    if (out.length >= n) break;
  }
  return out;
}

function cardStyle(examType: string, i: number) {
  const t = normalizeExamType(examType);
  if (t === 'mcq') return i % 4 === 3 ? 'recognition' : 'free_recall';
  if (t === 'short_answer') return i % 5 === 4 ? 'explain' : 'free_recall';
  return i % 2 === 1 ? 'recognition' : 'free_recall';
}

type Props = {
  terms: StudyTerm[];
  retireThreshold: number;
  blockBudgetMs: number;
  singlePass?: boolean;
  blockLabel: string;
  examType?: string;
  onUpdateTerm: (id: string, patch: Partial<StudyTerm>) => void;
  onLogAttempt: (id: string, result: 'got_it' | 'missed') => void;
  onDone: (stats: { got: number; total: number; reason?: string }) => void;
};

export function RecallBlock({
  terms,
  retireThreshold,
  blockBudgetMs,
  singlePass = false,
  blockLabel,
  examType = 'mixed',
  onUpdateTerm,
  onLogAttempt,
  onDone,
}: Props) {
  const byId = useMemo(() => Object.fromEntries(terms.map((t) => [t.id, t])), [terms]);
  const [st, setSt] = useState({ queue: terms.map((t) => t.id), pos: 0, round: 1 });
  const [revealed, setRevealed] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(blockBudgetMs);
  const [gotCount, setGotCount] = useState(0);
  const [recogSelected, setRecogSelected] = useState<string | null>(null);
  const [recogOptions, setRecogOptions] = useState<string[] | null>(null);
  const gotRef = useRef(0);
  const doneRef = useRef(false);

  const finish = useCallback(
    (reason?: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone({ got: gotRef.current, total: terms.length, reason });
    },
    [onDone, terms.length],
  );

  useEffect(() => {
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

  useEffect(() => {
    if (!singlePass && st.queue.length === 0) finish('retired');
  }, [st.queue.length, singlePass, finish]);

  useEffect(() => {
    if (singlePass && st.pos >= st.queue.length) finish('pass');
  }, [st.pos, st.queue.length, singlePass, finish]);

  const currentId = st.queue[st.pos];
  const current = currentId != null ? byId[currentId] : null;
  const style = cardStyle(examType, st.pos);

  useEffect(() => {
    setRevealed(false);
    setRecogSelected(null);
    if (current && style === 'recognition') {
      setRecogOptions(shuffle([current.definition, ...pickRecallDistractors(terms, current, 3)]));
    } else {
      setRecogOptions(null);
    }
  }, [currentId, current, style, terms]);

  if (!current) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Wrapping up…</Text>
      </View>
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
    <View style={styles.wrap}>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{blockLabel}</Text>
        <Text style={styles.metaText}>
          {fmtTime(timeLeftMs)} left · round {st.round}
        </Text>
      </View>
      <View style={styles.centerArea}>
        <View style={styles.card}>
          <Text style={styles.prompt}>{promptLabel.toUpperCase()}</Text>
          <Text style={styles.term}>{current.term}</Text>
          {style === 'recognition' ? (
            <View style={styles.options}>
              {(recogOptions || []).map((opt, i) => {
                const selected = recogSelected === opt;
                const isCorrect = opt === current.definition;
                return (
                  <Pressable
                    key={i}
                    disabled={!!recogSelected}
                    onPress={() => setRecogSelected(opt)}
                    style={[
                      styles.option,
                      recogSelected &&
                        (isCorrect
                          ? styles.optionCorrect
                          : selected
                            ? styles.optionWrong
                            : null),
                    ]}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : revealed ? (
            <Text style={styles.definition}>{current.definition}</Text>
          ) : (
            <Text style={styles.hint}>
              {style === 'explain'
                ? 'Reveal the definition to self-grade your explanation.'
                : 'Reveal the definition, then grade yourself.'}
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          {style === 'recognition' ? (
            recogSelected ? (
              <Button
                label="Continue"
                onPress={() => (recogSelected === current.definition ? handleGot() : handleMissed())}
                icon={<ArrowRight size={16} color="#fff" />}
                iconPosition="right"
              />
            ) : (
              <Button label="Pick an answer" disabled variant="muted" />
            )
          ) : !revealed ? (
            <Button label="Show answer" onPress={() => setRevealed(true)} icon={<Eye size={16} color="#fff" />} />
          ) : (
            <View style={styles.row}>
              <Button
                label="Missed"
                variant="outlineMiss"
                onPress={handleMissed}
                icon={<X size={16} color={colors.rose600} />}
                style={{ flex: 1 }}
              />
              <Button
                label="Got it"
                variant="gotIt"
                onPress={handleGot}
                icon={<Check size={16} color="#fff" />}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
        <Text style={styles.footerMeta}>
          {singlePass
            ? `${Math.min(st.pos + 1, st.queue.length)}/${st.queue.length} seen`
            : `${gotCount} retired · ${st.queue.length} in rotation`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 14, color: colors.muted },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metaText: { fontSize: 12, color: colors.muted },
  centerArea: { flex: 1, justifyContent: 'center' },
  card: {
    borderRadius: radii.flashcard,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 32,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  prompt: { fontSize: 11, letterSpacing: 1, color: colors.muted, marginBottom: 12 },
  term: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  definition: { marginTop: 20, fontSize: 14, color: colors.muted, lineHeight: 22, textAlign: 'center' },
  hint: { marginTop: 20, fontSize: 12, color: colors.muted, textAlign: 'center' },
  options: { marginTop: 20, width: '100%', gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 12,
    backgroundColor: colors.card,
  },
  optionCorrect: { borderColor: colors.emerald400, backgroundColor: colors.emerald50 },
  optionWrong: { borderColor: colors.rose400, backgroundColor: colors.rose50 },
  optionText: { fontSize: 14 },
  actions: { marginTop: 16 },
  row: { flexDirection: 'row', gap: 12 },
  footerMeta: { marginTop: 16, fontSize: 12, color: colors.muted, textAlign: 'center' },
});
