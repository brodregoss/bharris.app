import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenProps } from "../navigation/types";
import { SUBJECT_CONFIGS } from "../engine/subjectConfigs";
import { SubjectId } from "../engine/types";
import {
  loadGearingOverrides,
  saveGearingOverrides,
  GearingOverrides,
} from "../storage/masteryStorage";
import { SUBJECT_IDS } from "../data/sampleDecks";
import { theme } from "../theme";

type TunableKey = "graphWeight" | "propagationStrength" | "reviewMixWeak" | "clusterSensitivity";

const LABELS: Record<TunableKey, string> = {
  graphWeight: "Graph weight",
  propagationStrength: "Propagation strength",
  reviewMixWeak: "Review mix (weak)",
  clusterSensitivity: "Cluster sensitivity",
};

function GearingSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const step = 0.05;
  return (
    <View style={sliderStyles.row}>
      <Text style={sliderStyles.label}>{label}</Text>
      <View style={sliderStyles.controls}>
        <Pressable
          onPress={() => onChange(Math.max(0, Math.round((value - step) * 100) / 100))}
          style={sliderStyles.btn}
        >
          <Text style={sliderStyles.btnText}>−</Text>
        </Pressable>
        <Text style={sliderStyles.value}>{value.toFixed(2)}</Text>
        <Pressable
          onPress={() => onChange(Math.min(1, Math.round((value + step) * 100) / 100))}
          style={sliderStyles.btn}
        >
          <Text style={sliderStyles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  row: { marginBottom: theme.spacing.md },
  label: { ...theme.typography.caption, color: theme.colors.textMuted, marginBottom: 6 },
  controls: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  btn: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnText: { fontSize: 20, color: theme.colors.text },
  value: { ...theme.typography.heading, color: theme.colors.text, minWidth: 48, textAlign: "center" },
});

export function SettingsScreen({ navigation }: ScreenProps<"Settings">) {
  const [overrides, setOverrides] = useState<GearingOverrides>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadGearingOverrides().then(setOverrides);
  }, []);

  const getValue = (subjectId: SubjectId, key: TunableKey): number => {
    const o = overrides[subjectId]?.[key];
    if (o !== undefined) return o;
    return SUBJECT_CONFIGS[subjectId][key] as number;
  };

  const setValue = (subjectId: SubjectId, key: TunableKey, value: number) => {
    setOverrides((prev) => ({
      ...prev,
      [subjectId]: { ...prev[subjectId], [key]: value },
    }));
    setSaved(false);
  };

  const save = useCallback(async () => {
    await saveGearingOverrides(overrides);
    setSaved(true);
  }, [overrides]);

  const reset = useCallback(async () => {
    setOverrides({});
    await saveGearingOverrides({});
    setSaved(true);
  }, []);

  const tunableKeys: TunableKey[] = [
    "graphWeight",
    "propagationStrength",
    "reviewMixWeak",
    "clusterSensitivity",
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Gearing overrides</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Tweak per-subject weights for experimentation. Saved to device storage — bundled JSON is unchanged.
        </Text>
        {SUBJECT_IDS.filter((id) => SUBJECT_CONFIGS[id].usesConceptGraph).map((subjectId) => (
          <View key={subjectId} style={styles.subjectBlock}>
            <Text style={styles.subjectName}>{SUBJECT_CONFIGS[subjectId].name}</Text>
            {tunableKeys.map((key) => (
              <GearingSlider
                key={key}
                label={LABELS[key]}
                value={getValue(subjectId, key)}
                onChange={(v) => setValue(subjectId, key, v)}
              />
            ))}
          </View>
        ))}
        <Pressable style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Save overrides</Text>
        </Pressable>
        <Pressable style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetBtnText}>Reset to defaults</Text>
        </Pressable>
        {saved && <Text style={styles.savedNote}>Saved.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  back: { ...theme.typography.caption, color: theme.colors.primary, marginBottom: theme.spacing.sm },
  title: { ...theme.typography.title, color: theme.colors.text },
  content: { padding: theme.spacing.lg, paddingTop: 0, paddingBottom: theme.spacing.xl },
  hint: { ...theme.typography.caption, color: theme.colors.textMuted, marginBottom: theme.spacing.lg, lineHeight: 18 },
  subjectBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subjectName: { ...theme.typography.heading, color: theme.colors.text, marginBottom: theme.spacing.md },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.lg,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  saveBtnText: { ...theme.typography.heading, color: theme.colors.text },
  resetBtn: { paddingVertical: 14, alignItems: "center", marginTop: theme.spacing.sm },
  resetBtnText: { ...theme.typography.caption, color: theme.colors.textMuted },
  savedNote: { ...theme.typography.caption, color: theme.colors.success, textAlign: "center", marginTop: theme.spacing.sm },
});
