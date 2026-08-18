import { getBase44Client, isBase44Configured } from './base44Client';
import { rankTerms, MAX_TERMS, type RawTerm } from '../core/triageUtils';

export function formatAiError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'AI request failed';
}

export async function generateTriageTerms(
  sourceTitle: string,
  termCount = 12,
): Promise<RawTerm[]> {
  if (!isBase44Configured()) {
    throw new Error('Base44 is not configured. Add credentials to mobile/.env');
  }

  const count = Math.min(termCount, MAX_TERMS);
  const base44 = getBase44Client();

  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `You are building a last-minute study triage for a student about to cram "${sourceTitle}". Generate exactly ${count} key terms/concepts a student must know for this exam. For each term provide: term (short name), definition (one concise sentence), difficulty (integer 1-10, 10 = hardest), depends_on (array of OTHER term names from your list that this concept builds upon; foundational concepts others rely on should have empty or few dependencies, advanced concepts should reference foundational ones). Include a healthy mix of foundational and advanced concepts. Return exactly ${count} terms.`,
    response_json_schema: {
      type: 'object',
      properties: {
        terms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              definition: { type: 'string' },
              difficulty: { type: 'number' },
              depends_on: { type: 'array', items: { type: 'string' } },
            },
            required: ['term', 'definition', 'difficulty', 'depends_on'],
          },
        },
      },
      required: ['terms'],
    },
  });

  const raw = ((res as { terms?: RawTerm[] }).terms ?? []).slice(0, count);
  const withIds = raw.map((t, i) => ({
    ...t,
    id: `t${i}`,
    depends_on: t.depends_on || [],
  }));
  return rankTerms(withIds);
}

export async function generatePanicNotes(termsJson: string): Promise<string> {
  if (!isBase44Configured()) {
    throw new Error('Base44 is not configured. Add credentials to mobile/.env');
  }

  const base44 = getBase44Client();
  const res = await base44.integrations.Core.InvokeLLM({
    prompt:
      `You are writing last-minute exam cram notes for a student who is out of time. ` +
      `Below is a JSON array of the terms they must know, each with how well they currently know it. ` +
      `Write ONE cohesive page of study NOTES (not flashcards, not a definitions list) meant to be read straight through in a few minutes.\n\n` +
      `Rules:\n` +
      `- Open with the concepts they're weakest on — explain each plainly. Bold the term name.\n` +
      `- Then a tighter refresher for "shaky" concepts.\n` +
      `- End with a one-line "You've got these:" list naming mastered concepts.\n` +
      `- Skip any term whose tier is "passive".\n` +
      `- Plain, casual language. Use markdown: "## Know these cold", "## Quick refresh", "## You've got these".\n\n` +
      `Terms (JSON):\n${termsJson}`,
  });

  return typeof res === 'string' ? res : JSON.stringify(res);
}
