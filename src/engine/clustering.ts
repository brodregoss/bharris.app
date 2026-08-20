import { ConceptGraph } from "./conceptGraph";
import { MasteryState, SubjectConfig } from "./types";

export interface GapCluster {
  nodeIds: string[];
  avgConfidence: number;
  label: string; // pulled from the graph's most central node in the cluster
}

// Groups weak nodes that are graph-connected into a single reported gap,
// e.g. "shaky on causes of WWI" instead of five disconnected flashcards.
// Higher clusterSensitivity = groups more aggressively (fewer, bigger clusters).
export function clusterGaps(
  graph: ConceptGraph,
  mastery: Map<string, MasteryState>,
  config: SubjectConfig,
  weakThreshold = 0.5
): GapCluster[] {
  if (!config.usesConceptGraph || config.clusterSensitivity <= 0) {
    // No graph relationships to speak of (English, Other) — every weak
    // item is its own "cluster of one".
    return [...mastery.values()]
      .filter((m) => m.confidence < weakThreshold)
      .map((m) => ({
        nodeIds: [m.nodeId],
        avgConfidence: m.confidence,
        label: graph.nodes.get(m.nodeId)?.label ?? m.nodeId,
      }));
  }

  const weakIds = new Set(
    [...mastery.values()]
      .filter((m) => m.confidence < weakThreshold)
      .map((m) => m.nodeId)
  );

  const visited = new Set<string>();
  const clusters: GapCluster[] = [];

  for (const id of weakIds) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const stack = [id];

    while (stack.length) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);

      const neighbors = [
        ...(graph.outEdges.get(current) ?? []),
        ...(graph.inEdges.get(current) ?? []),
      ];
      for (const n of neighbors) {
        // clusterSensitivity gates how "loosely" connected nodes still
        // count as the same gap — at 0.8 (History) almost any link merges
        // them; at 0.15 (Psych-ish subjects) only direct hits do.
        const linkCounts = weakIds.has(n) || Math.random() < config.clusterSensitivity * 0.3;
        if (linkCounts && !visited.has(n)) stack.push(n);
      }
    }

    if (component.length > 0) {
      const confidences = component.map((n) => mastery.get(n)?.confidence ?? 0);
      const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const hub = component.sort(
        (a, b) => graph.centrality(b) - graph.centrality(a)
      )[0];
      clusters.push({
        nodeIds: component,
        avgConfidence: avg,
        label: graph.nodes.get(hub)?.label ?? hub,
      });
    }
  }

  return clusters;
}
