export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    quota: 5,
    blurb: 'Enough AI to get one real cram done.',
    features: [
      'Photo notes, triage, and a practice test',
      '5 AI calls a month',
      '10 past sessions saved',
    ],
    sessionLimit: 10,
  },
  study: {
    id: 'solo',
    name: 'Study',
    quota: 30,
    blurb: 'The full cram, on this account.',
    monthlyPrice: '$8',
    features: [
      'Photo, typed, or sample notes',
      'Triage, True Cram, Spaced Cram, and Independent study',
      '30 AI calls a month',
      'The last 30 sessions saved',
    ],
    sessionLimit: 30,
  },
  partner: {
    id: 'partner',
    name: 'Partner study',
    quota: 30,
    blurb: 'Study for you and one friend.',
    monthlyPrice: '$12',
    features: [
      'Everything in Study',
      'One private code for a friend',
      'Reset the code if it leaks',
      'When the plan ends, you both lose paid access',
    ],
    sessionLimit: 30,
  },
};

export function planForUser(user) {
  if (user?.billingPlan === 'partner' || user?.billingPlan === 'guest') return PLANS.partner;
  if (user?.billingPlan === 'solo' || user?.subscriptionTier === 'pro') return PLANS.study;
  return PLANS.free;
}

export function planLabel(user) {
  return planForUser(user).name;
}

export function planValue(user) {
  const plan = planForUser(user);
  if ((user?.billingPlan !== 'solo' && user?.billingPlan !== 'partner') || !plan.monthlyPrice) {
    return plan.name;
  }
  return `${plan.name} · ${plan.monthlyPrice}/mo`;
}

export function sessionLimitForUser(user) {
  return planForUser(user).sessionLimit;
}
