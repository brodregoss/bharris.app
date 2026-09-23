export const APP_CONFIG = {
  firebase: {
    apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || ''),
    authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ''),
    projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || ''),
    appId: String(import.meta.env.VITE_FIREBASE_APP_ID || ''),
  },
  workerUrl: String(import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, ''),
  // Must match server.hostname in capacitor.config.json. The iPhone app is served
  // from capacitor:// this host, which Firebase will not treat as a website.
  nativeAppHost: 'enthusiastic-cram-genius-flow.base44.app',
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
