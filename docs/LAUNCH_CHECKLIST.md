# Launch checklist

Do this before `PHOTO_FEATURE_ENABLED` is turned on for anyone. The worker in this repo ships that value as `false`. Leave it that way until every box below is checked.

## Worker secrets

Set these in the Worker settings, not in the repo:

- [ ] `OPENAI_API_KEY`
- [ ] `GOOGLE_VISION_API_KEY`
- [ ] `PHOTO_CODE_SECRET` (at least 32 characters)

`SUPPORT_EMAIL` is optional. Leave it empty until the address is real. The suspension message omits an address when it is empty.

## Sample images

- [ ] `node scripts/moderate-samples.mjs <folder>` was run with both keys set, and the printed severities match the rules in `docs/MODERATION_TUNING.md`. The script prints the file name, hash, severity, and provider. It does not print image bytes.

## Provider retention and terms

- [ ] OpenAI retention was reviewed. `store: false` only keeps the completion out of stored-completion history. Confirm zero data retention, or accept the remaining abuse-monitoring retention, in the OpenAI account.
- [ ] Google Cloud Vision retention and terms were reviewed. The provider may keep inputs under its own terms.

## Legal

- [ ] `src/lib/legal.js` names OpenAI (reading notes) and Google Cloud Vision (checking photos), says we do not store the photos, and says the providers may retain inputs under their own terms.
- [ ] A lawyer reviewed that privacy policy and the terms.
- [ ] `docs/legal-drafts/` was compared with the published pages and is not what ships. The deploy guard rejects the draft marker in the built site.

## App update

- [ ] An App Store build that includes the new Welcome screen is released. While the feature is off, that screen shows "Type your notes" and no photo upload. While it is on, photo import asks for the access code and the 18+ box.
- [ ] Older installed builds were checked against the kill switch. They stop with "Photo import isn't available in this version of the app. Notes scanning is not set up."

## Minors detection

- [ ] The OpenAI minors category still does not score images. Either a provider that scores that category for photos is wired, or the gap is accepted in writing before anyone can upload.

## Kill-switch rehearsal

- [ ] With the feature off, a photo upload and a photo read both return the sentence above and do not call OpenAI or Cloud Vision.
- [ ] Turning the feature on in a local worker, then back off, returns that sentence again.
- [ ] A missing or short `PHOTO_CODE_SECRET`, while the feature is on, still returns "Photo import is temporarily unavailable." and does not use a code.

## Turn photo import on

In the Cloudflare dashboard: Workers & Pages → **bharris** → Settings → Variables and Secrets → edit `PHOTO_FEATURE_ENABLED` to the exact string `true`, then deploy that version.

Only the string `true` enables it. `TRUE`, `false`, and an empty value leave it off.

## Turn photo import off

Set the same variable to `false` and deploy that version. The next photo request is refused. Existing accounts can still study.

A deploy from this repo writes `PHOTO_FEATURE_ENABLED` back to `false`, because that is the value in `worker/wrangler.jsonc`. Turning the feature on from the dashboard does not survive that deploy unless the value in the file is changed first.
