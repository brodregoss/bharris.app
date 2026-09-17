import { Capacitor } from '@capacitor/core';
import { APP_CONFIG } from '@/lib/appConfig';
import { refreshSubscription } from '@/lib/accountStore';

let configuredForUid = '';
let customerListenerBound = false;

async function nativePurchases() {
  const mod = await import('@revenuecat/purchases-capacitor');
  return mod.Purchases;
}

export function revenueCatConfigured() {
  return Capacitor.isNativePlatform() && !!APP_CONFIG.revenueCat.iosApiKey;
}

export async function configurePurchases(uid) {
  if (!uid || !revenueCatConfigured()) return false;
  if (configuredForUid === uid) return true;
  if (configuredForUid && configuredForUid !== uid) {
    await logOutPurchases();
  }
  const Purchases = await nativePurchases();
  await Purchases.configure({
    apiKey: APP_CONFIG.revenueCat.iosApiKey,
    appUserID: uid,
  });
  configuredForUid = uid;
  if (!customerListenerBound) {
    customerListenerBound = true;
    Purchases.addCustomerInfoUpdateListener?.(() => {
      refreshSubscription().catch(() => {});
    });
  }
  return true;
}

export async function logOutPurchases() {
  if (!configuredForUid) return;
  try {
    const Purchases = await nativePurchases();
    await Purchases.logOut();
  } catch {
    // Ignore logout errors so account switching still works.
  }
  configuredForUid = '';
}

export function entitlementId() {
  return APP_CONFIG.revenueCat.entitlementId;
}

export function hasActiveEntitlement(customerInfo) {
  const id = entitlementId();
  return !!customerInfo?.entitlements?.active?.[id];
}

export async function getOfferings() {
  if (!revenueCatConfigured()) return { current: null, available: false };
  const Purchases = await nativePurchases();
  const offerings = await Purchases.getOfferings();
  return { current: offerings.current, available: true };
}

export async function purchasePackage(pkg) {
  const Purchases = await nativePurchases();
  const result = await Purchases.purchasePackage({ aPackage: pkg });
  await refreshSubscription();
  return result;
}

export async function restorePurchases() {
  if (!revenueCatConfigured()) {
    return refreshSubscription();
  }
  const Purchases = await nativePurchases();
  const info = await Purchases.restorePurchases();
  await refreshSubscription();
  return info;
}

export async function customerIsPro() {
  if (!revenueCatConfigured()) return false;
  const Purchases = await nativePurchases();
  const info = await Purchases.getCustomerInfo();
  return hasActiveEntitlement(info.customerInfo || info);
}
