OpenAI's sexual/minors category does not score images, so the minors-severe rule is not currently effective for photos.

Severity lives in `config/moderation.json`. Change a number there and deploy the worker before it takes effect. Do not tune this by editing a live request.

## What blocks a photo

Severe, which suspends the account and does not delete it:

- Any minors signal a provider actually returns.
- OpenAI `sexual` at or above `0.90`.
- Google Cloud Vision SafeSearch `adult` at `VERY_LIKELY`.

Mild, which rejects the photo and adds one strike:

- Other OpenAI categories in the mild list, below the severe line.
- SafeSearch `adult` at `LIKELY`.
- SafeSearch `racy` at `VERY_LIKELY`.
- SafeSearch `violence` at `VERY_LIKELY`.

SafeSearch `violence` at `LIKELY` is recorded and does not strike. SafeSearch `medical` and `spoof` are ignored at every level. `racy` and `medical` at `POSSIBLE` or below are ignored.

The highest severity across providers wins. A severe result still suspends the account if another provider timed out. If a provider fails and nothing else is mild or severe, the photo is blocked and no strike is added. A provider timeout is not a strike.

PhotoDNA and Hive are off. Turning either one on without a real client fails closed. Turning both OpenAI and SafeSearch off also fails closed.

## Strikes and alerts

`strike_limit` is 5. The next photo is then refused until someone unsuspends the account, which also sets the strike count back to 0. See `docs/INCIDENT_PROCEDURE.md`.

The alert is a Slack message, `{"text":"..."}`, with the account id, categories, severity, and time. It does not receive the image, the hash, the provider name, the note text, or an email address. An alert failure does not change the block.

The moderation log stores the same kind of row: account id, time, provider, categories, severity, and a SHA-256 of the image bytes.

## How many photos

`extract.max_images` is 2. `extract.max_image_chars` is 5000000. `extract.max_per_window` is 60 requests per `extract.window_ms` (one hour). Definitions do not count toward that window.
