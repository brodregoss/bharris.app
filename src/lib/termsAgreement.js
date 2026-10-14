const TERMS_KEY = 'bharris.termsAccepted';

export function hasAcceptedTerms() {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem(TERMS_KEY);
  } catch {
    return false;
  }
}

export function rememberTermsAccepted() {
  if (typeof window === 'undefined') return;
  try {
    if (!localStorage.getItem(TERMS_KEY)) localStorage.setItem(TERMS_KEY, new Date().toISOString());
  } catch {
    // The account record still keeps the acceptance.
  }
}

export function forgetTermsAccepted() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TERMS_KEY);
  } catch {
    // Unchecking still blocks the button on this screen.
  }
}

// Ask only when this account has been checked and has never agreed.
// A missing flag means we do not know yet, so the screen stays clear.
export function shouldAskForTerms({ termsAccepted, deviceAccepted = false } = {}) {
  if (deviceAccepted || termsAccepted === true) return false;
  return termsAccepted === false;
}
