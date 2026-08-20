import { createClient } from '@base44/sdk';

const appId = process.env.EXPO_PUBLIC_BASE44_APP_ID ?? '';
const appBaseUrl = process.env.EXPO_PUBLIC_BASE44_APP_BASE_URL ?? '';

let client: ReturnType<typeof createClient> | null = null;

export function getBase44Client() {
  if (!client) {
    if (!appId || !appBaseUrl) {
      throw new Error(
        'Missing EXPO_PUBLIC_BASE44_APP_ID or EXPO_PUBLIC_BASE44_APP_BASE_URL in mobile/.env',
      );
    }
    client = createClient({
      appId,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl,
    });
  }
  return client;
}

export function isBase44Configured() {
  return Boolean(appId && appBaseUrl);
}
