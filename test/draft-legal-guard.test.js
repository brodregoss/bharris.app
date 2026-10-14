import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoDraftLegal, findDraftMentions } from '../scripts/check-draft-legal.mjs';
import { PHOTO_TERMS_TEXT, PHOTO_UPLOAD_NOTICE } from '../src/lib/photoCopy.js';

const MARKER = 'DRAFT for lawyer review';

test('published legal text and the photo notice have no draft marker', () => {
  const legal = readFileSync(new URL('../src/lib/legal.js', import.meta.url), 'utf8');
  const hits = findDraftMentions([
    fileURLToPath(new URL('../src/lib/legal.js', import.meta.url)),
    fileURLToPath(new URL('../src/lib/photoCopy.js', import.meta.url)),
  ]);
  assert.equal(legal.includes(MARKER), false);
  assert.equal(hits.length, 0);
  assert.equal(PHOTO_UPLOAD_NOTICE.includes(MARKER), false);
  assert.match(PHOTO_TERMS_TEXT, /at least 18 years old/);
  assert.match(PHOTO_UPLOAD_NOTICE, /Google Cloud Vision/);
  assert.match(PHOTO_UPLOAD_NOTICE, /OpenAI/);
});

test('the lawyer folder is ignored and a published copy fails the guard', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'draft-legal-'));
  const drafts = path.join(root, 'docs', 'legal-drafts');
  const published = path.join(root, 'dist');
  mkdirSync(drafts, { recursive: true });
  mkdirSync(published, { recursive: true });
  writeFileSync(path.join(drafts, 'photo-processing.md'), `${MARKER}\nOpenAI and Google Cloud Vision.`);
  writeFileSync(path.join(published, 'app.js'), 'study notes');
  assert.deepEqual(findDraftMentions([root]), []);
  writeFileSync(path.join(published, 'app.js'), `hello ${MARKER}`);
  assert.deepEqual(findDraftMentions([root]), [path.join(published, 'app.js')]);
  assert.throws(() => assertNoDraftLegal([root], {}), /cannot ship/);
  assert.deepEqual(assertNoDraftLegal([root], { ALLOW_DRAFT_LEGAL: '1' }), []);
});

test('the lawyer drafts name both photo processors', () => {
  const draft = readFileSync(new URL('../docs/legal-drafts/photo-processing.md', import.meta.url), 'utf8');
  assert.match(draft, new RegExp(MARKER));
  assert.match(draft, /OpenAI/);
  assert.match(draft, /Google Cloud Vision/);
  assert.match(draft, /do not store the photos/i);
  assert.match(draft, /may retain those inputs under their own terms/i);
});
