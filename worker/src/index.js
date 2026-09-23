import { errorJson, json, readJson, sessionHistoryLimit } from './util.js';
import { verifyFirebaseToken } from './auth.js';
import { withCors, corsHeaders } from './cors.js';
import {
  deleteUserRow,
  getUserRow,
  markDoReady,
  toPublicUser,
  upsertUser,
  userStudyStub,
} from './users.js';
import { handleAi } from './ai.js';
import {
  handleCreateNote,
  handleGetNote,
  handleGetNotePage,
  handlePatchNote,
  handleListNotes,
  handleDeleteNote,
  deleteUserNotes,
} from './notes.js';
import { handleRevenueCatWebhook, handleSubscriptionRefresh, handleProUnlock } from './billing.js';
import { UserStudyDO } from './user-do.js';
import { isFirebaseAuthProxyPath, proxyFirebaseAuth } from './firebaseAuthProxy.js';

export { UserStudyDO };

function routeParts(pathname) {
  return pathname.replace(/\/+$/, '').split('/').filter(Boolean);
}

async function requireUser(request, env) {
  const identity = await verifyFirebaseToken(request, env);
  if (identity.error) return { error: errorJson(identity.error, identity.status) };
  return { identity };
}

async function warmDo(env, uid) {
  const { id, stub } = userStudyStub(env, uid);
  const ping = await stub.ping();
  await markDoReady(env, uid, ping.storeId || id.toString());
}

async function handleUsersMe(request, env, identity) {
  const body = request.method === 'GET' ? {} : await readJson(request);
  const row = await upsertUser(env, {
    uid: identity.uid,
    email: body.email || identity.email,
    name: body.displayName || body.name || identity.name,
  });
  return json({ user: await toPublicUser(env, row) });
}

async function handleDeleteMe(env, identity) {
  const uid = identity.uid;
  const { stub } = userStudyStub(env, uid);
  await Promise.all([
    stub.evacuate().catch(() => {}),
    deleteUserNotes(env, uid),
  ]);
  await deleteUserRow(env, uid);
  return json({ ok: true });
}

async function handleUsage(env, identity) {
  const row = await getUserRow(env, identity.uid);
  if (!row) return errorJson('Account not found', 404);
  const user = await toPublicUser(env, row);
  return json({ me: user, user });
}

async function sessionLimitFor(env, uid) {
  const row = await getUserRow(env, uid);
  return sessionHistoryLimit(row?.subscription_tier);
}

async function handleSessions(request, env, identity, id) {
  const { stub } = userStudyStub(env, identity.uid);
  if (request.method === 'DELETE') {
    if (!id || id === 'current' || id === 'list') return errorJson('Session not found', 404);
    const session = await stub.getSession(id);
    if (!session) return errorJson('Session not found', 404);
    const current = await stub.getCurrentSession();
    if (current?.id === id && (session.status === 'active' || (!session.status && !session.finishedAt))) {
      return errorJson('Finish this cram before deleting it', 400);
    }
    await stub.deleteSession(id);
    return json({ ok: true });
  }
  if (request.method === 'GET' && (id === 'current' || !id)) {
    const session = await stub.getCurrentSession();
    return json({ session: session || null });
  }
  if (request.method === 'GET' && id === 'list') {
    const limit = await sessionLimitFor(env, identity.uid);
    await stub.trimFinishedSessions(limit);
    const sessions = await stub.listSessions();
    return json({ sessions });
  }
  if (request.method === 'GET') {
    const session = await stub.getSession(id);
    if (!session) return errorJson('Session not found', 404);
    return json({ session });
  }
  if (request.method === 'PUT' || request.method === 'POST') {
    const body = await readJson(request);
    const incoming = body.session || body;
    if (id && id !== 'current') incoming.id = incoming.id || id;
    if (!incoming.id) incoming.id = crypto.randomUUID();
    const session = await stub.putSession(incoming);
    const limit = await sessionLimitFor(env, identity.uid);
    await stub.trimFinishedSessions(limit);
    return json({ session });
  }
  return errorJson('Method not allowed', 405);
}

