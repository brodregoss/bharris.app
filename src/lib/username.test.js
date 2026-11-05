import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUsername, typedUsername } from './username.js';
import { USERNAME_ATTEMPT_LIMIT, claimUsername, releaseUsername, usernameFor } from '../../worker/src/usernames.js';

test('typing keeps only the characters a username can use', () => {
  assert.equal(typedUsername(' @Ada Lovelace! '), 'adalovelace');
});

test('a username is lowercase, letter-first, and not reserved', () => {
  assert.equal(parseUsername('  @Ada_Lovelace ').username, 'ada_lovelace');
  assert.equal(parseUsername('ab').error, 'Use at least 3 characters.');
  assert.equal(parseUsername('thisnameistoolongforus').error, 'Use 20 characters or fewer.');
  assert.equal(parseUsername('1ada').error, 'Start with a letter. Then use letters, numbers, and single underscores.');
  assert.equal(parseUsername('ada__lovelace').error, 'Start with a letter. Then use letters, numbers, and single underscores.');
  assert.equal(parseUsername('admin').error, 'Choose a different username.');
  assert.equal(parseUsername('ADMIN').error, 'Choose a different username.');
  assert.equal(parseUsername('ada lovelace').error, 'Start with a letter. Then use letters, numbers, and single underscores.');
});

function createApp() {
  const names = [];
  const attempts = [];

  function rejectDuplicate(username, uid) {
    if (names.some((row) => row.username === username)) {
      throw new Error('UNIQUE constraint failed: usernames.username');
    }
    if (names.some((row) => row.firebase_uid === uid)) {
      throw new Error('UNIQUE constraint failed: usernames.firebase_uid');
    }
  }

  function exec(sql, args) {
    const text = sql.replace(/\s+/g, ' ').trim();
    if (text.startsWith('CREATE')) return {};
    if (text.startsWith('SELECT COUNT(*) AS n FROM username_attempts')) {
      const [uid, since] = args;
      const n = attempts.filter((row) => row.firebase_uid === uid && row.attempted_at > since).length;
      return { first: { n } };
    }
    if (text.startsWith('SELECT username, created_at FROM usernames')) {
      return { first: names.find((row) => row.firebase_uid === args[0]) || null };
    }
    if (text.startsWith('SELECT username FROM usernames')) {
      const row = names.find((item) => item.firebase_uid === args[0]);
      return { first: row ? { username: row.username } : null };
    }
    if (text.startsWith('DELETE FROM username_attempts WHERE attempted_at')) {
      const since = args[0];
      for (let i = attempts.length - 1; i >= 0; i -= 1) {
        if (attempts[i].attempted_at <= since) attempts.splice(i, 1);
      }
      return {};
    }
    if (text.startsWith('DELETE FROM username_attempts WHERE firebase_uid')) {
      const uid = args[0];
      for (let i = attempts.length - 1; i >= 0; i -= 1) {
        if (attempts[i].firebase_uid === uid) attempts.splice(i, 1);
      }
      return {};
    }
    if (text.startsWith('INSERT INTO username_attempts')) {
      attempts.push({ firebase_uid: args[0], attempted_at: args[1] });
      return {};
    }
    if (text.startsWith('UPDATE usernames SET username')) {
      const [username, updated_at, firebase_uid] = args;
      if (names.some((row) => row.username === username && row.firebase_uid !== firebase_uid)) {
        throw new Error('UNIQUE constraint failed: usernames.username');
      }
      const row = names.find((item) => item.firebase_uid === firebase_uid);
      if (!row) return {};
      row.username = username;
      row.updated_at = updated_at;
      return {};
    }
    if (text.startsWith('DELETE FROM usernames')) {
      const uid = args[0];
      for (let i = names.length - 1; i >= 0; i -= 1) {
        if (names[i].firebase_uid === uid) names.splice(i, 1);
      }
      return {};
    }
    if (text.startsWith('INSERT INTO usernames')) {
      const [username, firebase_uid, created_at, updated_at] = args;
      rejectDuplicate(username, firebase_uid);
      names.push({ username, firebase_uid, created_at, updated_at });
      return {};
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  function statement(sql) {
    let args = [];
    const api = {
      bind(...bound) {
        args = bound;
        return api;
      },
      async first() {
        return exec(sql, args).first ?? null;
      },
      async run() {
        exec(sql, args);
        return { success: true };
      },
    };
    return api;
  }

  return {
    names,
    prepare: statement,
    async batch(statements) {
      const snapshot = names.map((row) => ({ ...row }));
      try {
        for (const entry of statements) await entry.run();
      } catch (err) {
        names.splice(0, names.length, ...snapshot);
        throw err;
      }
    },
  };
}

test('one account keeps a username and a second account cannot take it', async () => {
  const env = { APP: createApp() };
  const first = await claimUsername(env, 'uid-a', 'Ada');
  assert.equal(first.username, 'ada');
  const again = await claimUsername(env, 'uid-a', '@ada');
  assert.equal(again.username, 'ada');
  const taken = await claimUsername(env, 'uid-b', 'ada');
  assert.equal(taken.error.message, 'That username is taken.');
  assert.equal(await usernameFor(env, 'uid-a'), 'ada');
  assert.equal(await usernameFor(env, 'uid-b'), '');
});

test('a failed rename leaves the old username in place', async () => {
  const env = { APP: createApp() };
  await claimUsername(env, 'uid-a', 'alpha');
  await claimUsername(env, 'uid-b', 'beta');
  const blocked = await claimUsername(env, 'uid-a', 'beta');
  assert.equal(blocked.error.message, 'That username is taken.');
  assert.equal(await usernameFor(env, 'uid-a'), 'alpha');
  assert.equal(await usernameFor(env, 'uid-b'), 'beta');
  const renamed = await claimUsername(env, 'uid-a', 'gamma');
  assert.equal(renamed.username, 'gamma');
  assert.equal(await usernameFor(env, 'uid-a'), 'gamma');
  const freed = await claimUsername(env, 'uid-b', 'alpha');
  assert.equal(freed.username, 'alpha');
});

test('repeated claims stop for an hour', async () => {
  const env = { APP: createApp() };
  await claimUsername(env, 'owner', 'held');
  for (let i = 0; i < USERNAME_ATTEMPT_LIMIT; i += 1) {
    const result = await claimUsername(env, 'hunter', 'held');
    assert.equal(result.error.message, 'That username is taken.');
  }
  const limited = await claimUsername(env, 'hunter', 'freshname');
  assert.equal(limited.error.status, 429);
  assert.equal(await usernameFor(env, 'hunter'), '');
});

test('deleting an account frees the username', async () => {
  const env = { APP: createApp() };
  await claimUsername(env, 'uid-a', 'ada');
  await releaseUsername(env, 'uid-a');
  const next = await claimUsername(env, 'uid-b', 'ada');
  assert.equal(next.username, 'ada');
  assert.equal(await usernameFor(env, 'uid-a'), '');
});
