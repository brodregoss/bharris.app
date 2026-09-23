import { invokeLlm } from '@/api/invokeLlm';

const HARD_CAP = 80;
const BATCH = 12;

function extractTermList(res) {
  if (Array.isArray(res?.terms)) return res.terms;
  if (Array.isArray(res?.output?.terms)) return res.output.terms;
  if (Array.isArray(res)) return res;
  return [];
}

function normalizeName(s) {
  return String(s || '').trim().toLowerCase();
}

function parseExtracted(res) {
  return extractTermList(res)
    .map((t) => ({
      term: String(t?.term || '').trim(),
      notes: String(t?.notes || '').trim(),
    }))
    .filter((t) => t.term);
}

function mergeUnique(base, extra) {
  const seen = new Set(base.map((t) => normalizeName(t.term)));
  const out = [...base];
  extra.forEach((t) => {
    const key = normalizeName(t.term);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(t);
  });
  return out.slice(0, HARD_CAP);
}

function scopeLine(scoped) {
  return scoped
    ? `This image is one area the student highlighted on a page of notes.\n` +
      `Extract terms only from what is visible in this image.\n`
    : '';
}

async function extractPass(image, already, { scoped = false } = {}) {
  const prompt = already?.length
    ? `${scopeLine(scoped)}` +
      `This is the same image of a student's study notes.\n` +
      `These terms were already extracted:\n${already.map((t) => `- ${t}`).join('\n')}\n\n` +
      `List every remaining term, heading, or concept still visible that is not in that list.\n` +
      `If nothing is left, return an empty terms array.\n` +
      `Do not repeat names. Do not invent topics that are not in the image.`
    : `${scopeLine(scoped)}` +
      (scoped
        ? ''
        : `This is a photo of a student's study notes (handwritten or printed).\n`) +
      `Extract EVERY distinct term, heading, numbered item, or concept that actually appears.\n` +
      `Do not stop at a short list — a full page may have many terms.\n` +
      `Do not invent topics that are not in the image.\n` +
      `For each: term (short name as written), notes (any definition or explanation written next to it; empty string if none).`;

  const res = await invokeLlm({
    prompt,
    image,
    feature: 'extract',
    response_json_schema: {
      type: 'object',
      properties: {
        terms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['term', 'notes'],
          },
        },
      },
      required: ['terms'],
    },
  });
  return parseExtracted(res);
}

function asExtractImage(item) {
  if (typeof item === 'string') return item ? { image: item, scoped: false } : null;
  if (!item?.image) return null;
  return { image: item.image, scoped: !!item.scoped };
}

export async function extractTermsFromPhoto(image, onProgress, options) {
  onProgress?.('Finding terms…');
  const first = await extractPass(image, null, options);
  let list = first.slice(0, HARD_CAP);
  if (list.length >= 8 && list.length < HARD_CAP) {
    onProgress?.('Looking for more terms…');
    const more = await extractPass(image, list.map((t) => t.term), options);
    list = mergeUnique(list, more);
  }
  if (!list.length) throw new Error('empty terms');
  return list;
}

export async function extractTermsFromPhotos(images, onProgress) {
  const list = (Array.isArray(images) ? images : [images]).map(asExtractImage).filter(Boolean);
  if (!list.length) throw new Error('empty terms');
  let all = [];
  for (let i = 0; i < list.length; i++) {
    const page = list.length > 1 ? ` (${i + 1} of ${list.length})` : '';
    try {
      const found = await extractTermsFromPhoto(
        list[i].image,
        (msg) => onProgress?.(`${msg}${page}`),
        { scoped: list[i].scoped },
      );
      all = mergeUnique(all, found);
    } catch (err) {
      if (err?.message !== 'empty terms') throw err;
    }
  }
  if (!all.length) throw new Error('empty terms');
  return all;
}

async function defineChunk(terms) {
  const res = await invokeLlm({
    prompt:
      `Write a concise one-sentence exam definition for each study term.\n` +
      `Use the student's notes when they help. Do not add or remove terms.\n\n` +
      terms.map((t, i) => `${i + 1}. ${t.term}${t.notes ? ` — notes: ${t.notes}` : ''}`).join('\n'),
    feature: 'definitions',
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
            },
            required: ['term', 'definition'],
          },
        },
      },
      required: ['terms'],
    },
  });
  const ranked = extractTermList(res);
  const byName = new Map();
  ranked.forEach((r) => {
    const key = normalizeName(r?.term);
    if (key && !byName.has(key)) byName.set(key, String(r?.definition || '').trim());
  });
  return terms.map((t) => ({
    term: t.term,
    definition: byName.get(normalizeName(t.term)) || t.notes || '',
    notes: t.notes,
    id: t.id,
  }));
}

export async function generateDefinitions(terms, onProgress) {
  const out = [];
  for (let i = 0; i < terms.length; i += BATCH) {
    const chunk = terms.slice(i, i + BATCH);
    onProgress?.(`Writing definitions… ${Math.min(i + chunk.length, terms.length)}/${terms.length}`);
    const defined = await defineChunk(chunk);
    out.push(...defined);
  }
  return out.map((t, i) => ({
    id: t.id || `p${i}`,
    term: t.term,
    definition: t.definition,
  }));
}

export async function regenerateDefinition({ term, definition }) {
  const res = await invokeLlm({
    prompt:
      `Write one concise exam-ready sentence defining "${term}".\n` +
      (definition ? `The current definition is: "${definition}". Improve it if needed; keep the same meaning if it is already right.\n` : '') +
      `Return only the definition.`,
    feature: 'definitions',
    response_json_schema: {
      type: 'object',
      properties: { definition: { type: 'string' } },
      required: ['definition'],
    },
  });
  const raw = res?.definition ?? res?.output?.definition;
  const next = typeof raw === 'string' ? raw.trim() : '';
  if (!next) throw new Error('empty definition');
  return next;
}
