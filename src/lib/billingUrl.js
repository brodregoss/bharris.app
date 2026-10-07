import { Capacitor } from '@capacitor/core';

export async function openBillingUrl(url) {
  if (!url) throw new Error('Could not open billing.');
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  }
  window.location.assign(url);
}
