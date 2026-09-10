import { runLlm } from './openaiLlm.js';
import { handleAccountAction, runLlmForAccount, setCors, tokenFromReq } from './accountHttp.js';

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

function applyCors(res) {
  setCors(res);
}

async function handleApi(req, res, kind) {
  applyCors(res);
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
    const token = tokenFromReq(req, body);
    if (kind === 'account') {
      const payload = await handleAccountAction(body, token);
      sendJson(res, 200, payload);
      return;
    }
    const payload = await runLlmForAccount(runLlm, body, token);
    sendJson(res, 200, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    const status = message.includes('missing OPENAI_API_KEY')
      ? 500
      : /sign in|admin only|wrong email|budget|AI cap/i.test(message)
        ? 403
        : 400;
    sendJson(res, status, { error: message });
  }
}

export function llmDevPlugin() {
  return {
    name: 'llm-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/account', async (req, res) => {
        await handleApi(req, res, 'account');
      });
      server.middlewares.use('/api/llm', async (req, res) => {
        await handleApi(req, res, 'llm');
      });
    },
  };
}
