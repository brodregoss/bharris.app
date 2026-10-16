import test from 'node:test';
import assert from 'node:assert/strict';
import { uidToBucket } from '../worker/src/routing.js';
import { publicErrorMessage } from '../worker/src/util.js';
import { moderationAlertText } from '../worker/src/moderation.js';
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
        const suspended = /suspended = 1/.test(sql) ? 1 : 0;
        return {
          ok: true,
          results: [{ firebase_uid: 'user-1', suspended, photo_strikes: suspended ? 2 : 0 }],
          changes: 1,
        };
      }
      if (sql.startsWith('UPDATE photo_access_codes')) {
        return {
          ok: true,
          results: [{ revoked_at: '2026-10-14T00:00:00.000Z' }],
          changes: sql.includes('use_count = 0') ? 3 : 0,
        };
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
  const alert = moderationAlertText('user-1', {
    ok: true,
    severity: 'severe',
    categories: ['sexual/minors'],
    image: 'data:image/jpeg;base64,AAAA',
    hash: HASH,
    email: 'student@example.com',
  }, '2026-10-14T00:00:00.000Z');
  assert.match(alert, /userId=user-1/);
  assert.match(alert, /severity=severe/);
  assert.match(alert, /categories=sexual\/minors/);
  assert.equal(alert.includes('data:image'), false);
  assert.equal(alert.includes(HASH), false);
  assert.equal(alert.includes('student@example.com'), false);
  assert.equal(moderationAlertText('student@example.com', {
    ok: true,
    severity: 'mild',
    categories: [],
  }, '2026-10-14T00:00:00.000Z').includes('@'), false);
});

test('usage, suspend, and revoke-all-codes stay local and omit secrets', async () => {
  const usage = capture();
  usage.exec = (database, sql, locationFlag) => {
    usage.calls.push({ database, sql, locationFlag });
    if (sql.startsWith('SELECT kind, bucket, count')) {
      return {
        ok: true,
        results: [
          { kind: 'check', bucket: 'day:2026-10-15', count: 3, image: 'data:image/jpeg;base64,AAAA' },
          { kind: 'check', bucket: 'month:2026-10', count: 9 },
          { kind: 'vision', bucket: 'day:2026-10-15', count: 2 },
          { kind: 'vision', bucket: 'month:2026-10', count: 4 },
          { kind: 'check', bucket: `user:user-1:day:2026-10-15`, count: 3, image_sha256: HASH },
          { kind: 'vision', bucket: 'user:user-1:day:2026-10-15', count: 2, code: 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ23-45' },
        ],
        changes: 0,
      };
    }
    return { ok: true, results: [], changes: 1 };
  };
  const usageCode = await runPhotoAdmin({
    argv: ['usage'],
    exec: usage.exec,
    write: usage.write,
    writeError: usage.writeError,
    now: '2026-10-15T12:00:00.000Z',
  });
  assert.equal(usageCode, 0);
  assert.equal(usage.calls.every((call) => call.locationFlag === '--local'), true);
  const usageText = usage.out.join('\n');
  assert.match(usageText, /check today=3\/300 month=9\/5000 per_user_daily_cap=60/);
  assert.match(usageText, /vision today=2\/300 month=4\/5000 per_user_daily_cap=100/);
  assert.match(usageText, /check uid=user-1 today=3/);
  assert.match(usageText, /vision uid=user-1 today=2/);
  assert.equal(usageText.includes('data:image'), false);
  assert.equal(usageText.includes(HASH), false);
  assert.equal(usageText.includes('ABCD-EFGH'), false);

  const suspended = capture();
  const suspendCode = await runPhotoAdmin({
    argv: ['suspend', '--uid', 'user-1', '--operator', 'casey', '--reason', 'reviewed the account'],
    exec: suspended.exec,
    write: suspended.write,
    writeError: suspended.writeError,
    now: '2026-10-14T00:00:00.000Z',
  });
  assert.equal(suspendCode, 0);
  const update = suspended.calls.find((call) => call.sql.startsWith('UPDATE users'));
  assert.match(update.sql, /suspended = 1/);
  assert.equal(/UPDATE users SET[^;]*photo_strikes/.test(update.sql), false);
  assert.equal(update.database, databaseForBucket(await uidToBucket('user-1')));
  const log = suspended.calls.find((call) => call.sql.startsWith('INSERT INTO photo_admin_log'));
  assert.match(log.sql, /'suspend'/);
  assert.match(log.sql, /reviewed the account/);
  assert.match(suspended.out.join('\n'), /suspended uid=user-1 operator=casey/);
  assert.equal(suspended.out.join('\n').includes('reviewed the account'), false);

  const badReason = capture();
  const refused = await runPhotoAdmin({
    argv: ['suspend', '--uid', 'user-1', '--operator', 'casey', '--reason', 'data:image/jpeg;base64,AAAA'],
    exec: badReason.exec,
    write: badReason.write,
    writeError: badReason.writeError,
  });
  assert.equal(refused, 1);
  assert.equal(badReason.calls.length, 0);
  assert.equal(badReason.err.join('\n').includes('data:image'), false);

  const revoked = capture();
  const revokeCode = await runPhotoAdmin({
    argv: ['revoke-all-codes', '--operator', 'casey', '--allow-remote'],
    exec: revoked.exec,
    write: revoked.write,
    writeError: revoked.writeError,
    now: '2026-10-14T00:00:00.000Z',
  });
  assert.equal(revokeCode, 0);
  assert.equal(revoked.calls.every((call) => call.locationFlag === '--remote'), true);
  const revokeSql = revoked.calls.find((call) => call.sql.startsWith('UPDATE photo_access_codes'));
  assert.match(revokeSql.sql, /use_count = 0/);
  assert.match(revokeSql.sql, /revoked_at IS NULL/);
  const revokeLog = revoked.calls.find((call) => call.sql.startsWith('INSERT INTO photo_admin_log'));
  assert.match(revokeLog.sql, /revoke-all-codes/);
  assert.match(revoked.out.join('\n'), /revoked count=3/);
  assert.equal(revoked.out.join('\n').includes(HASH), false);

  const duplicate = capture();
  const inner = duplicate.exec;
  duplicate.exec = (database, sql, locationFlag) => {
    if (sql.startsWith('ALTER TABLE photo_admin_log')) {
      duplicate.calls.push({ database, sql, locationFlag });
      return { ok: false, error: 'duplicate column name: reason' };
    }
    return inner(database, sql, locationFlag);
  };
  const again = await runPhotoAdmin({
    argv: ['suspend', '--uid', 'user-1', '--operator', 'casey', '--reason', 'reviewed the account'],
    exec: duplicate.exec,
    write: duplicate.write,
    writeError: duplicate.writeError,
    now: '2026-10-14T00:00:00.000Z',
  });
  assert.equal(again, 0);
  assert.match(duplicate.out.join('\n'), /suspended uid=user-1/);
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
