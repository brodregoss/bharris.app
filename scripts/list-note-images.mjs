import { pathToFileURL } from 'node:url';

// Read-only list of notes/{uid}/ object keys.
// Wrangler can download or delete an R2 object, and this Wrangler has no list command.
// The script therefore calls the list API itself, and only after --allow-remote.

const LIST_HOST = 'https://api.cloudflare.com';

function flagValue(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return '';
  return String(args[index + 1] || '').trim();
}

export function planListNoteImages(argv, env = {}) {
  const args = Array.isArray(argv) ? argv : [];
  if (!args.includes('--allow-remote')) {
    return {
      ok: false,
      code: 1,
      message: 'Refusing to list a remote R2 bucket. Pass --allow-remote to continue. This script only lists keys and does not download or delete objects.',
    };
  }
  const uid = flagValue(args, '--uid');
  const bucket = flagValue(args, '--bucket');
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(uid)) {
    return { ok: false, code: 1, message: 'Pass --uid <account id>.' };
  }
  if (!/^[a-z0-9][a-z0-9-]{1,61}$/.test(bucket)) {
    return { ok: false, code: 1, message: 'Pass --bucket <r2 bucket name>.' };
  }
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const token = String(env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!accountId || !token) {
    return {
      ok: false,
      code: 1,
      message: 'Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in the environment. Do not put them in the script.',
    };
  }
  const prefix = `notes/${uid}/`;
  return { ok: true, code: 0, prefix, bucket, accountId, token };
}

function listUrl(plan, cursor) {
  const url = new URL(
    `${LIST_HOST}/client/v4/accounts/${encodeURIComponent(plan.accountId)}/r2/buckets/${encodeURIComponent(plan.bucket)}/objects`,
  );
  url.searchParams.set('prefix', plan.prefix);
  if (cursor) url.searchParams.set('cursor', cursor);
  return url;
}

function objectRows(payload) {
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.result?.objects)) return payload.result.objects;
  return [];
}

function nextCursor(payload) {
  const info = payload?.result_info || payload?.result || {};
  if (info.is_truncated === false) return '';
  return String(info.cursor || '').trim();
}

export async function listNoteImages({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch,
  write = console.log,
  writeError = console.error,
} = {}) {
  const plan = planListNoteImages(argv, env);
  if (!plan.ok) {
    writeError(plan.message);
    return plan.code;
  }
  let cursor = '';
  const seen = new Set();
  for (let page = 0; page < 100; page += 1) {
    const url = listUrl(plan, cursor);
    if (url.hostname !== 'api.cloudflare.com' || !url.pathname.endsWith('/objects')) {
      writeError('Refusing a request that is not an R2 object list.');
      return 1;
    }
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${plan.token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      writeError('Could not list that bucket.');
      return 1;
    }
    for (const object of objectRows(payload)) {
      const key = String(object?.key || '');
      if (!key.startsWith(plan.prefix) || seen.has(key)) continue;
      seen.add(key);
      write([key, Number(object.size) || 0, object.uploaded || ''].join('\t'));
    }
    const next = nextCursor(payload);
    if (!next || next === cursor) break;
    cursor = next;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await listNoteImages();
  process.exit(code);
}
