import { SUBJECT_CONFIGS } from "./subjectConfigs";
import { ConceptGraph } from "./conceptGraph";
import { buildDiagnosticOrder } from "./diagnostic";
import { clusterGaps } from "./clustering";
import { buildReviewQueue, updateMastery } from "./reviewScheduler";
import { MathEngine } from "./mathEngine";
import { MasteryState, SubjectId } from "./types";

// This is the one function that decides which engine a study session uses.
// Everything upstream (UI, session state) just calls runSession() and
// doesn't need to know the graph pipeline and the math pipeline exist.
export function runSession(subjectId: SubjectId, graph: ConceptGraph, mastery: Map<string, MasteryState>, mathEngine?: MathEngine) {
  const config = SUBJECT_CONFIGS[subjectId];

  if (!config.usesConceptGraph) {
    // "Other" branches off entirely — no diagnostic order, no clusters.
    if (!mathEngine) throw new Error("Other requires a MathEngine instance");
    return {
      mode: "problem-practice" as const,
      nextProblemTypes: mathEngine.nextProblemTypes(10, config.reviewMixWeak),
    };
  }

  // Everyone else (Psych, History, Science, English, Language) runs the
  // same graph pipeline — the SubjectConfig numbers are what make History
  // feel different from English, not different code paths.
  const diagnosticOrder = buildDiagnosticOrder(graph, config, 15);
  const gaps = clusterGaps(graph, mastery, config);
  const reviewQueue = buildReviewQueue(mastery, config, 20);

  return {
    mode: "concept-graph" as const,
    diagnosticOrder,
    gaps,
    reviewQueue,
  };
}

// --- Worked example: History, end to end -----------------------------

function example() {
  const graph = new ConceptGraph();
  graph.addNode({ id: "alliance-system", label: "European alliance system", subject: "history" });
  graph.addNode({ id: "franz-ferdinand", label: "Assassination of Franz Ferdinand", subject: "history" });
  graph.addNode({ id: "wwi-outbreak", label: "Outbreak of WWI", subject: "history" });
  graph.addNode({ id: "treaty-versailles", label: "Treaty of Versailles", subject: "history" });

  graph.addEdge({ from: "alliance-system", to: "wwi-outbreak" });
  graph.addEdge({ from: "franz-ferdinand", to: "wwi-outbreak" });
  graph.addEdge({ from: "wwi-outbreak", to: "treaty-versailles" });

  const mastery = new Map<string, MasteryState>();
  for (const id of graph.nodes.keys()) {
    mastery.set(id, { nodeId: id, confidence: 0.8, lastSeen: Date.now(), timesCorrect: 3, timesWrong: 0 });
  }

  // User misses "alliance system" on the diagnostic
  const config = SUBJECT_CONFIGS.history;
  const missed = mastery.get("alliance-system")!;
  mastery.set("alliance-system", updateMastery(missed, false));
  graph.propagateMiss("alliance-system", mastery, config);
  // -> "wwi-outbreak" and "treaty-versailles" now show reduced confidence
  //    even though the user was never asked about them directly.

  const session = runSession("history", graph, mastery);
  console.log(session);
}
