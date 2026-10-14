import { showRewarded } from '@/lib/ads';
import { grantAdCredit } from '@/lib/accountStore';

// Plays the prompt, then the ad. A closed ad does not ask the server for a credit.
export async function watchAdForCredit() {
  const earned = await showRewarded('credits');
  if (!earned) return { granted: 0 };
  return grantAdCredit();
}
