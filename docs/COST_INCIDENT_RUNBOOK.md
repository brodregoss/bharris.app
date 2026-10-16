# Cost incident runbook

Use this when photo usage is far above normal, a provider bill jumps, or a key may have leaked. These steps do not deploy the app and they do not delete account data.

Every command stays on the local database unless you add `--allow-remote`. That flag uses the databases named in `worker/wrangler.jsonc`.

Do not put a key, an access code, or an image in this file, in chat, or in a log. Counts are UTC.

## 1. Turn photo import off

In the Cloudflare dashboard: Workers & Pages → **bharris** → Settings → Variables and Secrets → set `PHOTO_FEATURE_ENABLED` to `false`.

The next photo request is refused with "Photo import isn't available in this version of the app. Notes scanning is not set up."

## 2. Check provider billing

Open the OpenAI usage page and the Google Cloud billing page for the Vision API project. Note the request counts and the time window.

## 3. Disable the Vision API or its key

In Google Cloud, disable the Cloud Vision API or delete the key stored as `GOOGLE_VISION_API_KEY`. Photo checks call that API once per image.

## 4. Identify accounts

```bash
node scripts/photo-admin.mjs usage --allow-remote
node scripts/photo-admin.mjs list --allow-remote
node scripts/photo-admin.mjs flags --allow-remote
```

`usage` prints today's and this month's check and vision counts against each cap, then each account's count for today. `list` prints code hashes, not codes. `flags` prints moderation events.

Suspend an account that should stop. The account row and the notes stay. The command writes the time, your name, the action, the account id, and the reason to `photo_admin_log`.

```bash
node scripts/photo-admin.mjs suspend --uid <account id> --operator <your name> --reason <short note> --allow-remote
```

## 5. Compare provider counts to our counters

Compare the provider's request count for the same UTC day or month with `usage`.

- Google Cloud Vision requests line up with the `check` counter. One check is one image.
- OpenAI moderation requests line up with the `check` counter.
- OpenAI study-model requests that include an image line up with the `vision` counter. A second extract pass counts as another vision call.

A provider count above our counter means that key was used outside this app.

## 6. Rotate secrets

In the Cloudflare dashboard for **bharris**, replace `OPENAI_API_KEY`, `GOOGLE_VISION_API_KEY`, and `PHOTO_CODE_SECRET`. The code secret has to be at least 32 characters. Replacing `PHOTO_CODE_SECRET` invalidates existing access codes, because the stored hash uses it.

## 7. Turn photo import back on for your account first

Leave your account unsuspended. Suspend every other account that `usage` or `list` shows for photo import.

Revoke every unused code:

```bash
node scripts/photo-admin.mjs revoke-all-codes --operator <your name> --allow-remote
```

Set `PHOTO_FEATURE_ENABLED` back to the exact string `true` in the Worker settings. Send one photo from your own account. When that succeeds, generate a new code for anyone else.
