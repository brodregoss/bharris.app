import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const cfg = window.BH_PLANS || {};
const statusEl = document.getElementById('plans-status');
let auth = null;
let me = null;

function setStatus(message) {
  if (statusEl) statusEl.textContent = message || '';
}

function setRedeemStatus(message) {
  const el = document.getElementById('redeem-status');
  if (el) el.textContent = message || '';
}

function show(id, on) {
  const el = document.getElementById(id);
  if (el) el.hidden = !on;
}

function promptSignIn() {
  const dialog = document.getElementById('sign-in-dialog');
  if (!dialog || dialog.open) return;
  dialog.classList.remove('closing');
  dialog.showModal();
}

function closeSignIn() {
  const dialog = document.getElementById('sign-in-dialog');
  if (!dialog?.open) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || dialog.classList.contains('closing')) {
    dialog.classList.remove('closing');
    dialog.close();
    return;
  }
  let settled = false;
  const finish = (event) => {
    if (settled || (event && event.target !== dialog)) return;
    settled = true;
    dialog.removeEventListener('transitionend', finish);
    dialog.classList.remove('closing');
    if (dialog.open) dialog.close();
  };
  dialog.classList.add('closing');
  dialog.addEventListener('transitionend', finish);
  window.setTimeout(finish, 420);
}

async function api(path, { method = 'POST', body } = {}) {
  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Something went wrong.');
  return data;
}

async function loadMe() {
  if (!auth?.currentUser) {
    me = null;
    return;
  }
  await api('/v1/users/me', {
    body: {
      email: auth.currentUser.email || '',
      displayName: auth.currentUser.displayName || '',
    },
  });
  const data = await api('/v1/users/me', { method: 'GET' });
  me = data.user || null;
}

function render() {
  const signedIn = !!auth?.currentUser;
  if (signedIn) document.getElementById('sign-in-dialog')?.close();
  const plan = me?.billingPlan || '';
  show('solo-subscribe', plan !== 'solo');
  show('solo-note', plan === 'solo');
  show('partner-subscribe', plan !== 'partner');
  show('partner-owner', plan === 'partner');
  show('guest-note', plan === 'guest');
  show('manage', !!me?.hasBilling);
  const code = document.getElementById('partner-code');
  if (code) {
    code.textContent = plan === 'partner'
      ? (me?.partnerCode || 'Your code is on its way. Refresh in a moment.')
      : '';
  }
  show('beta-ended', !plan && me?.billingNotice === 'beta_ended');
  show('copy-code', !!me?.partnerCode);
  show('reset-code', !!me?.partnerCode);
  show('remove-partner', !!me?.partnerLinked);
}

async function refresh() {
  await loadMe();
  render();
}

const PROMO_KEY = 'bharris-promo-code';

function promoCode() {
  return document.getElementById('promo-code')?.value.trim() || '';
}

function rememberPromo() {
  try {
    const code = promoCode();
    if (code) sessionStorage.setItem(PROMO_KEY, code);
    else sessionStorage.removeItem(PROMO_KEY);
  } catch {
    // Checkout can still open without remembering the code.
  }
}

function restorePromo() {
  const input = document.getElementById('promo-code');
  if (!input || input.value) return;
  try {
    input.value = sessionStorage.getItem(PROMO_KEY) || '';
  } catch {
    // The field stays empty.
  }
}

async function subscribe(plan) {
  rememberPromo();
  if (!auth?.currentUser) {
    promptSignIn();
    return;
  }
  const code = promoCode();
  setStatus(code ? 'Checking code…' : 'Opening checkout…');
  const data = await api('/v1/billing/checkout', { body: { plan, code } });
  if (!data.url) throw new Error('Could not start checkout.');
  try {
    sessionStorage.removeItem(PROMO_KEY);
  } catch {
    // The redirect still continues.
  }
  window.location.assign(data.url);
}

function bind(id, fn) {
  document.getElementById(id)?.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      await fn();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Something went wrong.');
    }
  });
}

restorePromo();
bind('solo-subscribe', () => subscribe('solo'));
bind('partner-subscribe', () => subscribe('partner'));
bind('manage', async () => {
  setStatus('Opening billing…');
  const data = await api('/v1/billing/portal', { body: {} });
  if (!data.url) throw new Error('Could not open billing.');
  window.location.assign(data.url);
});
bind('copy-code', async () => {
  const code = me?.partnerCode || '';
  if (!code) return;
  await navigator.clipboard.writeText(code);
  setStatus('Code copied.');
});
bind('reset-code', async () => {
  if (!window.confirm('Reset the code? The old one will stop working.')) return;
  setStatus('Resetting code…');
  const data = await api('/v1/billing/partner/reset', { body: {} });
  me = data.user || me;
  render();
  setStatus('New code ready. The old one no longer works.');
});
bind('remove-partner', async () => {
  if (!window.confirm('Remove your partner? They lose access now.')) return;
  setStatus('Removing partner…');
  const data = await api('/v1/billing/partner/remove', { body: {} });
  me = data.user || me;
  render();
  setStatus('Partner removed. This code will not work for anyone else. Reset it to make a new one.');
});

document.getElementById('sign-in-close')?.addEventListener('click', closeSignIn);
document.getElementById('sign-in-dialog')?.addEventListener('click', (event) => {
  if (event.target?.id === 'sign-in-dialog') closeSignIn();
});

document.getElementById('redeem-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    if (!auth?.currentUser) {
      promptSignIn();
      return;
    }
    const code = document.getElementById('redeem-code')?.value || '';
    setRedeemStatus('Checking code…');
    await api('/v1/billing/partner/redeem', { body: { code } });
    window.location.assign('/thanks/');
  } catch (err) {
    setRedeemStatus(err instanceof Error ? err.message : 'Could not redeem that code.');
  }
});

if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
  render();
} else {
  auth = getAuth(initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
  }));
  onAuthStateChanged(auth, () => {
    refresh().catch((err) => {
      setStatus(err instanceof Error ? err.message : 'Could not load your account.');
      render();
    });
  });
}
