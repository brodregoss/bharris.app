import AsyncStorage from "@react-native-async-storage/async-storage";
import { MasteryState, SubjectConfig, SubjectId } from "../engine/types";
import { PracticeAttempt, MistakeLogEntry } from "../engine/mathEngine";

// The engine works with Map<string, MasteryState> because it's convenient
// to update in memory during a session. AsyncStorage only stores strings,
// so this is the one place that converts Map <-> plain object for persistence.
// Keep this file the only thing that touches AsyncStorage — the engine
// itself should never import from react-native or expo packages.

const keyFor = (subject: SubjectId) => `mastery:${subject}`;

export async function loadMastery(subject: SubjectId): Promise<Map<string, MasteryState>> {
  const json = await AsyncStorage.getItem(keyFor(subject));
  if (!json) return new Map();
  const obj: Record<string, MasteryState> = JSON.parse(json);
  return new Map(Object.entries(obj));
}

export async function saveMastery(subject: SubjectId, mastery: Map<string, MasteryState>): Promise<void> {
  const obj = Object.fromEntries(mastery);
  await AsyncStorage.setItem(keyFor(subject), JSON.stringify(obj));
}

// --- App-layer persistence (still AsyncStorage-only boundary) ---------

const GEARING_OVERRIDES_KEY = "gearing-overrides";
const MATH_STATE_KEY = "math-engine-state";

export type GearingOverrides = Partial<
  Record<SubjectId, Partial<Pick<SubjectConfig, "graphWeight" | "propagationStrength" | "reviewMixWeak" | "clusterSensitivity">>>
>;

export async function loadGearingOverrides(): Promise<GearingOverrides> {
  const json = await AsyncStorage.getItem(GEARING_OVERRIDES_KEY);
  return json ? JSON.parse(json) : {};
}

export async function saveGearingOverrides(overrides: GearingOverrides): Promise<void> {
  await AsyncStorage.setItem(GEARING_OVERRIDES_KEY, JSON.stringify(overrides));
}

export interface PersistedMathState {
  attempts: PracticeAttempt[];
  mistakeLog: Record<string, MistakeLogEntry>;
}

export async function loadMathState(): Promise<PersistedMathState | null> {
  const json = await AsyncStorage.getItem(MATH_STATE_KEY);
  return json ? JSON.parse(json) : null;
}

export async function saveMathState(state: PersistedMathState): Promise<void> {
  await AsyncStorage.setItem(MATH_STATE_KEY, JSON.stringify(state));
}

export async function hasMasteryData(subject: SubjectId): Promise<boolean> {
  const json = await AsyncStorage.getItem(keyFor(subject));
  return json !== null && json !== "{}";
}
