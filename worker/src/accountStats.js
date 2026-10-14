import { isAdminUid, countAccounts } from './users.js';
import { verifyDevToken } from './notesScanLock.js';
import { errorJson, json } from './util.js';

async function devToolsOpen(request, env, identity) {
  const devToken = request.headers.get('X-Dev-Tools-Token') || '';
  if (devToken && await verifyDevToken(env.NOTES_SCAN_TOKEN_SECRET, devToken, identity.uid)) return true;
  return isAdminUid(env, identity.uid, identity.email);
}

export async function handleAccountStats(request, env, identity) {
  if (!(await devToolsOpen(request, env, identity))) {
    return errorJson('Enter the dev code first.', 403);
  }
  return json(await countAccounts(env));
}
