import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

function resolveServerUrl(url) {
  const usable =
    typeof url === 'string' && url.startsWith('https://') && !url.includes('your-app.base44.app');
  // Always use an absolute Base44 host. An empty serverUrl hits `/api` on the
  // current origin — that works only with the Vite proxy, which 500s, and it
  // does not exist at all inside the iOS app.
  return usable ? url.replace(/\/$/, '') : 'https://base44.app';
}

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: resolveServerUrl(appBaseUrl),
  requiresAuth: false,
  appBaseUrl
});
