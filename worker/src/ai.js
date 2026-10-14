import { errorJson, json, publicErrorMessage, readJson } from './util.js';
import { assertQuota, incrementQuota } from './quota.js';
import { toPublicUser } from './users.js';
import { runLlm } from './llm.js';
import { denyPhoto } from './photoAccess.js';
import { enforceImageModeration } from './moderation.js';
import { collectImages, inspectImagePayload, reserveExtract } from './imageGuard.js';

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
  const images = collectImages(body);
  if (feature === 'extract' || images.length) {
    const denied = await denyPhoto(env, identity);
    if (denied) return denied;
  }
  if (images.length) {
    const inspected = inspectImagePayload(body);
    if (!inspected.ok) return errorJson(inspected.message, inspected.status);
    try {
      const rate = await reserveExtract(env, identity.uid);
      if (!rate.allowed) {
        return errorJson('Too many photo reads right now. Try again in a little while.', 429);
      }
    } catch {
      return errorJson('Try again in a moment.', 503);
    }
    for (const image of inspected.images) {
      const moderated = await enforceImageModeration(env, identity, image);
      if (moderated) return moderated;
    }
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
    return errorJson(publicErrorMessage(err, 'Study AI failed'), 502);
  }
}
