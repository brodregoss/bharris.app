// Shared types for the concept-graph engine.
// One SubjectConfig per row in the "Subject Gearing" spreadsheet.

export type SubjectId =
  | "psych"
  | "history"
  | "science"
  | "english"
  | "language"
  | "other";

export type SamplingBias = "hub-first" | "even";

export interface SubjectConfig {
  id: SubjectId;
  name: string;
  usesConceptGraph: boolean; // false only for "other" — routes to the math/problem engine instead
  graphWeight: number;       // 0-1, how much diagnosis/scheduling trusts the graph vs. treating items independently
  propagationStrength: number; // 0-1, how far a miss spreads doubt to connected nodes
  samplingBias: SamplingBias;
  reviewMixWeak: number;   // e.g. 0.55 for a 55:45 weak:known split
  clusterSensitivity: number; // 0-1, how readily correlated misses get reported as one "gap"
}

// The concept graph itself
export interface ConceptNode {
  id: string;
  label: string;
  subject: SubjectId;
}

export interface ConceptEdge {
  from: string; // prerequisite
  to: string;   // depends on `from`
}

// Per-node mastery state, updated after every answer
export interface MasteryState {
  nodeId: string;
  confidence: number; // 0-1, probability the user actually knows this concept
  lastSeen: number;   // epoch ms
  timesCorrect: number;
  timesWrong: number;
}

export interface AnswerResult {
  nodeId: string;
  correct: boolean;
  timestamp: number;
}
