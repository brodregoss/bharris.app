import { SubjectConfig } from "./types";
import raw from "../data/subjectGearing.json";

// Metro (Expo's bundler) supports importing JSON directly, so this file
// is now just a typed wrapper — edit subjectGearing.json (exported from
// the spreadsheet) and the app picks it up with no code change.
export const SUBJECT_CONFIGS: Record<string, SubjectConfig> = raw as Record<
  string,
  SubjectConfig
>;

// Language is the one subject with two graph weights blended into one config.
export function getLanguageWeight(nodeTag: "grammar" | "vocab"): number {
  const weights = (raw as any).language?.languageWeights;
  return nodeTag === "grammar" ? weights?.grammar ?? 0.7 : weights?.vocab ?? 0.15;
}
