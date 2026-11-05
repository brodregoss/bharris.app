const MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_PROMPT_CHARS = 24000;
const MAX_IMAGE_CHARS = 5_000_000;

function toStrictSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;
  const next = { ...schema };
  if (next.properties) {
    next.type = next.type || 'object';
    next.additionalProperties = false;
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, value]) => [key, toStrictSchema(value)]),
    );
    next.required = Object.keys(next.properties);
  }
  if (next.items) next.items = toStrictSchema(next.items);
  return next;
}

function openaiErrorMessage(payload, status) {
  const message = payload?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (status === 401) return 'OpenAI rejected the server key.';
  return `OpenAI request failed (${status || 'network'})`;
}

export async function runLlm(env, { prompt, response_json_schema, image } = {}) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Server is missing OPENAI_API_KEY');
  if (!prompt || typeof prompt !== 'string') throw new Error('Missing prompt');
  if (prompt.length > MAX_PROMPT_CHARS) throw new Error('Prompt is too long');
  if (image != null) {
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      throw new Error('Photo must be an image');
    }
    if (image.length > MAX_IMAGE_CHARS) throw new Error('Photo is too large');
  }

  const content = image
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image } },
      ]
    : prompt;

  const body = {
    model: MODEL,
    messages: [{ role: 'user', content }],
    temperature: 0.4,
  };

  if (response_json_schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'result',
        strict: true,
        schema: toStrictSchema(response_json_schema),
      },
    };
  }

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(openaiErrorMessage(payload, res.status));

  const text = payload?.choices?.[0]?.message?.content;
  const usage = readUsage(payload?.usage);
  if (typeof text !== 'string' || !text.trim()) {
    const error = new Error('OpenAI returned an empty response');
    error.usage = usage;
    error.model = MODEL;
    throw error;
  }

  if (!response_json_schema) return { result: text, usage, model: MODEL };
  try {
    return { result: JSON.parse(text), usage, model: MODEL };
  } catch {
    const error = new Error('OpenAI returned unreadable JSON');
    error.usage = usage;
    error.model = MODEL;
    throw error;
  }
}

function readUsage(usage) {
  const prompt = Number(usage?.prompt_tokens ?? usage?.input_tokens) || 0;
  const completion = Number(usage?.completion_tokens ?? usage?.output_tokens) || 0;
  const total = Number(usage?.total_tokens) || prompt + completion;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
}
