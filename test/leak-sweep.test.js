import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('worker and local server source do not log request bodies', () => {
  const files = [
    ...sourceFiles(path.join(root, 'worker', 'src')),
    ...sourceFiles(path.join(root, 'server')),
  ];
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (/console\.(log|info|debug|warn|error)\s*\(/.test(text)) hits.push(path.relative(root, file));
  }
  assert.deepEqual(hits, []);
});

test('stored moderation rows and access codes have no image, note text, or raw code column', () => {
  const moderation = readFileSync(path.join(root, 'worker', 'src', 'moderation.js'), 'utf8');
  const access = readFileSync(path.join(root, 'worker', 'src', 'photoAccess.js'), 'utf8');
  assert.match(moderation, /firebase_uid, created_at, provider, categories, severity, image_sha256/);
  assert.equal(/image_bytes|data_url|note_text|prompt/.test(moderation.slice(moderation.indexOf('INSERT INTO moderation_events'))), false);
  assert.match(access, /CREATE TABLE IF NOT EXISTS photo_access_codes/);
  assert.equal(access.includes('code TEXT'), false);
  const webhook = moderation.slice(
    moderation.indexOf('export function moderationAlertText'),
    moderation.indexOf('async function sendAlert'),
  );
  for (const key of ['image', 'hash', 'prompt', 'code', 'email']) {
    assert.equal(webhook.includes(`${key}:`), false);
  }
  const slack = readFileSync(path.join(root, 'worker', 'src', 'slackAlert.js'), 'utf8');
  const bodyFn = slack.slice(slack.indexOf('export function slackAlertBody'), slack.indexOf('export async function postSlackAlert'));
  assert.match(bodyFn, /return \{ text:/);
  for (const key of ['image', 'hash', 'prompt', 'code', 'email', 'content']) {
    assert.equal(bodyFn.includes(`${key}:`), false);
  }
});
