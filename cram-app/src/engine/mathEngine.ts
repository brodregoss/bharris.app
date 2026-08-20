// "Other" (math and anything else without term-based gearing) doesn't run
// through conceptGraph/diagnostic/clustering at all — the research was
// clear that memorizing math as isolated terms is the wrong model. This
// is a parallel, much simpler pipeline: worked example -> practice problem
// -> mistake log. See router.ts for where the split happens.

export interface WorkedExample {
  id: string;
  problemType: string; // e.g. "quadratic-factoring"
  steps: string[];
  finalAnswer: string;
}

export interface PracticeAttempt {
  problemType: string;
  correct: boolean;
  timestamp: number;
  userSteps?: string[]; // optional, for step-level mistake detection
}

export interface MistakeLogEntry {
  problemType: string;
  count: number;
  lastMissed: number;
}

export class MathEngine {
  attempts: PracticeAttempt[] = [];
  mistakeLog = new Map<string, MistakeLogEntry>();

  recordAttempt(attempt: PracticeAttempt) {
    this.attempts.push(attempt);
    if (!attempt.correct) {
      const existing = this.mistakeLog.get(attempt.problemType);
      this.mistakeLog.set(attempt.problemType, {
        problemType: attempt.problemType,
        count: (existing?.count ?? 0) + 1,
        lastMissed: attempt.timestamp,
      });
    }
  }

  // What to practice next: weakest problem types first, same "weak +
  // some known for confidence" idea as reviewScheduler, just keyed on
  // problem type instead of graph nodes.
  nextProblemTypes(targetSize: number, weakRatio = 0.7): string[] {
    const weak = [...this.mistakeLog.values()]
      .sort((a, b) => b.count - a.count)
      .map((m) => m.problemType);

    const allTypesSeen = new Set(this.attempts.map((a) => a.problemType));
    const known = [...allTypesSeen].filter((t) => !this.mistakeLog.has(t));

    const weakCount = Math.round(targetSize * weakRatio);
    return [
      ...weak.slice(0, weakCount),
      ...known.slice(0, targetSize - weakCount),
    ];
  }

  // In a real build this calls an LLM or a template bank keyed by
  // problemType to generate a fresh problem structurally similar to
  // the worked example, so the user practices the method, not the
  // exact numbers they already saw.
  generateSimilarProblem(example: WorkedExample): { prompt: string } {
    return { prompt: `New ${example.problemType} problem, same method as: ${example.finalAnswer}` };
  }
}
