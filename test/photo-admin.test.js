import test from 'node:test';
import assert from 'node:assert/strict';
import { uidToBucket } from '../worker/src/routing.js';
import { publicErrorMessage } from '../worker/src/util.js';
import { moderationAlertBody } from '../worker/src/moderation.js';
import {
  databaseForBucket,
  formatRows,
  parseD1Json,
  planPhotoAdmin,
  runPhotoAdmin,
  wranglerArgs,
} from '../scripts/photo-admin.mjs';

const SECRET = 'stage5-test-secret-not-a-real-key!!';
const HASH = 'a'.repeat(64);

function capture() {
  const out = [];
  const err = [];
  const calls = [];
  return {
    out,
    err,
    calls,
    write: (line) => out.push(line),
    writeError: (line) => err.push(line),
    exec(database, sql, locationFlag) {
      calls.push({ database, sql, locationFlag });
      if (sql.startsWith('SELECT shard_binding')) return { ok: true, results: [], changes: 0 };
      if (sql.startsWith('UPDATE users')) {
        return {
          ok: true,
          results: [{ firebase_uid: 'user-1', suspended: 0, photo_strikes: 0 }],
          changes: 0,
        };
      }
      if (sql.startsWith('UPDATE photo_access_codes')) {
        return { ok: true, results: [{ revoked_at: '2026-10-14T00:00:00.000Z' }], changes: 0 };
      }
      if (sql.startsWith('SELECT')) return { ok: true, results: [], changes: 0 };
      return { ok: true, results: [], changes: 1 };
    },
  };
}

test('admin commands stay local unless --allow-remote is passed', async () => {
  const local = capture();
  const code = await runPhotoAdmin({
    argv: ['list'],
    exec: local.exec,
    write: local.write,
    writeError: local.writeError,
  });
  assert.equal(code, 0);
  assert.equal(local.calls.every((call) => call.locationFlag === '--local'), true);
  assert.equal(wranglerArgs('studyapp-app', 'SELECT 1', '--local').includes('--remote'), false);

  const remote = capture();
  await runPhotoAdmin({
    argv: ['list', '--allow-remote'],
    exec: remote.exec,
    write: remote.write,
    writeError: remote.writeError,
  });
  assert.equal(remote.calls.every((call) => call.locationFlag === '--remote'), true);
  assert.match(remote.err.join('\n'), /remote database/);

  const both = capture();
  const refused = await runPhotoAdmin({
    argv: ['list', '--local', '--allow-remote'],
    exec: both.exec,
    write: both.write,
    writeError: both.writeError,
  });
  assert.equal(refused, 1);
  assert.equal(both.calls.length, 0);
  assert.equal(planPhotoAdmin([]).ok, false);
});

test('generate prints the access code once and stores only the hash', async () => {
  const cap = capture();
  const code = await runPhotoAdmin({
    argv: ['generate', '--uses', '1'],
    env: { PHOTO_CODE_SECRET: SECRET },
    exec: cap.exec,
    write: cap.write,
    writeError: cap.writeError,
    now: '2026-10-14T00:00:00.000Z',
  });
  assert.equal(code, 0);
  const printed = cap.out.filter((line) => line.startsWith('code '));
  assert.equal(printed.length, 1);
  const accessCode = printed[0].slice(5);
  assert.match(accessCode, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){5}-[0-9A-HJKMNP-TV-Z]{2}$/);
  const sql = cap.calls.map((call) => call.sql).join('\n');
  assert.equal(sql.includes(accessCode), false);
  assert.match(sql, /INSERT INTO photo_access_codes/);
  assert.match(cap.out[1], /^hash [0-9a-f]{64}$/);
});

test('list and flags omit the code, the image, and any extra columns', () => {
  const codes = formatRows([{
    code: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG',
    code_hash: HASH,
    max_uses: 1,
    use_count: 0,
    expires_at: '',
    revoked_at: '',
    redeemed_uid: '',
    redeemed_at: '',
    created_at: '2026-10-14T00:00:00.000Z',
    image: 'data:image/jpeg;base64,abc',
  }], ['code_hash', 'max_uses', 'use_count', 'expires_at', 'revoked_at', 'redeemed_uid', 'redeemed_at', 'created_at']);
  assert.equal(codes.join('\n').includes('AAAA-BBBB'), false);
  assert.equal(codes.join('\n').includes('data:image'), false);
  assert.match(codes[0], new RegExp(`code_hash=${HASH}`));

  const flags = formatRows([{
    firebase_uid: 'user-1',
    created_at: '2026-10-14T00:00:00.000Z',
    provider: 'openai',
    categories: '["sexual"]',
    severity: 'mild',
    image_sha256: HASH,
    image_bytes: 'raw',
    note: 'mitochondria',
  }], ['firebase_uid', 'created_at', 'provider', 'categories', 'severity', 'image_sha256']);
  assert.equal(flags.join('\n').includes('mitochondria'), false);
  assert.equal(flags.join('\n').includes('image_bytes'), false);
});

