const ALLOWED = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'https://enthusiastic-cram-genius-flow.base44.app',
]);

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const extra = String(env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  extra.forEach((o) => ALLOWED.add(o));
  const allow = ALLOWED.has(origin) ? origin : [...ALLOWED][0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  const extra = corsHeaders(request, env);
  Object.entries(extra).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}
