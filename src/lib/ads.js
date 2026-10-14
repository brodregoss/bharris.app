import { Capacitor } from '@capacitor/core';
import { getCurrentUser } from '@/lib/accountStore';
import { adsEnabledFor } from '@/lib/adAccess';

export { adsEnabledFor } from '@/lib/adAccess';

// Google's public sample units. Real AdMob IDs in .env.local replace these.
const TEST_REWARDED_IOS = 'ca-app-pub-3940256099942544/1712485313';
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';

export const AD_PLACEMENTS = {
  review: {
    title: 'Watch an ad to read this photo',
    body: 'Your terms show up when the ad finishes. Closing it early keeps them hidden.',
  },
  practice: {
    title: 'Watch an ad to start the practice test',
    body: 'The test starts when the ad finishes. Closing it early stays on this screen.',
  },
  spaced: {
    title: 'Watch an ad to continue',
    body: 'The next sitting starts when the ad finishes. Closing it early stays on this pause.',
  },
  credits: {
    title: 'Watch an ad for 10 more AI calls',
    body: 'One finished ad adds 10 AI calls. Closing it early adds nothing.',
  },
};

export const WEB_REWARD_SECONDS = 8;

const rewardedAdId = () => String(import.meta.env.VITE_ADMOB_REWARDED_IOS_ID || TEST_REWARDED_IOS);
const bannerAdId = () => String(import.meta.env.VITE_ADMOB_BANNER_IOS_ID || TEST_BANNER_IOS);

function usingTestAds() {
  return rewardedAdId() === TEST_REWARDED_IOS;
}

let flowPresenter = null;
const flowWaiters = [];

export function registerRewardedFlow(presenter) {
  flowPresenter = presenter;
  rewardFlight = null;
  if (!presenter) {
    stopNativeHold?.();
    stopNativeHold = null;
    return;
  }
  while (flowWaiters.length) {
    const job = flowWaiters.shift();
    presenter(job.placement, job.options).then(job.resolve, () => job.resolve(false));
  }
}

function presentFlow(placement, options) {
  if (flowPresenter) return flowPresenter(placement, options);
  return new Promise((resolve) => {
    flowWaiters.push({ placement, options, resolve });
  });
}

let rewardFlight = null;
let admobReady = null;
let endCurrentReward = null;
let stopNativeHold = null;
let rewardProgress = null;
const rewardProgressListeners = new Set();

export function registerRewardCancel(fn) {
  endCurrentReward = fn;
}

export function publishRewardProgress(snapshot) {
  rewardProgress = snapshot;
  rewardProgressListeners.forEach((listener) => listener(snapshot));
}

export function subscribeRewardProgress(listener) {
  rewardProgressListeners.add(listener);
  listener(rewardProgress);
  return () => rewardProgressListeners.delete(listener);
}

export function beginNativeHold(stop) {
  stopNativeHold = stop;
}

export function endRewarded() {
  stopNativeHold?.();
  stopNativeHold = null;
  endCurrentReward?.();
  rewardFlight = null;
}

async function ensureAdMob(AdMob) {
  if (!admobReady) {
    admobReady = AdMob.initialize({
      initializeForTesting: usingTestAds(),
    }).catch((err) => {
      admobReady = null;
      throw err;
    });
  }
  await admobReady;
}

export async function playNativeReward() {
  const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
  await ensureAdMob(AdMob);
  try {
    await AdMob.prepareRewardVideoAd({
      adId: rewardedAdId(),
      isTesting: usingTestAds(),
    });
  } catch {
    return true;
  }

  let earned = false;
  const handles = [];
  let finish = () => {};
  const outcome = new Promise((resolve) => {
    let settled = false;
    finish = (value) => {
      if (settled) return;
      settled = true;
      handles.forEach((handle) => handle.remove?.());
      resolve(value);
    };
  });

  handles.push(
    await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      earned = true;
    }),
    await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(earned)),
    await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(true)),
  );

  AdMob.showRewardVideoAd().then(() => {
    earned = true;
  }).catch(() => finish(true));

  return outcome;
}

// True when the user finished the ad, or when no ad was available.
// False when they declined the prompt or closed the ad early. Paid plans skip it.
export function showRewarded(placement, options) {
  if (!adsEnabledFor(getCurrentUser())) return Promise.resolve(true);
  if (rewardFlight) return rewardFlight;
  const flight = presentFlow(placement, options).finally(() => {
    if (rewardFlight === flight) rewardFlight = null;
  });
  rewardFlight = flight;
  return flight;
}

export async function showPanicBanner() {
  if (!Capacitor.isNativePlatform() || !adsEnabledFor(getCurrentUser())) return false;
  try {
    const { AdMob, BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
    await ensureAdMob(AdMob);
    await AdMob.showBanner({
      adId: bannerAdId(),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: 108,
      isTesting: usingTestAds(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function hidePanicBanner() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await AdMob.removeBanner();
  } catch {
    // The banner is already gone.
  }
}
