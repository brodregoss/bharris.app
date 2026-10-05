const DEFAULT_HOST = 'bharris-app.firebaseapp.com';

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
  out.set('cache-control', 'no-store');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export function isFirebaseAuthProxyPath(pathname) {
  return pathname.startsWith('/__/auth') || pathname.startsWith('/__/firebase');
}

const NATIVE_STATE_PREFIX = 'bh.';

// Google sometimes puts the token in the hash, which this server never sees.
// Move that hash onto the same https address. A script jump straight to
// bharris:// makes iOS look up "auth" as a website and fail.
const HASH_TO_QUERY_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
(function () {
  var hash = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  var query = new URLSearchParams(location.search);
  var token = hash.get("id_token") || "";
  var error = hash.get("error") || "";
  if (!token && !error) {
    query.set("error", query.get("error") || "missing_token");
  } else {
    if (token) query.set("id_token", token);
    if (error) query.set("error", error);
  }
  location.replace(location.pathname + "?" + query.toString());
})();
</script></body></html>`;

function nativeAppCallback(url) {
  const back = new URLSearchParams();
  const state = url.searchParams.get('state') || '';
  if (state.startsWith(NATIVE_STATE_PREFIX)) back.set('state', state.slice(NATIVE_STATE_PREFIX.length));
  const idToken = url.searchParams.get('id_token') || '';
  if (idToken) {
    back.set('id_token', idToken);
    back.set('googleIdToken', idToken);
  }
  const error = url.searchParams.get('error') || '';
  if (error) back.set('error', error);
  return `bharris://auth?${back.toString()}`;
}

// Google returns here. An HTTP redirect is what the iPhone sign-in sheet can catch.
export function nativeGoogleHandoffResponse(url) {
  if (url.pathname !== '/__/auth/handler') return null;
  const state = url.searchParams.get('state') || '';
  const idToken = url.searchParams.get('id_token') || '';
  const error = url.searchParams.get('error') || '';
  const ours = state.startsWith(NATIVE_STATE_PREFIX);
  // Google often puts the account token in the hash. The server cannot see a hash,
  // so copy it into the query before deciding. An empty visit is not our sign-in.
  if (!idToken && !error) {
    return new Response(HASH_TO_QUERY_HTML, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
  if (!ours && !idToken) return null;
  return new Response(null, {
    status: 302,
    headers: {
      Location: nativeAppCallback(url),
      'cache-control': 'no-store',
    },
  });
}
