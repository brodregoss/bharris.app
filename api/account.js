import { handleAccountAction, setCors, tokenFromReq } from '../server/accountHttp.js';

export default async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const payload = await handleAccountAction(body, tokenFromReq(req, body));
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account request failed';
    const status = /password|admin only|wrong email|no account|already has/i.test(message) ? 401 : 400;
    const code = /admin only/i.test(message) ? 403 : status;
    res.status(code).json({ error: message });
  }
}
