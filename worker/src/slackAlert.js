// Slack incoming webhooks show the text field of an application/json POST.

export function slackAlertBody(text) {
  return { text: String(text ?? '') };
}

export async function postSlackAlert(env, text, fetchImpl = fetch, timeoutMs = 5000) {
  const url = String(env?.MODERATION_ALERT_WEBHOOK || '').trim();
  if (!url) return;
  try {
    await (fetchImpl || fetch)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackAlertBody(text)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // A failed alert does not change the request. The URL and body are never logged.
  }
}
