import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenProps } from "../navigation/types";
import { SAMPLE_MATH_EXAMPLE } from "../data/sampleDecks";
import { MathEngine, WorkedExample } from "../engine/mathEngine";
import { loadMathState, saveMathState } from "../storage/masteryStorage";
import { getSubjectConfig } from "../lib/configHelpers";
import { runSession } from "../engine/router";
import { ConceptGraph } from "../engine/conceptGraph";
import { theme } from "../theme";

type Phase = "example" | "practice" | "result";

export function ProblemPracticeScreen({ navigation, route }: ScreenProps<"ProblemPractice">) {
  const { subjectId } = route.params;
  const [engine, setEngine] = useState<MathEngine | null>(null);
  const [example] = useState<WorkedExample>(SAMPLE_MATH_EXAMPLE);
  const [phase, setPhase] = useState<Phase>("example");
  const [practicePrompt, setPracticePrompt] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const persisted = await loadMathState();
      const eng = new MathEngine();
      if (persisted) {
        eng.attempts = persisted.attempts;
        eng.mistakeLog = new Map(Object.entries(persisted.mistakeLog));
      }
      setEngine(eng);
      setLoading(false);
    })();
  }, []);

  const persistEngine = useCallback(async (eng: MathEngine) => {
    await saveMathState({
      attempts: eng.attempts,
      mistakeLog: Object.fromEntries(eng.mistakeLog),
    });
  }, []);

  const startPractice = useCallback(() => {
    if (!engine) return;
    const problem = engine.generateSimilarProblem(example);
    setPracticePrompt(problem.prompt);
    setPhase("practice");
  }, [engine, example]);

  const record = useCallback(
    async (correct: boolean) => {
      if (!engine) return;
      engine.recordAttempt({
        problemType: example.problemType,
        correct,
        timestamp: Date.now(),
      });
      await persistEngine(engine);
      setPhase("result");
    },
    [engine, example.problemType, persistEngine],
  );

  const nextRound = useCallback(async () => {
    if (!engine) return;
    const config = await getSubjectConfig(subjectId);
    const emptyGraph = new ConceptGraph();
    const session = runSession(subjectId, emptyGraph, new Map(), engine);
    if (session.mode === "problem-practice") {
      console.log("Next problem types:", session.nextProblemTypes);
    }
    startPractice();
  }, [engine, subjectId, startPractice]);

  if (loading || !engine) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const mistakes = [...engine.mistakeLog.values()].sort((a, b) => b.count - a.count);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Math practice</Text>
        <Text style={styles.sub}>Worked example → similar problem → mistake log</Text>

        {phase === "example" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>WORKED EXAMPLE · {example.problemType}</Text>
            {example.steps.map((step, i) => (
              <Text key={i} style={styles.step}>
                {i + 1}. {step}
              </Text>
            ))}
            <Text style={styles.finalAnswer}>Answer: {example.finalAnswer}</Text>
            <Pressable style={styles.primaryBtn} onPress={startPractice}>
              <Text style={styles.primaryBtnText}>Try a similar problem</Text>
            </Pressable>
          </View>
        )}

        {phase === "practice" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PRACTICE</Text>
            <Text style={styles.prompt}>{practicePrompt}</Text>
            <View style={styles.row}>
              <Pressable style={[styles.actionBtn, styles.wrongBtn]} onPress={() => record(false)}>
                <Text style={styles.actionText}>Wrong</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.rightBtn]} onPress={() => record(true)}>
                <Text style={styles.actionText}>Right</Text>
              </Pressable>
            </View>
          </View>
        )}

        {phase === "result" && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>RECORDED</Text>
            <Text style={styles.prompt}>Attempt saved. Keep practicing weak types.</Text>
            <Pressable style={styles.primaryBtn} onPress={nextRound}>
              <Text style={styles.primaryBtnText}>Next problem</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.mistakeSection}>
          <Text style={styles.sectionTitle}>Mistake log</Text>
          {mistakes.length === 0 ? (
            <Text style={styles.emptyLog}>No mistakes yet — keep going.</Text>
          ) : (
            mistakes.map((m) => (
              <View key={m.problemType} style={styles.mistakeRow}>
                <Text style={styles.mistakeType}>{m.problemType}</Text>
                <Text style={styles.mistakeCount}>{m.count}× missed</Text>
              </View>
            ))
          )}
        </View>

        <Pressable style={styles.ghostBtn} onPress={() => navigation.popToTop()}>
          <Text style={styles.ghostText}>All subjects</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  title: { ...theme.typography.title, color: theme.colors.text },
  sub: { ...theme.typography.caption, color: theme.colors.textMuted, marginBottom: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
  },
  cardLabel: { ...theme.typography.label, color: theme.colors.textDim, marginBottom: theme.spacing.md },
  step: { ...theme.typography.body, color: theme.colors.text, marginBottom: 8, lineHeight: 22 },
  finalAnswer: { ...theme.typography.heading, color: theme.colors.success, marginTop: theme.spacing.sm, marginBottom: theme.spacing.lg },
  prompt: { ...theme.typography.body, color: theme.colors.text, lineHeight: 24, marginBottom: theme.spacing.lg },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.lg,
    alignItems: "center",
  },
  primaryBtnText: { ...theme.typography.heading, color: theme.colors.text },
  row: { flexDirection: "row", gap: theme.spacing.md },
  actionBtn: { flex: 1, paddingVertical: 16, borderRadius: theme.radii.lg, alignItems: "center" },
  wrongBtn: { backgroundColor: theme.colors.dangerBg, borderWidth: 1, borderColor: theme.colors.danger },
  rightBtn: { backgroundColor: theme.colors.successBg, borderWidth: 1, borderColor: theme.colors.success },
  actionText: { ...theme.typography.heading, color: theme.colors.text },
  mistakeSection: { marginTop: theme.spacing.sm },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text, marginBottom: theme.spacing.sm },
  emptyLog: { ...theme.typography.caption, color: theme.colors.textMuted },
  mistakeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  mistakeType: { ...theme.typography.body, color: theme.colors.text },
  mistakeCount: { ...theme.typography.caption, color: theme.colors.warning },
  ghostBtn: { marginTop: theme.spacing.lg, paddingVertical: 12 },
  ghostText: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: "center" },
});
