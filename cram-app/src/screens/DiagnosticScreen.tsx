import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenProps } from "../navigation/types";
import { buildGraphForSubject, getFlashcard, initMasteryFromGraph, mergeMasteryWithGraph } from "../data/sampleDecks";
import { loadMastery, saveMastery } from "../storage/masteryStorage";
import { getSubjectConfig } from "../lib/configHelpers";
import { runSession } from "../engine/router";
import { updateMastery } from "../engine/reviewScheduler";
import { ConceptGraph } from "../engine/conceptGraph";
import { MasteryState, SubjectConfig } from "../engine/types";
import { FlashcardFlow } from "../components/FlashcardFlow";
import { theme } from "../theme";

export function DiagnosticScreen({ navigation, route }: ScreenProps<"Diagnostic">) {
  const { subjectId } = route.params;
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState<ConceptGraph | null>(null);
  const [mastery, setMastery] = useState<Map<string, MasteryState>>(new Map());
  const [config, setConfig] = useState<SubjectConfig | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const g = buildGraphForSubject(subjectId);
      const cfg = await getSubjectConfig(subjectId);
      let m = await loadMastery(subjectId);
      m = m.size === 0 ? initMasteryFromGraph(g) : mergeMasteryWithGraph(g, m);
      const session = runSession(subjectId, g, m);
      if (session.mode !== "concept-graph") {
        navigation.replace("ProblemPractice", { subjectId });
        return;
      }
      setGraph(g);
      setMastery(m);
      setConfig(cfg);
      setQueue(session.diagnosticOrder);
      setLoading(false);
    })();
  }, [subjectId, navigation]);

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
        saveMastery(subjectId, next).then(() =>
          navigation.replace("GapDashboard", { subjectId }),
        );
      } else {
        setIndex((i) => i + 1);
      }
    },
    [graph, config, currentId, mastery, index, queue.length, subjectId, navigation],
  );

  if (loading || !card) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Building diagnostic…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Diagnostic</Text>
        <Text style={styles.headerSub}>{config?.name}</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  loadingText: { color: theme.colors.textMuted, marginTop: theme.spacing.md },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  headerTitle: { ...theme.typography.title, color: theme.colors.text },
  headerSub: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
});
