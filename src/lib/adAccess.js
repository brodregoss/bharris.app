import { planForUser } from '@/lib/plans';

export function adsEnabledFor(user) {
  return planForUser(user).id === 'free';
}
