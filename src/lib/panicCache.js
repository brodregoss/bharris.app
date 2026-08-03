const KEY = 'lms_panic_summary_v1';

// Signature captures identity + learning state for Critical/Core terms.
// When any of these change (new terms, confidence shifts, recall updates,
// test results), the signature changes → triggers a regenerate prompt.
export function panicSignature(terms) {
  return terms
    .filter((t) => t.tier === 'critical' || t.tier === 'core')
    .map((t) =>
      [t.id, t.tier, t.confidence, t.correctStreak || 0, t.testResult,
        (t.recallHistory || []).map((h) => h.result).join('')].join('|')
    )
    .join(';;');
}

export function loadPanicSummary() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw); // { signature, text, generatedAt }
  } catch {
    return null;
  }
}

export function savePanicSummary(signature, text) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ signature, text, generatedAt: Date.now() }));
  } catch {
    // ignore
  }
}