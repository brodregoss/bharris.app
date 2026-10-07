export function planMarks(user, signedIn) {
  const plan = user?.billingPlan || '';
  return {
    currentStudy: !!signedIn && plan === 'solo',
    currentPartner: !!signedIn && (plan === 'partner' || plan === 'guest'),
  };
}

export function checkoutDestination(plan, data) {
  if (data?.granted) return plan === 'partner' ? '/thanks/?plan=partner' : '/thanks/';
  return typeof data?.url === 'string' ? data.url : '';
}
