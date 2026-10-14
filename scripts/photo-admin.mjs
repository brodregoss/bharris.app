import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAccessCode, hashAccessCode } from '../worker/src/photoAccess.js';
import { uidToBucket } from '../worker/src/routing.js';

// Local photo admin commands. They stay on the local D1 database unless
// --allow-remote is passed. A code is printed once, at creation, and is not
// stored. Later commands show the hash only.

const APP_DB = 'studyapp-app';
const SHARDS = [
  ['USER_00', 'studyapp-user-00', 0, 8191],
  ['USER_01', 'studyapp-user-01', 8192, 16383],
  ['USER_02', 'studyapp-user-02', 16384, 24575],
  ['USER_03', 'studyapp-user-03', 24576, 32767],
  ['USER_04', 'studyapp-user-04', 32768, 40959],
  ['USER_05', 'studyapp-user-05', 40960, 49151],
  ['USER_06', 'studyapp-user-06', 49152, 57343],
  ['USER_07', 'studyapp-user-07', 57344, 65535],
];
const DATABASES = new Set([APP_DB, ...SHARDS.map((row) => row[1])]);
const CODE_FIELDS = [
  'code_hash', 'max_uses', 'use_count', 'expires_at',
  'revoked_at', 'redeemed_uid', 'redeemed_at', 'created_at',
];
const FLAG_FIELDS = [
  'firebase_uid', 'created_at', 'provider', 'categories', 'severity', 'image_sha256',
];
const UID_RE = /^[A-Za-z0-9:._-]{1,128}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const OPERATOR_RE = /^[A-Za-z0-9 .@_-]{1,80}$/;

const HELP = `Photo admin commands stay on the local database unless you pass --allow-remote.

  node scripts/photo-admin.mjs generate [--uses 1] [--expires <ISO time>]
  node scripts/photo-admin.mjs list
  node scripts/photo-admin.mjs revoke --hash <64 hex chars>
  node scripts/photo-admin.mjs unsuspend --uid <id> --operator <name>
  node scripts/photo-admin.mjs flags [--uid <id>]

generate prints the access code once. list and revoke show the hash, not the code.
Set PHOTO_CODE_SECRET in the environment before generate. Do not put it in this file.`;

