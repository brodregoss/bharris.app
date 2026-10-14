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
  if (
    typeof message === 'string'
    && message.trim()
    && message.length <= 180
    && !/data:image|base64,/i.test(message)
  ) return message;
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

  // store:false keeps this completion out of OpenAI's stored-completion history.
  // It does not turn off abuse-monitoring retention. Confirm zero data retention
  // in the OpenAI account settings before treating photo text as unretained.
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content }],
    temperature: 0.4,
    store: false,
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
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('OpenAI returned an empty response');
  }

  if (!response_json_schema) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('OpenAI returned unreadable JSON');
  }
}
