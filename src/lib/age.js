export const MIN_AGE = 13;
export const ADULT_AGE = 18;
export const MAX_AGE = 120;

export const REFERRAL_OPTIONS = [
  { id: 'friend', label: 'A friend' },
  { id: 'school', label: 'School' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'search', label: 'Search' },
  { id: 'other', label: 'Somewhere else' },
];

export function normalizeReferral(value) {
  const id = String(value || '').trim().toLowerCase();
  return REFERRAL_OPTIONS.some((option) => option.id === id) ? id : '';
}

export function referralLabel(id) {
  return REFERRAL_OPTIONS.find((option) => option.id === id)?.label || id;
}

export function parseBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

export function completedYears(birth, now) {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

export function assessAge(birthDate, { guardianConsent = false, now = new Date() } = {}) {
  const raw = String(birthDate || '').trim();
  if (!raw) {
    return { ok: false, code: 'invalid', message: 'Enter your birthday.' };
  }
  const parsed = parseBirthDate(raw);
  if (!parsed) {
    return { ok: false, code: 'invalid', message: 'Enter a real birthday.' };
  }
  if (parsed.getTime() > now.getTime()) {
    return { ok: false, code: 'invalid', message: 'Enter a real birthday.' };
  }
  const age = completedYears(parsed, now);
  if (age > MAX_AGE) {
    return { ok: false, code: 'invalid', message: 'Enter a real birthday.' };
  }
  const iso = raw;
  if (age < MIN_AGE) {
    return {
      ok: false,
      code: 'under_13',
      age,
      message: 'bharris.app is not for anyone under 13.',
    };
  }
  if (age < ADULT_AGE && !guardianConsent) {
    return {
      ok: false,
      code: 'guardian',
      age,
      band: 'teen',
      iso,
      message: 'Ages 13–17 need a parent or guardian’s permission.',
    };
  }
  return {
    ok: true,
    code: 'ok',
    age,
    band: age < ADULT_AGE ? 'teen' : 'adult',
    iso,
    message: '',
  };
}

export function accountAge(row, now = new Date()) {
  if (!row?.birth_date) return { status: 'missing', band: '' };
  const decision = assessAge(row.birth_date, {
    guardianConsent: !!String(row.guardian_consent_at || '').trim(),
    now,
  });
  if (!decision.ok) return { status: 'missing', band: '' };
  return { status: 'ok', band: decision.band };
}

export function needsAge(user) {
  return user?.ageStatus === 'missing';
}

export function showsGuardianPrompt(birthDate, now = new Date()) {
  const decision = assessAge(birthDate, { guardianConsent: true, now });
  return !!(decision.ok && decision.band === 'teen');
}

export function signupBlockReason({ birthDate, guardianConsent } = {}, now = new Date()) {
  return assessAge(birthDate, { guardianConsent, now }).message;
}
