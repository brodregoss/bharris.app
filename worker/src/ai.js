import { errorJson, json, readJson } from './util.js';
import { assertQuota, incrementQuota } from './quota.js';
import { toPublicUser } from './users.js';
import { runLlm } from './llm.js';
import { denyPhoto } from './photoAccess.js';
import { enforceImageModeration } from './moderation.js';

const FEATURES = new Set([
  'extract',
  'definitions',
  'triage',
  'grade',
  'explain',
  'panic',
  'distractors',
  'complete',
]);

export async function handleAi(request, env, identity, featureFromPath) {
  const body = await readJson(request);
  const feature = FEATURES.has(featureFromPath)
    ? featureFromPath
    : FEATURES.has(body.feature)
      ? body.feature
      : 'complete';
  if (feature === 'extract' || body.image) {
    const denied = await denyPhoto(env, identity);
    if (denied) return denied;
  }
  if (body.image) {
    const moderated = await enforceImageModeration(env, identity, body.image);
    if (moderated) return moderated;
  }
  const consumed = await assertQuota(env, identity.uid);
  if (consumed.error) return consumed.error;

  try {
    const result = await runLlm(env, {
      prompt: body.prompt,
      response_json_schema: body.response_json_schema,
      image: body.image,
    });
    const row = await incrementQuota(env, identity.uid, consumed.row);
    return json({
      result,
      feature,
      account: await toPublicUser(env, row),
    });
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : 'Study AI failed', 502);
  }
}
