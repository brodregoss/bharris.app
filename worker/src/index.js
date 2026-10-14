import { errorJson, json, periodKey, readJson, sessionHistoryLimit } from './util.js';
import { verifyFirebaseToken } from './auth.js';
import { withCors, corsHeaders } from './cors.js';
import {
  acceptTerms,
  deleteUserRow,
  getUserRow,
  markDoReady,
  requireFreshQuota,
  toPublicUser,
  touchLastSeen,
  upsertUser,
  userStudyStub,
} from './users.js';
import { handleAi } from './ai.js';
import { handleAdCredit } from './quota.js';
import {
  handleCreateNote,
  handleGetNote,
  handleGetNotePage,
  handlePatchNote,
  handleListNotes,
  handleDeleteNote,
  deleteUserNotes,
} from './notes.js';
import {
  handleScanUnlock,
  handleScanAdmin,
  handleScanKill,
  handleScanPassword,
  handleDevUnlock,
  requireScanToken,
} from './notesScanLock.js';
import { handleRevenueCatWebhook, handleSubscriptionRefresh, handleProUnlock } from './billing.js';
import { handleCheckout, handlePortal, handleStripeWebhook, handleCancel, billingForRequest, cancelStripeSubscription } from './stripeBilling.js';
import {
  handlePartnerRedeem,
  handlePartnerRemove,
  handlePartnerReset,
  releasePartnerOnDelete,
} from './partner.js';
import { UserStudyDO } from './user-do.js';
import { isFirebaseAuthProxyPath, nativeGoogleHandoffResponse, proxyFirebaseAuth } from './firebaseAuthProxy.js';
import { openAppPage, passwordResetRedirect } from './passwordReset.js';
import { handleAccountStats } from './accountStats.js';

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

// Accounts created before agreement was stored already accepted it in the app.
const TERMS_REQUIRED_AFTER = Date.parse('2026-10-13T16:30:00.000Z');

async function settleTerms(env, row, { accept }) {
  if (!row?.firebase_uid || row.terms_accepted_at) return row;
  const created = Date.parse(row.created_at || '');
  const alreadyAgreed = Number.isFinite(created) && created < TERMS_REQUIRED_AFTER;
  if (!alreadyAgreed && accept !== true) return row;
  return acceptTerms(env, row.firebase_uid);
}

async function handleUsersMe(request, env, identity, ctx) {
  const fresh = new URL(request.url).searchParams.get('fresh') === '1';
  if (request.method === 'GET') {
    let row = await getUserRow(env, identity.uid);
    const emailChanged = !!(
      row
      && identity.email
      && identity.email.toLowerCase() !== String(row.email || '').toLowerCase()
    );
    if (!row || emailChanged) {
      row = await upsertUser(env, {
        uid: identity.uid,
        email: identity.email,
        name: identity.name,
      });
    } else if (row.ai_quota_period !== periodKey()) {
      row = await requireFreshQuota(env, row);
    }
    row = await settleTerms(env, row, {});
    row = await billingForRequest(env, ctx, row, { fresh });
    ctx.waitUntil(touchLastSeen(env, row).catch(() => {}));
    return json({ user: await toPublicUser(env, row) });
  }
  const body = await readJson(request);
  const updateName = body.updateName === true;
  const submitted = String(body.displayName || body.name || '').trim().replace(/\s+/g, ' ');
  if (updateName && (!submitted || submitted.length > 80)) {
    return errorJson(submitted ? 'That name is too long.' : 'Enter your name.', 400);
  }
  let row = await upsertUser(env, {
    uid: identity.uid,
    email: body.email || identity.email,
    name: updateName ? submitted : (submitted || identity.name),
    updateName,
  });
  row = await settleTerms(env, row, { accept: body.acceptTerms === true });
  if (!updateName) row = await billingForRequest(env, ctx, row, { fresh });
  ctx.waitUntil(touchLastSeen(env, row).catch(() => {}));
  return json({ user: await toPublicUser(env, row) });
}

async function handleDeleteMe(env, identity) {
  const uid = identity.uid;
  const row = await getUserRow(env, uid);
  await releasePartnerOnDelete(env, uid);
  if (row?.stripe_subscription_id) {
    await cancelStripeSubscription(env, row.stripe_subscription_id).catch(() => {});
  }
  const { stub } = userStudyStub(env, uid);
  await Promise.all([
    stub.evacuate().catch(() => {}),
    deleteUserNotes(env, uid),
  ]);
  await deleteUserRow(env, uid);
  return json({ ok: true });
}

