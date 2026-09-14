import { runLlm } from '../server/openaiLlm.js';
import { runLlmForAccount, setCors, tokenFromReq } from '../server/accountHttp.js';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 40;

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function overLimit(ip) {
  const now = Date.now();
  const current = hits.get(ip);
  if (!current || now - current.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_HITS;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  if (overLimit(clientIp(req))) {
    res.status(429).json({ error: 'Too many AI requests. Try again in a few minutes.' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const payload = await runLlmForAccount(runLlm, body, tokenFromReq(req, body));
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    const status = message.includes('missing OPENAI_API_KEY')
      ? 500
      : /password|budget|AI cap|AI limit/i.test(message)
        ? 403
        : 400;
    res.status(status).json({ error: message });
  }
}
