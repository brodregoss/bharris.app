const DEFAULT_HOST = 'last-minute-study-899f2.firebaseapp.com';

// iPhone Safari blocks sessionStorage on firebaseapp.com during Google sign-in.
// Serving the helper from this site keeps that storage first-party.
export async function proxyFirebaseAuth(request, env) {
  const incoming = new URL(request.url);
  const host = String(env.FIREBASE_AUTH_HOST || DEFAULT_HOST)
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const headers = new Headers(request.headers);
  headers.delete('host');
  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }
  const upstream = await fetch(`https://${host}${incoming.pathname}${incoming.search}`, init);
  const out = new Headers(upstream.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export function isFirebaseAuthProxyPath(pathname) {
  return pathname.startsWith('/__/auth') || pathname.startsWith('/__/firebase');
}
