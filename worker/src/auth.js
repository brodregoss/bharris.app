import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export async function verifyFirebaseToken(request, env) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: 'Missing bearer token', status: 401 };
  const projectId = String(env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) return { error: 'Server is missing FIREBASE_PROJECT_ID', status: 500 };

  try {
    const { payload } = await jwtVerify(match[1], JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    const uid = String(payload.sub || '');
    if (!uid) return { error: 'Invalid token', status: 401 };
    return {
      uid,
      email: typeof payload.email === 'string' ? payload.email : '',
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return { error: 'Invalid or expired token', status: 401 };
  }
}