test('revoke refuses a raw code and unsuspend resets strikes on that account shard', async () => {
  const bad = capture();
  const refused = await runPhotoAdmin({
    argv: ['revoke', '--hash', 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-GG'],
    exec: bad.exec,
    write: bad.write,
    writeError: bad.writeError,
  });
  assert.equal(refused, 1);
  assert.equal(bad.calls.length, 0);

  const revoked = capture();
  const revokeCode = await runPhotoAdmin({
    argv: ['revoke', '--hash', HASH],
    exec: revoked.exec,
    write: revoked.write,
    writeError: revoked.writeError,
    now: '2026-10-14T00:00:00.000Z',
  });
  assert.equal(revokeCode, 0);
  assert.equal(revoked.out.join('\n').includes('code '), false);
  assert.match(revoked.out.join('\n'), new RegExp(`revoked hash=${HASH}`));

  const cap = capture();
  const uid = 'user-1';
  const code = await runPhotoAdmin({
    argv: ['unsuspend', '--uid', uid, '--operator', 'casey'],
    exec: cap.exec,
    write: cap.write,
    writeError: cap.writeError,
    now: '2026-10-14T00:00:00.000Z',
  });
  assert.equal(code, 0);
  const update = cap.calls.find((call) => call.sql.startsWith('UPDATE users'));
  assert.match(update.sql, /suspended = 0/);
  assert.match(update.sql, /photo_strikes = 0/);
  assert.equal(update.database, databaseForBucket(await uidToBucket(uid)));
  assert.match(cap.out.join('\n'), /operator=casey/);
  assert.match(cap.out.join('\n'), /strikes=0/);
  const log = cap.calls.find((call) => call.sql.startsWith('INSERT INTO photo_admin_log'));
  assert.match(log.sql, /unsuspend/);
  assert.equal(log.sql.includes('data:image'), false);
});

test('a database error does not echo image bytes or the command text', async () => {
  const cap = capture();
  cap.exec = () => ({ ok: false, error: 'failed data:image/jpeg;base64,AAAA INSERT secret' });
  const code = await runPhotoAdmin({
    argv: ['list'],
    exec: cap.exec,
    write: cap.write,
    writeError: cap.writeError,
  });
  assert.equal(code, 1);
  assert.equal(cap.err.join('\n').includes('data:image'), false);
  assert.equal(cap.err.join('\n'), 'Database command failed.');
});

test('worker errors drop image data and access codes', () => {
  const code = 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ23-45';
  assert.equal(publicErrorMessage(new Error(`bad ${code}`), 'Server error'), 'Server error');
  assert.equal(publicErrorMessage('data:image/jpeg;base64,AAAA', 'Study AI failed'), 'Study AI failed');
  assert.equal(publicErrorMessage(new Error('Photo import is temporarily unavailable.'), 'Server error'), 'Photo import is temporarily unavailable.');
  const alert = moderationAlertBody('user-1', {
    ok: true,
    severity: 'severe',
    categories: ['sexual/minors'],
    image: 'data:image/jpeg;base64,AAAA',
    hash: HASH,
  }, '2026-10-14T00:00:00.000Z');
  assert.deepEqual(Object.keys(alert).sort(), ['categories', 'content', 'severity', 'text', 'time', 'userId']);
  assert.equal(JSON.stringify(alert).includes('data:image'), false);
  assert.equal(JSON.stringify(alert).includes(HASH), false);
});

test('d1 json parsing reads rows without requiring a remote call', () => {
  const parsed = parseD1Json(JSON.stringify([{
    results: [{ code_hash: HASH }],
    meta: { changes: 2 },
  }]));
  assert.equal(parsed.results[0].code_hash, HASH);
  assert.equal(parsed.changes, 2);
  assert.throws(() => wranglerArgs('other-db', 'SELECT 1', '--remote'));
  assert.throws(() => wranglerArgs('studyapp-app', 'SELECT 1', '--json'));
});
