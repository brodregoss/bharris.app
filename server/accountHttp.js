import {
  assertCanSpendForToken,
  estimateCostUsd,
  listAccounts,
  loginAccount,
  recordSpendForToken,
  registerAccount,
  setAccountLimit,
  unlockWithPin,
  usageForToken,
  userFromToken,
} from './accountDb.js';

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function tokenFromReq(req, body = {}) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof header === 'string' && /^Bearer /i.test(header)) {
    return header.slice(7).trim();
  }
  return String(body.accountToken || '');
}

export async function handleAccountAction(body, token) {
  const action = String(body?.action || '');
  if (action === 'unlock') {
    return unlockWithPin(body.pin);
  }
  if (action === 'register') {
    return registerAccount(body.email, body.password);
  }
  if (action === 'login') {
    return loginAccount(body.email, body.password);
  }
  if (action === 'me') {
    const user = await userFromToken(token);
    if (!user) throw new Error('Enter the password first.');
    return { user };
  }
  if (action === 'usage') {
    return usageForToken(token);
  }
  if (action === 'list') {
    return { accounts: await listAccounts(token, body.adminPin) };
  }
  if (action === 'setLimit') {
    const user = await setAccountLimit(token, body.email, {
      monthlyLimitUsd: body.monthlyLimitUsd,
      unlimited: !!body.unlimited,
      pin: body.adminPin,
    });
    return { user };
  }
  throw new Error('Unknown account action');
}

export async function runLlmForAccount(runLlm, body, token) {
  await assertCanSpendForToken(token);
  const { result, usage } = await runLlm({
    prompt: body.prompt,
    response_json_schema: body.response_json_schema,
    image: body.image,
  });
  const cost = estimateCostUsd(usage);
  const account = cost > 0 ? await recordSpendForToken(token, cost) : await userFromToken(token);
  return { result, usage, account };
}