async function handlePanic(request, env, identity, sessionId) {
  const { stub } = userStudyStub(env, identity.uid);
  if (request.method === 'GET') {
    return json({ panic: await stub.getPanic(sessionId) });
  }
  const body = await readJson(request);
  const panic = await stub.putPanic({
    sessionId,
    signature: body.signature,
    text: body.text,
    generatedAt: body.generatedAt,
  });
  return json({ panic });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (isFirebaseAuthProxyPath(url.pathname)) {
      return proxyFirebaseAuth(request, env);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    const parts = routeParts(url.pathname);

    try {
      if (request.method === 'POST' && parts[0] === 'v1' && parts[1] === 'billing' && parts[2] === 'revenuecat') {
        return withCors(await handleRevenueCatWebhook(request, env), request, env);
      }

      if (parts[0] !== 'v1') {
        if (env.ASSETS) return env.ASSETS.fetch(request);
        return withCors(errorJson('Not found', 404), request, env);
      }

      const authed = await requireUser(request, env);
      if (authed.error) return withCors(authed.error, request, env);
      const { identity } = authed;

      let response;

      if (parts[1] === 'users' && parts[2] === 'me' && !parts[3] && request.method === 'DELETE') {
        response = await handleDeleteMe(env, identity);
      } else if (parts[1] === 'users' && parts[2] === 'me' && !parts[3] && (request.method === 'GET' || request.method === 'POST')) {
        response = await handleUsersMe(request, env, identity);
        if (request.method === 'POST') ctx.waitUntil(warmDo(env, identity.uid).catch(() => {}));
      } else if (parts[1] === 'users' && parts[2] === 'me' && parts[3] === 'usage' && request.method === 'GET') {
        response = await handleUsage(env, identity);
      } else if (
        parts[1] === 'users'
        && parts[2] === 'me'
        && parts[3] === 'subscription'
        && (parts[4] === 'refresh' || !parts[4])
        && request.method === 'POST'
      ) {
        response = await handleSubscriptionRefresh(env, identity);
      } else if (
        parts[1] === 'users'
        && parts[2] === 'me'
        && parts[3] === 'subscription'
        && parts[4] === 'unlock'
        && request.method === 'POST'
      ) {
        response = await handleProUnlock(request, env, identity);
      } else if (parts[1] === 'ai' && request.method === 'POST') {
        response = await handleAi(request, env, identity, parts[2] || 'complete');
      } else if (parts[1] === 'notes' && request.method === 'GET' && !parts[2]) {
        response = await handleListNotes(env, identity);
      } else if (parts[1] === 'notes' && request.method === 'POST' && !parts[2]) {
        response = await handleCreateNote(request, env, identity);
      } else if (parts[1] === 'notes' && parts[2] && parts[3] === 'pages' && request.method === 'GET') {
        response = await handleGetNotePage(env, identity, parts[2], parts[4]);
      } else if (parts[1] === 'notes' && parts[2] && request.method === 'GET') {
        response = await handleGetNote(env, identity, parts[2]);
      } else if (parts[1] === 'notes' && parts[2] && request.method === 'PATCH') {
        response = await handlePatchNote(request, env, identity, parts[2]);
      } else if (parts[1] === 'notes' && parts[2] && request.method === 'DELETE') {
        response = await handleDeleteNote(env, identity, parts[2]);
      } else if (parts[1] === 'sessions' && parts[2] === 'panic' && parts[3]) {
        response = await handlePanic(request, env, identity, parts[3]);
      } else if (parts[1] === 'sessions') {
        const id = parts[2] || (url.searchParams.get('id') || '');
        if (request.method === 'GET' && !parts[2] && url.searchParams.get('list') !== '0') {
          const { stub } = userStudyStub(env, identity.uid);
          const limit = await sessionLimitFor(env, identity.uid);
          await stub.trimFinishedSessions(limit);
          response = json({ sessions: await stub.listSessions() });
        } else {
          response = await handleSessions(request, env, identity, id);
        }
      } else {
        response = errorJson('Not found', 404);
      }

      return withCors(response, request, env);
    } catch (err) {
      return withCors(
        errorJson(err instanceof Error ? err.message : 'Server error', 500),
        request,
        env,
      );
    }
  },
};
