import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Dev uses the Vite /api proxy. Production and the iOS app call the hosted
// Base44 backend directly so InvokeLLM works inside WKWebView / TestFlight.
const serverUrl = import.meta.env.DEV ? '' : (appBaseUrl || '');

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl,
  requiresAuth: false,
  appBaseUrl
});
