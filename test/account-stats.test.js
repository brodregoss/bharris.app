import test from 'node:test';
import assert from 'node:assert/strict';
import { countAccounts, touchLastSeen } from '../worker/src/users.js';
import { handleAccountStats } from '../worker/src/accountStats.js';
import { signDevToken } from '../worker/src/notesScanLock.js';

const SECRET = 'token-secret-with-at-least-32-characters';
const DAY = 24 * 60 * 60 * 1000;

function memoryDb(rows = []) {
  const table = rows.map((row) => ({ ...row }));
  const queries = [];
  const columns = new Set([
    'firebase_uid', 'email', 'display_name', 'created_at', 'updated_at',
    'do_store_name', 'do_store_id', 'do_status', 'subscription_tier',
    'ai_quota_used', 'ai_quota_limit', 'ai_quota_period', 'revenuecat_app_user_id',
    'billing_plan', 'partner_owner_uid', 'stripe_customer_id', 'stripe_subscription_id',
    'billing_notice', 'stripe_status', 'stripe_trial_end', 'stripe_period_end',
    'stripe_cancel_at_period_end', 'stripe_promo', 'billing_checked_at', 'last_seen_at',
  ]);
  return {
    rows: table,
    queries,
    prepare(sql) {
      queries.push(sql);
      const stmt = {
        binds: [],
        bind(...args) {
          stmt.binds = args;
          return stmt;
        },
        async run() {
          const added = sql.match(/ADD COLUMN (\w+)/);
          if (added) columns.add(added[1]);
          if (sql.includes('UPDATE users SET last_seen_at')) {
            const [stamp, uid] = stmt.binds;
            const row = table.find((item) => item.firebase_uid === uid);
            if (row) row.last_seen_at = stamp;
          }
        },
        async all() {
          if (sql.includes('PRAGMA')) {
            return { results: [...columns].map((name) => ({ name })) };
          }
          return { results: [] };
        },
        async first() {
          if (sql.includes('COUNT(*) AS n FROM shard_ranges')) return { n: 1 };
          if (sql.includes('bucket_overrides')) return { shard_binding: 'USER_00' };
          if (sql.includes('FROM admins')) return null;
          if (!sql.includes('COUNT(*) AS total')) return null;
          const since = stmt.binds[0];
          let total = 0;
          let active = 0;
          for (const row of table) {
            total += 1;
            const seen = row.last_seen_at || row.updated_at || '';
            if (seen >= since) active += 1;
          }
          return { total, active };
        },
      };
      return stmt;
    },
  };
}

function envWith(shards) {
  return {
    APP: memoryDb(),
    NOTES_SCAN_TOKEN_SECRET: SECRET,
    ...shards,
  };
}

test('account counts add every shard and treat a recent open as active', async () => {
  const now = Date.parse('2026-10-08T12:00:00.000Z');
  const recent = new Date(now - 2 * DAY).toISOString();
  const stale = new Date(now - 30 * DAY).toISOString();
  const env = envWith({
    USER_00: memoryDb([
      { firebase_uid: 'a', updated_at: stale, last_seen_at: recent },
      { firebase_uid: 'b', updated_at: recent, last_seen_at: null },
    ]),
    USER_01: memoryDb([
      { firebase_uid: 'c', updated_at: stale, last_seen_at: stale },
    ]),
  });

  const counts = await countAccounts(env, now);
  assert.ok(env.USER_00.queries.some((sql) => sql.includes('COALESCE(last_seen_at, updated_at)')));
  assert.equal(counts.total, 3);
  assert.equal(counts.active, 2);
  assert.equal(counts.activeDays, 7);
});

test('last opened is saved once an hour', async () => {
  const now = Date.parse('2026-10-08T12:00:00.000Z');
  const db = memoryDb([{ firebase_uid: 'a', updated_at: '2026-01-01T00:00:00.000Z', last_seen_at: null }]);
  const env = envWith({ USER_00: db });
  const first = await touchLastSeen(env, db.rows[0], now);
  assert.equal(first.last_seen_at, new Date(now).toISOString());
  db.rows[0].last_seen_at = 'changed';
  const second = await touchLastSeen(env, first, now + 30 * 60 * 1000);
  assert.equal(second.last_seen_at, first.last_seen_at);
  const third = await touchLastSeen(env, first, now + 2 * 60 * 60 * 1000);
  assert.equal(third.last_seen_at, new Date(now + 2 * 60 * 60 * 1000).toISOString());
});

test('account counts stay behind the dev code', async () => {
  const env = envWith({ USER_00: memoryDb([]) });
  const identity = { uid: 'person', email: 'person@example.com' };
  const denied = await handleAccountStats(
    new Request('https://app.test/v1/dev-tools/stats'),
    env,
    identity,
  );
  assert.equal(denied.status, 403);

  const token = await signDevToken(SECRET, identity.uid, Date.now() + 60_000);
  const allowed = await handleAccountStats(
    new Request('https://app.test/v1/dev-tools/stats', {
      headers: { 'X-Dev-Tools-Token': token },
    }),
    env,
    identity,
  );
  assert.equal(allowed.status, 200);
  const body = await allowed.json();
  assert.deepEqual(body, { total: 0, active: 0, activeDays: 7 });
});
