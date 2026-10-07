function planTitle(user) {
  if (user?.billingPlan === 'partner' || user?.billingPlan === 'guest') return 'Partner study';
  if (user?.billingPlan === 'solo' || user?.subscriptionTier === 'pro') return 'Study';
  return 'Free';
}

function formatWhen(iso) {
  const date = new Date(iso || '');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function trialRemainingLabel(iso, now = Date.now()) {
  const end = new Date(iso || '');
  if (Number.isNaN(end.getTime())) return 'Your free trial is active.';
  const ms = end.getTime() - new Date(now).getTime();
  if (ms <= 0) return 'Your free trial has ended.';
  const days = Math.ceil(ms / 86400000);
  if (days <= 1) return '1 day left on your free trial.';
  return `${days} days left on your free trial.`;
}

export function ownsWebsitePlan(user) {
  return user?.billingPlan === 'solo' || user?.billingPlan === 'partner';
}

export function planPriceLabel(user) {
  if (user?.billingPlan === 'partner') return '$12 / month';
  if (user?.billingPlan === 'solo') return '$8 / month';
  return '';
}

export function canCancelWebsitePlan(user) {
  const plan = user?.billingPlan || '';
  if (plan !== 'solo' && plan !== 'partner') return false;
  if (user.billingPromo === 'beta') return true;
  if (user.cancelAtPeriodEnd) return false;
  const status = user.subscriptionStatus || '';
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

export function cancelPlanNote(user) {
  if (!user?.cancelAtPeriodEnd) return '';
  const plan = user.billingPlan || '';
  if (plan !== 'solo' && plan !== 'partner') return '';
  const when = formatWhen(user.periodEndsAt);
  const until = when ? ` until ${when}` : '';
  const friend = plan === 'partner' ? ' Your friend loses access then.' : '';
  return `Canceled. You won't be billed again${until}.${friend}`;
}

export function cancelPlanConfirm(user) {
  return cancelPlanQuestion(user).replace(/^Cancel [^?]+\?\s*/, '');
}

export function cancelPlanQuestion(user) {
  const name = planTitle(user);
  if (user?.billingPromo === 'beta') {
    const friend = user.billingPlan === 'partner' ? ' Your friend loses access now.' : '';
    return `Cancel ${name}? Your free week ends now.${friend}`;
  }
  const friend = user?.billingPlan === 'partner'
    ? ' Your friend loses access when this period ends.'
    : '';
  return `Cancel ${name}? You won't be billed again.${friend}`;
}

export function managePlanLines(user, now = Date.now()) {
  if (!user) return [];
  const plan = user.billingPlan || '';
  if (!plan && user.subscriptionTier === 'pro') {
    return ['This plan is not billed on the website. Cancel it from the Apple ID that bought it.'];
  }
  if (plan === 'guest') {
    return ['Your friend pays for Partner study. If they cancel, you both lose access.'];
  }
  if (plan !== 'solo' && plan !== 'partner') {
    return [user.billingNotice === 'beta_ended' ? 'Your free week ended.' : 'You are on the free plan.'];
  }

  const lines = [];
  const trialing = user.subscriptionStatus === 'trialing' && !!user.trialEndsAt;
  const beta = user.billingPromo === 'beta';
  if (trialing) lines.push(trialRemainingLabel(user.trialEndsAt, now));
  if (beta) {
    lines.push("You won't be charged for this free week.");
    if (plan === 'partner') lines.push('This is a free week for you and your friend.');
  } else if (trialing && user.periodEndsAt) {
    const when = formatWhen(user.periodEndsAt);
    if (when) lines.push(`You'll be billed on ${when}.`);
  } else if (!user.cancelAtPeriodEnd && user.periodEndsAt) {
    const when = formatWhen(user.periodEndsAt);
    if (when) lines.push(`Next billing date: ${when}.`);
  }
  if (plan === 'partner' && !beta) {
    lines.push('Your friend loses access when this plan ends.');
  }
  if (user.cancelAtPeriodEnd) {
    const note = cancelPlanNote(user);
    if (note) lines.push(note);
  }
  return lines.filter(Boolean);
}
