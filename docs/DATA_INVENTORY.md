# Data inventory

Signup and sign-in are open. An existing account is not asked to accept a new set of terms, and it is not asked for an invite code.

Photo import is a separate gate. The server reports it with `photoFeatureEnabled` on the account status. While `PHOTO_FEATURE_ENABLED` is not the string `true`, the app shows no photo screen. The kill switch, moderation, and strike rules still apply on the server.

## Photos

A photo starts in memory on the device. The app sends it to our server only after the person has redeemed a photo access code and checked the 18+ confirmation. The server does not store the photo. It sends the same photo to two processors:

- Google Cloud Vision checks the photo for prohibited content.
- OpenAI reads the notes.

We do not keep the photo after that request. Google Cloud Vision and OpenAI may retain inputs under their own terms. We do not control that retention. Deleting an account does not delete a copy a provider has already kept.

Study requests to OpenAI set `store: false` on Chat Completions. That keeps the completion out of OpenAI's stored-completion history. It does not turn off OpenAI's separate abuse-monitoring retention. Zero data retention has to be confirmed in the OpenAI account settings.

The text read from a photo (title, transcript, and terms) can be saved with the note. The photo itself is not.

The live privacy policy in `src/lib/legal.js` does not yet name OpenAI and Google Cloud Vision as the processors that receive photos. Review and update that policy before photo import is enabled for anyone. The wording prepared for that review is in `docs/legal-drafts/`. It is not published.

## What this app stores

- Account record: user id, email, display name, plan, and quota fields.
- The existing terms acceptance timestamp, for people who agreed when they created an account.
- Photo-terms acceptance, only after a successful code redemption with the box checked: user id, time, and photo-terms version. Checking the box is not stored if the code is not accepted. A missing box does not use up the code.
- Notes: title, transcript, and terms. Not the photo.
- Photo access codes as HMAC-SHA256 hashes only. The code itself is not stored and is not written to logs.
- Moderation events: user id, time, provider, categories, severity, and a SHA-256 of the image bytes. Not the image.
- Photo admin log: time, operator name, action, and user id. Written when an account is unsuspended, when an account is suspended, and when unused access codes are revoked. A suspension also stores the operator's reason. Not a code and not an image.
- Photo usage counters: kind (`check` or `vision`), a UTC day bucket, a UTC month bucket, or an account id with a UTC day, and a count. Not the image.
- Photo usage alert markers: kind, bucket, threshold (`80` or `100`), and time. These global alerts do not store an account id.
- Strike count and suspension flag on the account. Suspension does not delete the account. Unsuspend sets the strike count back to 0.

## What this app does not store

- Photo bytes.
- The photo access code. The generate command prints it once, then only the hash remains.
- Image bytes, note text, email addresses, or access codes in moderation logs, alert webhooks, worker error responses, or worker logs. A moderation alert names the account id. A usage alert is a Slack text message with the counts and the time only.

The current Worker configuration does not bind a photo-storage bucket. Older delete functions still remove objects for an account if a bucket is bound later. This inventory does not delete anything that already exists.
