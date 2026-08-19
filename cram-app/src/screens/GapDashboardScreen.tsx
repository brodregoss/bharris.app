import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenProps } from "../navigation/types";
import { buildGraphForSubject, getFlashcard, mergeMasteryWithGraph } from "../data/sampleDecks";
import { loadMastery, saveMastery } from "../storage/masteryStorage";
import { getSubjectConfig } from "../lib/configHelpers";
import { buildReviewQueue, updateMastery } from "../engine/reviewScheduler";
import { clusterGaps, GapCluster } from "../engine/clustering";
import { ConceptGraph } from "../engine/conceptGraph";
import { MasteryState, SubjectConfig } from "../engine/types";
import { theme } from "../theme";

export function GapDashboardScreen({ navigation, route }: ScreenProps<"GapDashboard">) {
  const { subjectId } = route.params;
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<GapCluster[]>([]);
  const [config, setConfig] = useState<SubjectConfig | null>(null);

  useEffect(() => {
    (async () => {
      const graph = buildGraphForSubject(subjectId);
      const cfg = await getSubjectConfig(subjectId);
      const mastery = await loadMastery(subjectId);
      const merged = mergeMasteryWithGraph(graph, mastery);
      const gaps = clusterGaps(graph, merged, cfg);
      gaps.sort((a, b) => a.avgConfidence - b.avgConfidence);
      setClusters(gaps);
      setConfig(cfg);
      setLoading(false);
    })();
  }, [subjectId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Knowledge gaps</Text>
        <Text style={styles.sub}>{config?.name} · weakest clusters first</Text>
      </View>

      {clusters.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No weak spots detected — nice work.</Text>
          <Pressable style={styles.btn} onPress={() => navigation.navigate("Review", { subjectId })}>
            <Text style={styles.btnText}>Start review anyway</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={clusters}
          keyExtractor={(item) => item.nodeIds.join("-")}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.clusterCard}
              onPress={() =>
                navigation.navigate("Review", { subjectId, focusNodeIds: item.nodeIds })
              }
            >
              <Text style={styles.clusterLabel}>{item.label}</Text>
              <Text style={styles.clusterMeta}>
                {item.nodeIds.length} concept{item.nodeIds.length > 1 ? "s" : ""} ·{" "}
                {Math.round(item.avgConfidence * 100)}% confidence
              </Text>
            </Pressable>
          )}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate("Review", { subjectId })}>
          <Text style={styles.btnSecondaryText}>Full review session</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={() => navigation.popToTop()}>
          <Text style={styles.btnGhostText}>All subjects</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  title: { ...theme.typography.title, color: theme.colors.text },
  sub: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 4 },
  list: { padding: theme.spacing.md, gap: theme.spacing.sm, paddingBottom: 120 },
  clusterCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  clusterLabel: { ...theme.typography.heading, color: theme.colors.text },
  clusterMeta: { ...theme.typography.caption, color: theme.colors.warning, marginTop: 6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl },
  emptyText: { ...theme.typography.body, color: theme.colors.textMuted, marginBottom: theme.spacing.lg },
  footer: { padding: theme.spacing.lg, gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  btn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.radii.lg,
  },
  btnText: { ...theme.typography.heading, color: theme.colors.text, textAlign: "center" },
  btnSecondary: {
    backgroundColor: theme.colors.surfaceElevated,
    paddingVertical: 14,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSecondaryText: { ...theme.typography.heading, color: theme.colors.text, textAlign: "center" },
  btnGhost: { paddingVertical: 10 },
  btnGhostText: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: "center" },
});