function flagValue(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return '';
  return String(args[index + 1] || '').trim();
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function wranglerArgs(database, sql, locationFlag) {
  if (locationFlag !== '--local' && locationFlag !== '--remote') {
    throw new Error('Refusing to run without --local or --remote.');
  }
  if (!DATABASES.has(database)) throw new Error('Unknown database');
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('Missing SQL');
  return ['d1', 'execute', database, locationFlag, '--json', '--yes', '--command', sql];
}

export function parseD1Json(text) {
  const data = JSON.parse(String(text || ''));
  const pages = Array.isArray(data) ? data : [data];
  return {
    results: pages.flatMap((page) => (Array.isArray(page?.results) ? page.results : [])),
    changes: pages.reduce((sum, page) => sum + (Number(page?.meta?.changes) || 0), 0),
  };
}

function safeDbError(error) {
  if (/no such table/i.test(String(error || ''))) return 'That table is not on this database yet.';
  return 'Database command failed.';
}

function databaseForBinding(binding) {
  const row = SHARDS.find((item) => item[0] === binding);
  return row ? row[1] : '';
}

export function databaseForBucket(bucket) {
  const row = SHARDS.find((item) => bucket >= item[2] && bucket <= item[3]);
  return row ? row[1] : '';
}

export function formatRows(rows, fields) {
  return (Array.isArray(rows) ? rows : []).map((row) => (
    fields.map((key) => `${key}=${row?.[key] ?? ''}`).join(' ')
  ));
}

const MODERATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS moderation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT NOT NULL,
  created_at TEXT NOT NULL,
  provider TEXT NOT NULL,
  categories TEXT NOT NULL,
  severity TEXT NOT NULL,
  image_sha256 TEXT NOT NULL
)`;

function ensureCodeTablesSql() {
  return [
    `CREATE TABLE IF NOT EXISTS photo_access_codes (
      code_hash TEXT PRIMARY KEY,
      max_uses INTEGER NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      revoked_at TEXT,
      redeemed_uid TEXT,
      redeemed_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS photo_admin_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      operator TEXT NOT NULL,
      action TEXT NOT NULL,
      firebase_uid TEXT NOT NULL
    )`,
  ];
}

function commandName(args) {
  for (let i = 0; i < args.length; i += 1) {
    const item = String(args[i]);
    if (item.startsWith('--')) {
      if (!item.includes('=') && args[i + 1] && !String(args[i + 1]).startsWith('--')) i += 1;
      continue;
    }
    return item;
  }
  return '';
}

export function planPhotoAdmin(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const command = commandName(args);
  if (args.includes('--local') && args.includes('--allow-remote')) {
    return { ok: false, code: 1, message: 'Pass either nothing (local) or --allow-remote, not both.' };
  }
  if (!command || command === 'help') return { ok: false, code: 1, message: HELP };
  const known = new Set(['generate', 'list', 'revoke', 'unsuspend', 'flags']);
  if (!known.has(command)) return { ok: false, code: 1, message: HELP };
  return {
    ok: true,
    code: 0,
    command,
    locationFlag: args.includes('--allow-remote') ? '--remote' : '--local',
    uses: flagValue(args, '--uses'),
    expires: flagValue(args, '--expires'),
    hash: flagValue(args, '--hash'),
    uid: flagValue(args, '--uid'),
    operator: flagValue(args, '--operator'),
  };
}

function defaultExec(database, sql, locationFlag) {
  const workerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../worker');
  const wrangler = path.join(workerDir, 'node_modules/.bin/wrangler');
  const result = spawnSync(wrangler, wranglerArgs(database, sql, locationFlag), {
    cwd: workerDir,
    encoding: 'utf8',
  });
  if (result.status !== 0) return { ok: false, error: `${result.stderr || ''}${result.stdout || ''}` };
  try {
    return { ok: true, ...parseD1Json(result.stdout) };
  } catch {
    return { ok: false, error: 'unreadable' };
  }
}

async function execSql(exec, database, sql, locationFlag) {
  const result = await exec(database, sql, locationFlag);
  if (!result?.ok) return { ok: false, error: safeDbError(result?.error) };
  return result;
}

export async function runPhotoAdmin({
  argv = process.argv.slice(2),
  env = process.env,
  exec = defaultExec,
  write = console.log,
  writeError = console.error,
  now = new Date().toISOString(),
} = {}) {
  const plan = planPhotoAdmin(argv);
  if (!plan.ok) {
    writeError(plan.message);
    return plan.code;
  }
  if (plan.locationFlag === '--remote') {
    writeError('Using the remote database named in worker/wrangler.jsonc.');
  }

  if (plan.command === 'generate') return generateCode(plan, env, exec, write, writeError, now);
  if (plan.command === 'list') return listCodes(plan, exec, write, writeError);
  if (plan.command === 'revoke') return revokeCode(plan, exec, write, writeError, now);
  if (plan.command === 'unsuspend') return unsuspend(plan, exec, write, writeError, now, env);
  return listFlags(plan, exec, write, writeError);
}

async function generateCode(plan, env, exec, write, writeError, now) {
  const secret = String(env.PHOTO_CODE_SECRET || '');
  if (secret.length < 32) {
    writeError('Set PHOTO_CODE_SECRET in the environment. It must be at least 32 characters.');
    return 1;
  }
  const uses = plan.uses ? Number(plan.uses) : 1;
  if (!Number.isInteger(uses) || uses < 1 || uses > 100) {
    writeError('Pass --uses as a whole number from 1 to 100.');
    return 1;
  }
  const expires = plan.expires || null;
  if (expires && !ISO_RE.test(expires)) {
    writeError('Pass --expires as a UTC time like 2026-11-01T00:00:00.000Z.');
    return 1;
  }
  for (const sql of ensureCodeTablesSql()) {
    const ready = await execSql(exec, APP_DB, sql, plan.locationFlag);
    if (!ready.ok) {
      writeError(ready.error);
      return 1;
    }
  }
  const code = generateAccessCode();
  const codeHash = await hashAccessCode({ PHOTO_CODE_SECRET: secret }, code);
  if (!HASH_RE.test(codeHash)) {
    writeError('Could not store that access code.');
    return 1;
  }
  const stored = await execSql(exec, APP_DB, `INSERT INTO photo_access_codes (
      code_hash, max_uses, use_count, expires_at, revoked_at, redeemed_uid, redeemed_at, created_at
    ) VALUES (${sqlString(codeHash)}, ${uses}, 0, ${expires ? sqlString(expires) : 'NULL'}, NULL, NULL, NULL, ${sqlString(now)})`, plan.locationFlag);
  if (!stored.ok) {
    writeError(stored.error);
    return 1;
  }
  write(`code ${code}`);
  write(`hash ${codeHash}`);
  return 0;
}

async function listCodes(plan, exec, write, writeError) {
  for (const sql of ensureCodeTablesSql().slice(0, 1)) {
    const ready = await execSql(exec, APP_DB, sql, plan.locationFlag);
    if (!ready.ok) {
      writeError(ready.error);
      return 1;
    }
  }
  const listed = await execSql(
    exec,
    APP_DB,
    `SELECT ${CODE_FIELDS.join(', ')} FROM photo_access_codes ORDER BY created_at DESC LIMIT 100`,
    plan.locationFlag,
  );
  if (!listed.ok) {
    writeError(listed.error);
    return 1;
  }
  const lines = formatRows(listed.results, CODE_FIELDS);
  if (!lines.length) write('no codes');
  lines.forEach((line) => write(line));
  return 0;
}

async function revokeCode(plan, exec, write, writeError, now) {
  if (!HASH_RE.test(plan.hash)) {
    writeError('Pass --hash with the 64-character hash from list. Do not pass the access code.');
    return 1;
  }
  const ready = await execSql(exec, APP_DB, ensureCodeTablesSql()[0], plan.locationFlag);
  if (!ready.ok) {
    writeError(ready.error);
    return 1;
  }
  const updated = await execSql(
    exec,
    APP_DB,
    `UPDATE photo_access_codes SET revoked_at = ${sqlString(now)} WHERE code_hash = ${sqlString(plan.hash)} AND revoked_at IS NULL; SELECT revoked_at FROM photo_access_codes WHERE code_hash = ${sqlString(plan.hash)}`,
    plan.locationFlag,
  );
  if (!updated.ok) {
    writeError(updated.error);
    return 1;
  }
  const revokedAt = String(updated.results.at(-1)?.revoked_at || '');
  write(revokedAt === now ? `revoked hash=${plan.hash}` : 'not revoked');
  return 0;
}

async function unsuspend(plan, exec, write, writeError, now, env) {
  const uid = plan.uid;
  const operator = plan.operator || String(env.PHOTO_ADMIN_OPERATOR || '').trim();
  if (!UID_RE.test(uid)) {
    writeError('Pass --uid with the account id.');
    return 1;
  }
  if (!OPERATOR_RE.test(operator)) {
    writeError('Pass --operator with your name, or set PHOTO_ADMIN_OPERATOR.');
    return 1;
  }
  const override = await execSql(
    exec,
    APP_DB,
    `SELECT shard_binding FROM bucket_overrides WHERE firebase_uid = ${sqlString(uid)}`,
    plan.locationFlag,
  );
  let database = '';
  if (override.ok && override.results[0]?.shard_binding) {
    database = databaseForBinding(String(override.results[0].shard_binding));
  } else if (!override.ok && override.error !== 'That table is not on this database yet.') {
    writeError(override.error);
    return 1;
  }
  if (!database) database = databaseForBucket(await uidToBucket(uid));
  if (!database) {
    writeError('Could not find that account database.');
    return 1;
  }
  const updated = await execSql(
    exec,
    database,
    `UPDATE users SET suspended = 0, photo_strikes = 0, updated_at = ${sqlString(now)} WHERE firebase_uid = ${sqlString(uid)}; SELECT firebase_uid, suspended, photo_strikes FROM users WHERE firebase_uid = ${sqlString(uid)}`,
    plan.locationFlag,
  );
  if (!updated.ok) {
    writeError(updated.error);
    return 1;
  }
  const account = updated.results.at(-1);
  if (!account || Number(account.suspended) !== 0 || Number(account.photo_strikes) !== 0) {
    write('No account with that id.');
    return 1;
  }
  const logged = await execSql(
    exec,
    APP_DB,
    `CREATE TABLE IF NOT EXISTS photo_admin_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      operator TEXT NOT NULL,
      action TEXT NOT NULL,
      firebase_uid TEXT NOT NULL
    )`,
    plan.locationFlag,
  );
  if (!logged.ok) {
    writeError(logged.error);
    return 1;
  }
  const inserted = await execSql(
    exec,
    APP_DB,
    `INSERT INTO photo_admin_log (created_at, operator, action, firebase_uid) VALUES (${sqlString(now)}, ${sqlString(operator)}, 'unsuspend', ${sqlString(uid)})`,
    plan.locationFlag,
  );
  if (!inserted.ok) {
    writeError(inserted.error);
    return 1;
  }
  write(`unsuspended uid=${uid} operator=${operator} time=${now} strikes=0`);
  return 0;
}

async function listFlags(plan, exec, write, writeError) {
  if (plan.uid && !UID_RE.test(plan.uid)) {
    writeError('Pass --uid with the account id.');
    return 1;
  }
  const ready = await execSql(exec, APP_DB, MODERATION_TABLE_SQL, plan.locationFlag);
  if (!ready.ok) {
    writeError(ready.error);
    return 1;
  }
  const where = plan.uid ? ` WHERE firebase_uid = ${sqlString(plan.uid)}` : '';
  const listed = await execSql(
    exec,
    APP_DB,
    `SELECT ${FLAG_FIELDS.join(', ')} FROM moderation_events${where} ORDER BY id DESC LIMIT 100`,
    plan.locationFlag,
  );
  if (!listed.ok) {
    writeError(listed.error);
    return 1;
  }
  const lines = formatRows(listed.results, FLAG_FIELDS);
  if (!lines.length) write('no flags');
  lines.forEach((line) => write(line));
  return 0;
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const code = await runPhotoAdmin();
  process.exit(code);
}
