import { SUBJECT_CONFIGS } from "../engine/subjectConfigs";
import { SubjectConfig, SubjectId } from "../engine/types";
import { loadGearingOverrides, GearingOverrides } from "../storage/masteryStorage";

export async function getSubjectConfig(subjectId: SubjectId): Promise<SubjectConfig> {
  const base = SUBJECT_CONFIGS[subjectId];
  const overrides = await loadGearingOverrides();
  const patch = overrides[subjectId];
  if (!patch) return { ...base, id: subjectId };
  return { ...base, ...patch, id: subjectId };
}

export function applyGearingOverrides(
  base: Record<string, SubjectConfig>,
  overrides: GearingOverrides,
): Record<string, SubjectConfig> {
  const merged = { ...base };
  for (const id of Object.keys(overrides) as SubjectId[]) {
    if (merged[id] && overrides[id]) {
      merged[id] = { ...merged[id], ...overrides[id], id };
    }
  }
  return merged;
}
