import { invokeLlm } from '@/api/invokeLlm';

export const MCQ_OPTION_COUNT = 4;

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function extractItems(res) {
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.output?.items)) return res.output.items;
  if (Array.isArray(res?.questions)) return res.questions;
  if (Array.isArray(res)) return res;
  return [];
}

export function mcqNeedsGeneratedWrongs(terms, questions) {
  if (!Array.isArray(terms) || terms.length >= MCQ_OPTION_COUNT) return false;
  return (questions || []).some(
    (q) => q.type === 'mcq' && (q.options?.length || 0) < MCQ_OPTION_COUNT
  );
}

export async function fillMcqWrongAnswers(questions) {
  const jobs = (questions || []).filter(
    (q) => q.type === 'mcq' && (q.options?.length || 0) < MCQ_OPTION_COUNT
  );
  if (!jobs.length) return questions;

  const payload = jobs.map((q) => {
    const existingWrong = (q.options || []).filter(
      (o) => normalize(o) && normalize(o) !== normalize(q.definition)
    );
    return {
      term: q.term,
      definition: q.definition,
      existingWrong,
      need: Math.max(0, MCQ_OPTION_COUNT - 1 - existingWrong.length),
    };
  }).filter((p) => p.need > 0);

  if (!payload.length) return questions;

  const res = await invokeLlm({
    prompt:
      `You are writing wrong answers for a last-minute multiple-choice practice test.\n` +
      `The student only has a few real terms, so extra choices must be invented.\n` +
      `For each item, write exactly the requested number of plausible but incorrect definitions.\n` +
      `Match the length and tone of an exam option. Near-misses (related mix-ups) are good; silly answers are not.\n` +
      `Do not copy the correct definition. Do not copy any already-listed choices. Do not say they are wrong.\n\n` +
      payload
        .map(
          (p, i) =>
            `${i + 1}. Term: ${p.term}\n` +
            `   Correct definition: ${p.definition}\n` +
            `   Already using as other choices: ${p.existingWrong.length ? p.existingWrong.join(' | ') : '(none)'}\n` +
            `   Write exactly ${p.need} more wrong answers.`
        )
        .join('\n\n'),
    feature: 'distractors',
    response_json_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              wrong: { type: 'array', items: { type: 'string' } },
            },
            required: ['term', 'wrong'],
          },
        },
      },
      required: ['items'],
    },
  });

  const items = extractItems(res);
  const byTerm = new Map();
  items.forEach((item) => {
    const key = normalize(item?.term);
    if (!key || byTerm.has(key)) return;
    const wrong = Array.isArray(item?.wrong)
      ? item.wrong.map((s) => String(s || '').trim()).filter(Boolean)
      : [];
    byTerm.set(key, wrong);
  });

  let addedAny = false;
  let jobIndex = 0;
  const next = questions.map((q) => {
    if (q.type !== 'mcq' || (q.options?.length || 0) >= MCQ_OPTION_COUNT) return q;
    const existing = q.options?.length ? q.options : [q.definition];
    const seen = new Set(existing.map(normalize).filter(Boolean));
    const fallback = items[jobIndex];
    jobIndex += 1;
    const extras =
      byTerm.get(normalize(q.term)) ||
      (Array.isArray(fallback?.wrong)
        ? fallback.wrong.map((s) => String(s || '').trim()).filter(Boolean)
        : []);
    const added = [];
    for (const w of extras) {
      const key = normalize(w);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      added.push(w);
      if (existing.length + added.length >= MCQ_OPTION_COUNT) break;
    }
    if (!added.length) return q;
    addedAny = true;
    return { ...q, options: shuffle([...existing, ...added]) };
  });

  if (!addedAny) throw new Error('empty wrong answers');
  return next;
}
