import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { moderateBytes, sha256Hex } from '../worker/src/moderation.js';

const folder = process.argv[2];
const types = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

if (!folder) {
  console.error('Usage: node scripts/moderate-samples.mjs <folder>');
  process.exit(1);
}

const missing = ['OPENAI_API_KEY', 'GOOGLE_VISION_API_KEY'].filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Set ${missing.join(' and ')} in the environment before running this.`);
  process.exit(1);
}

const names = (await readdir(folder)).filter((name) => types[extname(name).toLowerCase()]).sort();
if (!names.length) {
  console.error('No jpg, png, webp, or gif files in that folder.');
  process.exit(1);
}

const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY,
};

for (const name of names) {
  const bytes = new Uint8Array(await readFile(join(folder, name)));
  const contentType = types[extname(name).toLowerCase()];
  const imageHash = await sha256Hex(bytes);
  const decision = await moderateBytes(bytes, contentType, env);
  const providers = (decision.results || []).map((result) => ({
    provider: result.provider,
    ok: !!result.ok,
    severity: result.ok ? result.severity : 'error',
    categories: result.categories || [],
  }));
  console.log(JSON.stringify({
    file: name,
    sha256: imageHash,
    severity: decision.severity,
    block: decision.block,
    providers,
  }));
}
