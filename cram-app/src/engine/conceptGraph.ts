import { ConceptNode, ConceptEdge, MasteryState, SubjectConfig } from "./types";

export class ConceptGraph {
  nodes = new Map<string, ConceptNode>();
  // adjacency in both directions — propagation and "hub" detection both need it
  outEdges = new Map<string, string[]>(); // prerequisite -> things that depend on it
  inEdges = new Map<string, string[]>();  // dependent -> its prerequisites

  addNode(node: ConceptNode) {
    this.nodes.set(node.id, node);
    if (!this.outEdges.has(node.id)) this.outEdges.set(node.id, []);
    if (!this.inEdges.has(node.id)) this.inEdges.set(node.id, []);
  }

  addEdge(edge: ConceptEdge) {
    this.outEdges.get(edge.from)?.push(edge.to);
    this.inEdges.get(edge.to)?.push(edge.from);
  }

  // Degree centrality — used by the "hub-first" diagnostic sampler.
  // A node many other nodes depend on (e.g. "causes of WWI") is a hub.
  centrality(nodeId: string): number {
    return (this.outEdges.get(nodeId)?.length ?? 0);
  }

  // When a node is missed, downgrade connected nodes even though they
  // weren't tested directly. Strength comes from the subject config —
  // History propagates hard, English barely propagates at all.
  propagateMiss(
    missedNodeId: string,
    mastery: Map<string, MasteryState>,
    config: SubjectConfig,
    depth = 2
  ) {
    if (!config.usesConceptGraph || config.propagationStrength <= 0) return;

    const visited = new Set<string>([missedNodeId]);
    let frontier = [missedNodeId];
    let currentStrength = config.propagationStrength;

    for (let d = 0; d < depth && frontier.length > 0; d++) {
      const next: string[] = [];
      for (const nodeId of frontier) {
        const neighbors = [
          ...(this.outEdges.get(nodeId) ?? []),
          ...(this.inEdges.get(nodeId) ?? []),
        ];
        for (const n of neighbors) {
          if (visited.has(n)) continue;
          visited.add(n);
          next.push(n);

          const state = mastery.get(n);
          if (state) {
            // Decay the hit each hop out, scaled by how strongly this
            // subject propagates doubt in the first place.
            state.confidence = Math.max(
              0,
              state.confidence - currentStrength * (1 - d * 0.35)
            );
          }
        }
      }
      frontier = next;
      currentStrength *= 0.6; // weaker with each additional hop
    }
  }
}
