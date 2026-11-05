import { errorJson, json, readJson } from './util.js';
import { assertQuota, incrementQuota } from './quota.js';
import { getUserRow, toPublicUser } from './users.js';
import { runLlm } from './llm.js';
import { requireScanToken } from './notesScanLock.js';
import { recordTokenUsage } from './events.js';
import { accountAge } from '../../src/lib/age.js';

const FEATURES = new Set([
  'extract',
  'definitions',
  'triage',
  'grade',
  'explain',
  'panic',
  'distractors',
  'practice',
  'complete',
]);

export async function handleAi(request, env, identity, featureFromPath) {
  const body = await readJson(request);
  const feature = FEATURES.has(featureFromPath)
    ? featureFromPath
    : FEATURES.has(body.feature)
      ? body.feature
      : 'complete';
  if (body.image) {
    const denied = await requireScanToken(request, env, identity);
    if (denied) return denied;
  }
  const existing = await getUserRow(env, identity.uid);
  if (!existing) return errorJson('Account not found', 404);
  if (accountAge(existing).status !== 'ok') {
    return errorJson('Add your birthday before using study AI.', 403);
  }
  const consumed = await assertQuota(env, identity.uid, feature);
  if (consumed.error) return consumed.error;

  try {
    const llm = await runLlm(env, {
      prompt: body.prompt,
      response_json_schema: body.response_json_schema,
      image: body.image,
    });
    await recordTokenUsage(env, {
      uid: identity.uid,
      feature,
      model: llm.model,
      usage: llm.usage,
    });
    const row = await incrementQuota(env, identity.uid, consumed.row);
    return json({
      result: llm.result,
      feature,
      account: await toPublicUser(env, row),
    });
  } catch (err) {
    if (err?.usage) {
      await recordTokenUsage(env, {
        uid: identity.uid,
        feature,
        model: err.model,
        usage: err.usage,
      });
    }
    return errorJson(err instanceof Error ? err.message : 'Study AI failed', 502);
  }
}
