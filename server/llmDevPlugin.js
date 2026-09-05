import { runLlm } from './openaiLlm.js';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

export function llmDevPlugin() {
  return {
    name: 'llm-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'POST only' });
          return;
        }
        try {
          const body = await readJson(req);
          const result = await runLlm(body);
          sendJson(res, 200, { result });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'AI request failed';
          const status = message.includes('missing OPENAI_API_KEY') ? 500 : 400;
          sendJson(res, status, { error: message });
        }
      });
    },
  };
}
