import { invokeLlm } from '@/api/invokeLlm';

const CHALLENGE_LABELS = ['Familiar', 'Reworded', 'Apply it', 'Tricky', 'Hard'];

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function extractQuestions(res) {
  if (Array.isArray(res?.questions)) return res.questions;
  if (Array.isArray(res?.output?.questions)) return res.output.questions;
  if (Array.isArray(res)) return res;
  return [];
}

export function challengeLevel(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, n));
}

export function challengeLabel(level) {
  return CHALLENGE_LABELS[challengeLevel(level) - 1];
}

function wantedType(examType, index) {
  if (examType === 'short_answer') return 'short';
  if (examType === 'mixed') return index % 2 === 0 ? 'mcq' : 'short';
  return 'mcq';
}

function challengeBrief(level) {
  if (level <= 2) {
    return 'Reword the idea in a new sentence. Do not paste the definition. A student who knows the idea should still get it.';
  }
  if (level === 3) {
    return 'Ask them to use the idea in a short situation. Wrong answers should be close, not silly. Do not ask them to match the definition wording.';
  }
  return 'Make it hard. Use a situation, a comparison, or a trap where the choice that echoes the definition wording is wrong. Do not ask them to recognize the definition or the term. Short answers must apply the idea, not recite the definition.';
}

function pickTerms(terms, missedIds) {
  const missedSet = new Set(missedIds || []);
  const rank = { critical: 0, core: 1, passive: 2 };
  const ordered = [...(terms || [])].filter((t) => t?.term && t?.definition).sort((a, b) => {
    const am = missedSet.has(a.id) ? 0 : 1;
    const bm = missedSet.has(b.id) ? 0 : 1;
    if (am !== bm) return am - bm;
    return (rank[a.tier] ?? 3) - (rank[b.tier] ?? 3);
  });
  return ordered.slice(0, Math.min(ordered.length, 8));
}

function tooClose(prompt, term, level) {
  if (level < 4) return false;
  const text = normalize(prompt);
  const def = normalize(term.definition);
  const name = normalize(term.term);
  if (!text || text === def || text === name) return true;
  if (def && text.includes(def)) return true;
  return false;
}

function asOptions(raw, answer) {
  const options = (Array.isArray(raw) ? raw : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const option of options) {
    const key = normalize(option);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(option);
    if (unique.length >= 4) break;
  }
  if (!seen.has(normalize(answer))) unique[unique.length - 1] = answer;
  if (unique.length < 4 || !unique.some((option) => normalize(option) === normalize(answer))) return null;
  return shuffle(unique.slice(0, 4));
}

export async function generateChallengeQuestions(terms, { examType = 'mixed', challenge = 3, missedIds = [] } = {}) {
  const level = challengeLevel(challenge);
  const chosen = pickTerms(terms, missedIds);
  if (!chosen.length) throw new Error('no terms');
  const plan = chosen.map((term, index) => ({ term, type: wantedType(examType, index) }));

  const res = await invokeLlm({
    prompt:
      `You are writing a hard practice test from a student's own terms.\n` +
      `Challenge is ${level} of 5. ${challengeBrief(level)}\n` +
      `Use only these terms. Do not add facts that contradict the definition.\n` +
      `Each question uses the requested type.\n` +
      `mcq: one prompt and exactly 4 short choices. The answer is one of the choices. Wrong choices are plausible.\n` +
      `short: one prompt that cannot be answered by copying the definition. The answer is the model answer, one or two sentences.\n` +
      `The prompt must not be the definition copied back.\n\n` +
      plan
        .map(
          (item, index) =>
            `${index + 1}. type: ${item.type}\n` +
            `term: ${item.term.term}\n` +
            `definition: ${item.term.definition}`
        )
        .join('\n\n'),
    feature: 'practice',
    response_json_schema: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              type: { type: 'string', enum: ['mcq', 'short'] },
              prompt: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              answer: { type: 'string' },
            },
            required: ['term', 'type', 'prompt', 'answer'],
          },
        },
      },
      required: ['questions'],
    },
  });

  const byName = new Map();
  extractQuestions(res).forEach((item) => {
    const key = normalize(item?.term);
    if (key && !byName.has(key)) byName.set(key, item);
  });

  const questions = [];
  plan.forEach(({ term, type }) => {
    const hit = byName.get(normalize(term.term));
    const prompt = String(hit?.prompt || '').trim();
    const answer = String(hit?.answer || '').trim();
    if (!prompt || !answer || tooClose(prompt, term, level)) return;
    const options = type === 'mcq' ? asOptions(hit?.options, answer) : null;
    if (type === 'mcq' && !options) return;
    questions.push({
      id: term.id,
      term: term.term,
      definition: term.definition,
      tier: term.tier,
      type,
      prompt,
      answer,
      options,
    });
  });

  if (!questions.length) throw new Error('empty questions');
  return questions;
}
