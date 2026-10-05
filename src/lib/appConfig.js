export const APP_CONFIG = {
  firebase: {
    apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || ''),
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
    projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || ''),
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID || ''),
  },
  workerUrl: String(import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, ''),
  // Must match server.hostname in capacitor.config.json. This host is already on the
  // Firebase authorized-domain list, so sign-in from the iPhone app stays allowed.
  nativeAppHost: 'bharris-app.web.app',
  revenueCat: {
    iosApiKey: String(import.meta.env.VITE_REVENUECAT_IOS_API_KEY || ''),
    entitlementId: String(import.meta.env.VITE_REVENUECAT_ENTITLEMENT_ID || 'Study Pro'),
  },
  products: {
    monthly: 'studyapp.pro.monthly',
    yearly: 'studyapp.pro.yearly',
    group: 'Study Pro',
  },
};

export function firebaseConfigured() {
  const { apiKey, authDomain, projectId, appId } = APP_CONFIG.firebase;
  return !!(apiKey && authDomain && projectId && appId);
}
