import { ConceptGraph } from "./conceptGraph";
import { SubjectConfig } from "./types";

// Returns node IDs in the order the diagnostic quiz should ask them.
// "hub-first" (History, Science, Psych, Language-grammar) tests
// high-centrality concepts early since a miss there tells you the most.
// "even" (English, Other, Language-vocab) just samples uniformly.
export function buildDiagnosticOrder(
  graph: ConceptGraph,
  config: SubjectConfig,
  poolSize: number
): string[] {
  const allIds = [...graph.nodes.keys()];

  if (config.samplingBias === "even") {
    return shuffle(allIds).slice(0, poolSize);
  }

  // hub-first: sort by centrality, but don't make it fully deterministic —
  // mix in some randomness so two diagnostics don't look identical.
  const ranked = allIds
    .map((id) => ({ id, score: graph.centrality(id) + Math.random() * 0.5 }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, poolSize).map((r) => r.id);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