async function handleUsage(env, identity, ctx) {
  let row = await getUserRow(env, identity.uid);
  if (!row) return errorJson('Account not found', 404);
  row = await billingForRequest(env, ctx, row);
  const user = await toPublicUser(env, row);
  return json({ me: user, user });
}

async function sessionLimitFor(env, uid) {
  const row = await getUserRow(env, uid);
  return sessionHistoryLimit(row?.subscription_tier);
}

async function handleSessions(request, env, identity, id, ctx) {
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
    return json({ sessions: await stub.listSessionsCapped(limit) });
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
    const trim = sessionLimitFor(env, identity.uid)
      .then((limit) => stub.trimFinishedSessions(limit))
      .catch(() => {});
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(trim);
    else await trim;
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
    const donePage = openAppPage(url);
    if (donePage) return donePage;

    if (isFirebaseAuthProxyPath(url.pathname)) {
      const resetPage = passwordResetRedirect(url);
      if (resetPage) return resetPage;
      const handoff = nativeGoogleHandoffResponse(url);
      if (handoff) return handoff;
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
      if (request.method === 'POST' && parts[0] === 'v1' && parts[1] === 'billing' && parts[2] === 'stripe') {
        return withCors(await handleStripeWebhook(request, env), request, env);
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
        response = await handleUsersMe(request, env, identity, ctx);
        if (request.method === 'POST') ctx.waitUntil(warmDo(env, identity.uid).catch(() => {}));
      } else if (parts[1] === 'users' && parts[2] === 'me' && parts[3] === 'usage' && request.method === 'GET') {
        response = await handleUsage(env, identity, ctx);
      } else if (parts[1] === 'users' && parts[2] === 'me' && parts[3] === 'ad-credit' && request.method === 'POST') {
        response = await handleAdCredit(env, identity);
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
      } else if (parts[1] === 'billing' && parts[2] === 'checkout' && request.method === 'POST') {
        response = await handleCheckout(request, env, identity);
      } else if (parts[1] === 'billing' && parts[2] === 'cancel' && request.method === 'POST') {
        response = await handleCancel(env, identity);
      } else if (parts[1] === 'billing' && parts[2] === 'portal' && request.method === 'POST') {
        response = await handlePortal(request, env, identity);
      } else if (parts[1] === 'billing' && parts[2] === 'partner' && parts[3] === 'redeem' && request.method === 'POST') {
        response = await handlePartnerRedeem(request, env, identity);
      } else if (parts[1] === 'billing' && parts[2] === 'partner' && parts[3] === 'reset' && request.method === 'POST') {
        response = await handlePartnerReset(env, identity);
      } else if (parts[1] === 'billing' && parts[2] === 'partner' && parts[3] === 'remove' && request.method === 'POST') {
        response = await handlePartnerRemove(env, identity);
      } else if (parts[1] === 'ai' && request.method === 'POST') {
        response = await handleAi(request, env, identity, parts[2] || 'complete');
      } else if (parts[1] === 'dev-tools' && parts[2] === 'unlock' && request.method === 'POST') {
        response = await handleDevUnlock(request, env, identity);
      } else if (parts[1] === 'dev-tools' && parts[2] === 'stats' && request.method === 'GET') {
        response = await handleAccountStats(request, env, identity);
      } else if (parts[1] === 'notes' && parts[2] === 'scan-unlock' && request.method === 'POST') {
        response = await handleScanUnlock(request, env, identity);
      } else if (parts[1] === 'notes' && parts[2] === 'scan-admin' && request.method === 'GET') {
        response = await handleScanAdmin(request, env, identity);
      } else if (parts[1] === 'notes' && parts[2] === 'scan-kill' && request.method === 'POST') {
        response = await handleScanKill(request, env, identity);
      } else if (parts[1] === 'notes' && parts[2] === 'scan-password' && request.method === 'POST') {
        response = await handleScanPassword(request, env, identity);
      } else if (parts[1] === 'notes' && parts[2] === 'scan-session' && request.method === 'GET') {
        response = await requireScanToken(request, env, identity) || json({ ok: true });
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
          response = json({ sessions: await stub.listSessionsCapped(limit) });
        } else {
          response = await handleSessions(request, env, identity, id, ctx);
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
