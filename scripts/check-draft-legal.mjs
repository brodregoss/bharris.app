import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DRAFT_LEGAL_MARKER = 'DRAFT for lawyer review';

const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.jsx', '.html', '.css', '.json', '.txt', '.svg', '.md']);

export function isLawyerDraftPath(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  return normalized.includes('docs/legal-drafts');
}

function walk(entry, found) {
  if (isLawyerDraftPath(entry)) return;
  let info;
  try {
    info = statSync(entry);
  } catch {
    return;
  }
  if (info.isDirectory()) {
    for (const name of readdirSync(entry)) walk(path.join(entry, name), found);
    return;
  }
  if (!TEXT_EXTENSIONS.has(path.extname(entry))) return;
  const text = readFileSync(entry, 'utf8');
  if (text.includes(DRAFT_LEGAL_MARKER)) found.push(entry);
}

export function findDraftMentions(paths) {
  const found = [];
  for (const entry of paths) walk(entry, found);
  return found;
}

export function assertNoDraftLegal(paths, env = process.env) {
  if (env.ALLOW_DRAFT_LEGAL === '1') return [];
  const hits = findDraftMentions(paths);
  if (!hits.length) return [];
  const error = new Error(`Draft legal text cannot ship:\n${hits.join('\n')}`);
  error.hits = hits;
  throw error;
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error('Usage: node scripts/check-draft-legal.mjs <file-or-directory> ...');
    process.exit(2);
  }
  try {
    assertNoDraftLegal(paths);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
