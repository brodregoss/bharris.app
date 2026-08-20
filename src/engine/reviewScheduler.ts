import { MasteryState, SubjectConfig } from "./types";

// Builds today's review queue: mostly weak/flagged items, but always a
// baseline of already-known items too, so recall stays fast under exam
// pressure (this is the "study what you know a bit too" instinct from
// the original conversation — it's not padding, it's the confidence pass).
export function buildReviewQueue(
  mastery: Map<string, MasteryState>,
  config: SubjectConfig,
  targetSize: number
): string[] {
  const all = [...mastery.values()];
  const weak = all.filter((m) => m.confidence < 0.6).sort((a, b) => a.confidence - b.confidence);
  const known = all.filter((m) => m.confidence >= 0.6);

  const weakCount = Math.round(targetSize * config.reviewMixWeak);
  const knownCount = targetSize - weakCount;

  const queue = [
    ...weak.slice(0, weakCount).map((m) => m.nodeId),
    ...pickSpaced(known, knownCount).map((m) => m.nodeId),
  ];

  return shuffleInPlace(queue);
}

// Known items aren't picked randomly — bias toward ones not seen recently,
// which is a simple stand-in for a Leitner/SM-2 style spacing interval.
function pickSpaced(known: MasteryState[], count: number): MasteryState[] {
  return [...known]
    .sort((a, b) => a.lastSeen - b.lastSeen)
    .slice(0, count);
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Simple Leitner-style box update after each answer — same for every
// subject, since the review-mix ratio (not the spacing math) is what
// actually differs per subject.
export function updateMastery(state: MasteryState, correct: boolean): MasteryState {
  const bump = correct ? 0.15 : -0.25;
  return {
    ...state,
    confidence: Math.min(1, Math.max(0, state.confidence + bump)),
    lastSeen: Date.now(),
    timesCorrect: state.timesCorrect + (correct ? 1 : 0),
    timesWrong: state.timesWrong + (correct ? 0 : 1),
  };
}
