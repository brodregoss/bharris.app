import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { SUBJECT_CONFIGS } from "../engine/subjectConfigs";
import { SubjectId } from "../engine/types";
import { hasMasteryData } from "../storage/masteryStorage";
import { SUBJECT_IDS } from "../data/sampleDecks";
import { RootStackParamList } from "../navigation/types";
import { theme } from "../theme";

const DESCRIPTIONS: Record<SubjectId, string> = {
  psych: "Hub-first graph · moderate propagation",
  history: "Strong prerequisite chains · high propagation",
  science: "Concept dependencies · high clustering",
  english: "Mostly independent terms · low graph weight",
  language: "Grammar hubs + vocab mix",
  other: "Math: worked examples → practice problems",
};

export function SubjectPickerScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loadingId, setLoadingId] = useState<SubjectId | null>(null);

  const onSelect = useCallback(
    async (subjectId: SubjectId) => {
      setLoadingId(subjectId);
      const config = SUBJECT_CONFIGS[subjectId];

      if (!config.usesConceptGraph) {
        navigation.navigate("ProblemPractice", { subjectId });
        setLoadingId(null);
        return;
      }

      const hasData = await hasMasteryData(subjectId);
      if (hasData) {
        navigation.navigate("Review", { subjectId });
      } else {
        navigation.navigate("Diagnostic", { subjectId });
      }
      setLoadingId(null);
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Cram</Text>
        <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={12}>
          <Text style={styles.settingsLink}>Settings</Text>
        </Pressable>
      </View>
      <Text style={styles.subtitle}>Pick a subject — gearing adapts to how concepts connect.</Text>
      <ScrollView contentContainerStyle={styles.grid}>
        {SUBJECT_IDS.map((id) => {
          const config = SUBJECT_CONFIGS[id];
          const loading = loadingId === id;
          return (
            <Pressable
              key={id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => onSelect(id)}
              disabled={loadingId !== null}
            >
              <Text style={styles.cardTitle}>{config.name}</Text>
              <Text style={styles.cardDesc}>{DESCRIPTIONS[id]}</Text>
              {loading && <ActivityIndicator color={theme.colors.primary} style={styles.spinner} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: theme.colors.text, fontSize: 28 },
  settingsLink: { ...theme.typography.body, color: theme.colors.primary },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  grid: { padding: theme.spacing.md, gap: theme.spacing.md, paddingBottom: theme.spacing.xl },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardPressed: { opacity: 0.85, borderColor: theme.colors.primary },
  cardTitle: { ...theme.typography.heading, color: theme.colors.text, marginBottom: 4 },
  cardDesc: { ...theme.typography.caption, color: theme.colors.textMuted, lineHeight: 18 },
  spinner: { marginTop: theme.spacing.sm },
});
