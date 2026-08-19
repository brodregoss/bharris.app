import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenProps } from "../navigation/types";
import { buildGraphForSubject, getFlashcard, mergeMasteryWithGraph } from "../data/sampleDecks";
import { loadMastery, saveMastery } from "../storage/masteryStorage";
import { getSubjectConfig } from "../lib/configHelpers";
import { buildReviewQueue, updateMastery } from "../engine/reviewScheduler";
import { ConceptGraph } from "../engine/conceptGraph";
import { MasteryState, SubjectConfig } from "../engine/types";
import { FlashcardFlow } from "../components/FlashcardFlow";
import { theme } from "../theme";

export function ReviewScreen({ navigation, route }: ScreenProps<"Review">) {
  const { subjectId, focusNodeIds } = route.params;
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState<ConceptGraph | null>(null);
  const [mastery, setMastery] = useState<Map<string, MasteryState>>(new Map());
  const [config, setConfig] = useState<SubjectConfig | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const g = buildGraphForSubject(subjectId);
      const cfg = await getSubjectConfig(subjectId);
      let m = await loadMastery(subjectId);
      m = mergeMasteryWithGraph(g, m);

      let q: string[];
      if (focusNodeIds?.length) {
        q = focusNodeIds.filter((id) => g.nodes.has(id));
      } else {
        q = buildReviewQueue(m, cfg, Math.min(20, g.nodes.size));
      }

      setGraph(g);
      setMastery(m);
      setConfig(cfg);
      setQueue(q);
      setLoading(false);
    })();
  }, [subjectId, focusNodeIds]);

  const currentId = queue[index];
  const node = graph?.nodes.get(currentId ?? "");
  const card = useMemo(
    () => (currentId ? getFlashcard(currentId, node?.label) : null),
    [currentId, node?.label],
  );

  const onAnswer = useCallback(
    (correct: boolean) => {
      if (!graph || !config || !currentId) return;

      const next = new Map(mastery);
      const state = next.get(currentId);
      if (!state) return;
      next.set(currentId, updateMastery(state, correct));
      if (!correct) {
        graph.propagateMiss(currentId, next, config);
      }
      setMastery(next);

      if (index + 1 >= queue.length) {
        saveMastery(subjectId, next).then(() => setDone(true));
      } else {
        setIndex((i) => i + 1);
      }
    },
    [graph, config, currentId, mastery, index, queue.length, subjectId],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.doneTitle}>Review complete</Text>
        <Pressable style={styles.btn} onPress={() => navigation.replace("GapDashboard", { subjectId })}>
          <Text style={styles.btnText}>View gaps</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={() => navigation.popToTop()}>
          <Text style={styles.btnGhostText}>All subjects</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.empty}>Nothing to review.</Text>
        <Pressable style={styles.btn} onPress={() => navigation.popToTop()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {focusNodeIds?.length ? "Focused review" : "Review"}
        </Text>
        <Text style={styles.headerSub}>
          {config?.name} · {Math.round((config?.reviewMixWeak ?? 0.5) * 100)}% weak mix
        </Text>
      </View>
      <FlashcardFlow
        prompt={card.prompt}
        answer={card.answer}
        progress={`${index + 1} / ${queue.length}`}
        onAnswer={onAnswer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  headerTitle: { ...theme.typography.title, color: theme.colors.text },
  headerSub: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  doneTitle: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.lg },
  empty: { color: theme.colors.textMuted, marginBottom: theme.spacing.lg },
  btn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: theme.radii.lg,
    minWidth: 200,
  },
  btnText: { ...theme.typography.heading, color: theme.colors.text, textAlign: "center" },
  btnGhost: { paddingVertical: 12 },
  btnGhostText: { color: theme.colors.textMuted, textAlign: "center" },
});
