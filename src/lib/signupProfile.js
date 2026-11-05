const KEY = 'lms_signup_profile';
const USERNAME_PROMPT_KEY = 'lms_username_prompt';
const SOCIAL_KEY = 'lms_social_signup';

export function markUsernamePrompt() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(USERNAME_PROMPT_KEY, '1');
}

export function usernamePromptPending() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(USERNAME_PROMPT_KEY) === '1';
}

export function clearUsernamePrompt() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(USERNAME_PROMPT_KEY);
}

export function stageSignupProfile(profile) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify({
    birthDate: String(profile?.birthDate || ''),
    guardianConsent: !!profile?.guardianConsent,
    referral: String(profile?.referral || ''),
    username: String(profile?.username || ''),
  }));
}

export function readSignupProfile() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!parsed?.birthDate) return null;
    return {
      birthDate: String(parsed.birthDate),
      guardianConsent: !!parsed.guardianConsent,
      referral: String(parsed.referral || ''),
      username: String(parsed.username || ''),
    };
  } catch {
    return null;
  }
}

export function clearSignupProfile() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
}

function socialSignupPending() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(SOCIAL_KEY) === '1';
}

function clearSocialSignup() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SOCIAL_KEY);
}

export function beginSocialSignup() {
  clearSignupProfile();
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SOCIAL_KEY, '1');
}

export function cancelSocialSignup() {
  clearSocialSignup();
  clearUsernamePrompt();
}

export function settleSocialSignup(user) {
  if (!socialSignupPending()) return;
  clearSocialSignup();
  if (String(user?.username || '').trim()) clearUsernamePrompt();
  else markUsernamePrompt();
}
