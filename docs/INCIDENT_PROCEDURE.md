# Incident procedure

Use this when a photo is flagged, an account is suspended, or an access code has to be pulled. These commands do not deploy the app and they do not delete account data.

Every command stays on the local database unless you add `--allow-remote`. That flag uses the databases named in `worker/wrangler.jsonc`. Do not add it unless you mean to.

Set `PHOTO_CODE_SECRET` in the environment before generating a code. Do not put the secret, a code, or an image in this file, in chat, or in a log.

## Stop photo import

Set `PHOTO_FEATURE_ENABLED` to `false` in the Worker settings. The next photo request is refused with "Photo import isn't available in this version of the app. Notes scanning is not set up." A later deploy of this repo also sets that value to `false`. A missing code secret, while the feature is still on, keeps the separate message "Photo import is temporarily unavailable."

## Access codes

Generate one code. It is printed once. The database stores only the hash.

```bash
node scripts/photo-admin.mjs generate
```

List hashes, use counts, expiry, and revocation. This does not print a code.

```bash
node scripts/photo-admin.mjs list
```

Revoke by the hash from that list.

```bash
node scripts/photo-admin.mjs revoke --hash <64 hex chars>
```

## Suspension

A severe flag suspends the account and leaves notes, terms, and the account row in place. Unsuspend clears the suspension and sets the photo strike count back to 0. Pass the account id and your name. The command writes the time, your name, the action, and the account id to `photo_admin_log`. It does not write a code or an image.

```bash
node scripts/photo-admin.mjs unsuspend --uid <account id> --operator <your name>
```

## Flags

List moderation events. Each line has the account id, time, provider, categories, severity, and the SHA-256 of the image. There is no image to open.

```bash
node scripts/photo-admin.mjs flags --uid <account id>
```

## What to tell the person

A rejected photo already showed: "This image can't be processed. Try retaking or cropping it."

A suspension shows: "This account is suspended." Add `SUPPORT_EMAIL` in the Worker settings if that message should include an address. Leave it empty until the address is real.

Do not send the person the image, the hash, or the access code.
