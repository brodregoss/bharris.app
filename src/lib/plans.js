export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    quota: 5,
    blurb: 'Enough AI to get one real cram done.',
    features: [
      'Photo notes → terms and definitions',
      'Triage, recall, and a practice test',
      '10 past sessions saved',
      '5 AI calls each month',
    ],
    sessionLimit: 10,
  },
  pro: {
    id: 'pro',
    name: 'Study Pro',
    quota: 30,
    blurb: 'Keep going when the night gets long.',
    monthlyPrice: '$4.99',
    yearlyPrice: '$39.99',
    yearlyNote: 'About 2 months free',
    features: [
      'Everything in Free',
      '30 AI calls each month',
      '30 past sessions saved',
      'Extract, grade, explain, and panic notes',
      'Restore on any iPhone with this Apple ID',
    ],
    sessionLimit: 30,
  },
};

export function planForUser(user) {
  return user?.subscriptionTier === 'pro' ? PLANS.pro : PLANS.free;
}

export function planLabel(user) {
  return planForUser(user).name;
}

export function sessionLimitForUser(user) {
  return planForUser(user).sessionLimit;
}
