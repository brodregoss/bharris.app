/**
 * TODO: Replace hardcoded sample decks with real content ingestion
 * (PDF/notes → ConceptNode/ConceptEdge extraction pipeline).
 */
import { ConceptGraph } from "../engine/conceptGraph";
import { MasteryState, SubjectId } from "../engine/types";
import { WorkedExample } from "../engine/mathEngine";

export interface FlashcardFace {
  prompt: string;
  answer: string;
}

const CARDS: Record<string, FlashcardFace> = {
  // History — WWI chain (from router.ts example)
  "alliance-system": {
    prompt: "European alliance system",
    answer: "A network of mutual-defense treaties (Triple Entente vs. Central Powers) that turned a regional crisis into a world war.",
  },
  "franz-ferdinand": {
    prompt: "Assassination of Franz Ferdinand",
    answer: "June 1914 killing in Sarajevo that triggered the July Crisis among the great powers.",
  },
  "wwi-outbreak": {
    prompt: "Outbreak of WWI",
    answer: "Escalation through alliance obligations, mobilization timetables, and failed diplomacy in July–August 1914.",
  },
  "treaty-versailles": {
    prompt: "Treaty of Versailles",
    answer: "1919 peace treaty imposing reparations, territorial losses, and the War Guilt clause on Germany.",
  },
  // Psych — conditioning sample
  "classical-conditioning": {
    prompt: "Classical conditioning",
    answer: "Learning by association (Pavlov): neutral stimulus paired with UCS until it alone elicits the response.",
  },
  "operant-conditioning": {
    prompt: "Operant conditioning",
    answer: "Learning through consequences (Skinner): behavior shaped by reinforcement and punishment.",
  },
  "memory-encoding": {
    prompt: "Memory encoding",
    answer: "Transforming sensory input into storable memory traces; depth of processing improves retention.",
  },
  // Science — cell bio mini-chain
  "mitochondria": {
    prompt: "Mitochondria",
    answer: "Organelle that produces ATP via cellular respiration; has its own DNA.",
  },
  "atp": {
    prompt: "ATP",
    answer: "Adenosine triphosphate — the cell's primary energy currency.",
  },
  "cellular-respiration": {
    prompt: "Cellular respiration",
    answer: "Glucose + O₂ → CO₂ + H₂O + ATP; occurs mainly in mitochondria.",
  },
  // English — mostly independent terms
  "metaphor": {
    prompt: "Metaphor",
    answer: "Figure of speech describing one thing as another without like/as.",
  },
  "simile": {
    prompt: "Simile",
    answer: "Comparison using like or as.",
  },
  "theme": {
    prompt: "Theme",
    answer: "Central idea or message explored across a work.",
  },
  // Language — grammar hub
  "subjunctive": {
    prompt: "Subjunctive mood (Spanish)",
    answer: "Verb form for doubt, emotion, hypotheticals — e.g. espero que venga.",
  },
  "preterite": {
    prompt: "Preterite tense",
    answer: "Past tense for completed actions — e.g. hablé, comió.",
  },
  "imperfect": {
    prompt: "Imperfect tense",
    answer: "Past tense for ongoing/habitual actions — e.g. hablaba, comía.",
  },
};

export function getFlashcard(nodeId: string, fallbackLabel?: string): FlashcardFace {
  return (
    CARDS[nodeId] ?? {
      prompt: fallbackLabel ?? nodeId,
      answer: `(Sample) Definition for ${fallbackLabel ?? nodeId}`,
    }
  );
}

export function buildGraphForSubject(subjectId: SubjectId): ConceptGraph {
  const graph = new ConceptGraph();

  switch (subjectId) {
    case "history":
      graph.addNode({ id: "alliance-system", label: "European alliance system", subject: "history" });
      graph.addNode({ id: "franz-ferdinand", label: "Assassination of Franz Ferdinand", subject: "history" });
      graph.addNode({ id: "wwi-outbreak", label: "Outbreak of WWI", subject: "history" });
      graph.addNode({ id: "treaty-versailles", label: "Treaty of Versailles", subject: "history" });
      graph.addEdge({ from: "alliance-system", to: "wwi-outbreak" });
      graph.addEdge({ from: "franz-ferdinand", to: "wwi-outbreak" });
      graph.addEdge({ from: "wwi-outbreak", to: "treaty-versailles" });
      break;
    case "psych":
      graph.addNode({ id: "classical-conditioning", label: "Classical conditioning", subject: "psych" });
      graph.addNode({ id: "operant-conditioning", label: "Operant conditioning", subject: "psych" });
      graph.addNode({ id: "memory-encoding", label: "Memory encoding", subject: "psych" });
      graph.addEdge({ from: "classical-conditioning", to: "operant-conditioning" });
      graph.addEdge({ from: "memory-encoding", to: "classical-conditioning" });
      break;
    case "science":
      graph.addNode({ id: "mitochondria", label: "Mitochondria", subject: "science" });
      graph.addNode({ id: "atp", label: "ATP", subject: "science" });
      graph.addNode({ id: "cellular-respiration", label: "Cellular respiration", subject: "science" });
      graph.addEdge({ from: "mitochondria", to: "atp" });
      graph.addEdge({ from: "mitochondria", to: "cellular-respiration" });
      graph.addEdge({ from: "atp", to: "cellular-respiration" });
      break;
    case "english":
      graph.addNode({ id: "metaphor", label: "Metaphor", subject: "english" });
      graph.addNode({ id: "simile", label: "Simile", subject: "english" });
      graph.addNode({ id: "theme", label: "Theme", subject: "english" });
      break;
    case "language":
      graph.addNode({ id: "subjunctive", label: "Subjunctive mood", subject: "language" });
      graph.addNode({ id: "preterite", label: "Preterite tense", subject: "language" });
      graph.addNode({ id: "imperfect", label: "Imperfect tense", subject: "language" });
      graph.addEdge({ from: "preterite", to: "imperfect" });
      graph.addEdge({ from: "subjunctive", to: "preterite" });
      break;
    case "other":
      break;
  }

  return graph;
}

export function initMasteryFromGraph(graph: ConceptGraph): Map<string, MasteryState> {
  const mastery = new Map<string, MasteryState>();
  const now = Date.now();
  for (const id of graph.nodes.keys()) {
    mastery.set(id, {
      nodeId: id,
      confidence: 0.5,
      lastSeen: now,
      timesCorrect: 0,
      timesWrong: 0,
    });
  }
  return mastery;
}

export function mergeMasteryWithGraph(
  graph: ConceptGraph,
  existing: Map<string, MasteryState>,
): Map<string, MasteryState> {
  const merged = new Map(existing);
  const now = Date.now();
  for (const id of graph.nodes.keys()) {
    if (!merged.has(id)) {
      merged.set(id, {
        nodeId: id,
        confidence: 0.5,
        lastSeen: now,
        timesCorrect: 0,
        timesWrong: 0,
      });
    }
  }
  return merged;
}

export const SAMPLE_MATH_EXAMPLE: WorkedExample = {
  id: "quad-1",
  problemType: "quadratic-factoring",
  steps: [
    "Write x² + 5x + 6",
    "Find two numbers that multiply to 6 and add to 5 → 2 and 3",
    "Factor: (x + 2)(x + 3) = 0",
    "Solutions: x = -2 or x = -3",
  ],
  finalAnswer: "x = -2, x = -3",
};

export const SUBJECT_IDS: SubjectId[] = [
  "psych",
  "history",
  "science",
  "english",
  "language",
  "other",
];
