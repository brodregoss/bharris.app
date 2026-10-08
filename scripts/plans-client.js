import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const cfg = window.BH_PLANS || {};
const statusEl = document.getElementById('plans-status');
let auth = null;
let me = null;
let planLoading = false;

function setStatus(message, busy = false) {
  setStatusMessage(statusEl, message, busy);
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
    writePlanCookie(null);
    return;
  }
  const data = await api('/v1/users/me', { method: 'GET' });
  me = data.user ? { ...data.user, uid: data.user.uid || auth.currentUser.uid } : null;
  writePlanCookie(me);
}

function render() {
  const signedIn = !!auth?.currentUser || !!me?.uid;
  if (signedIn) document.getElementById('sign-in-dialog')?.close();
  const signIn = document.getElementById('site-sign-in');
  if (signIn) signIn.hidden = signedIn;
  const plan = me?.billingPlan || '';
  const marks = planMarks(me, signedIn);
  show('solo-current', marks.currentStudy);
  show('partner-current', plan === 'partner');
  show('solo-subscribe', !marks.currentStudy);
  show('solo-note', plan === 'solo');
  show('partner-subscribe', plan !== 'partner');
  show('partner-owner', plan === 'partner');
  show('guest-note', plan === 'guest');
  show('manage', !!me?.hasBilling);
  show('cancel-plan', canCancelWebsitePlan(me));
  const cancelNote = document.getElementById('cancel-note');
  const cancelText = cancelPlanNote(me);
  if (cancelNote) {
    cancelNote.hidden = !cancelText;
    cancelNote.textContent = cancelText;
  }
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
  ['solo-subscribe', 'partner-subscribe'].forEach((id) => {
    const button = document.getElementById(id);
    if (!button || button.classList.contains('is-busy')) return;
    button.toggleAttribute('disabled', planLoading && !me);
  });
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

const TERMS_AGREE_ERROR = 'Agree to the Terms of Service and Privacy Policy first.';

function agreedToTerms() {
  return document.getElementById('terms-agree')?.checked === true;
}

async function subscribe(plan) {
  if (!agreedToTerms()) {
    setStatus(TERMS_AGREE_ERROR);
    return;
  }
  rememberPromo();
  if (!auth?.currentUser) {
    promptSignIn();
    return;
  }
  const code = promoCode();
  const button = document.getElementById(plan === 'partner' ? 'partner-subscribe' : 'solo-subscribe');
  setButtonBusy(button, true, code ? 'Checking code' : 'Opening checkout');
  setStatus('');
  try {
    const data = await api('/v1/billing/checkout', { body: { plan, code } });
  const dest = checkoutDestination(plan, data);
  if (!dest) throw new Error('Could not start checkout.');
  try {
    sessionStorage.removeItem(PROMO_KEY);
  } catch {
    // The redirect still continues.
  }
    if (data.granted && data.user) {
      writePlanCookie({ ...data.user, uid: data.user.uid || auth.currentUser.uid });
    }
    window.location.assign(dest);
  } catch (err) {
    setButtonBusy(button, false);
    throw err;
  }
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
bind('cancel-plan', async () => {
  if (!canCancelWebsitePlan(me)) return;
  if (!window.confirm(cancelPlanQuestion(me))) return;
  const button = document.getElementById('cancel-plan');
  setButtonBusy(button, true, 'Canceling plan');
  setStatus('');
  try {
    const data = await api('/v1/billing/cancel', { body: {} });
    me = data.user || me;
    if (me) me.uid = me.uid || auth?.currentUser?.uid || '';
    writePlanCookie(me);
    render();
    setStatus('Plan canceled.');
  } finally {
    setButtonBusy(button, false);
  }
});
bind('manage', async () => {
  const button = document.getElementById('manage');
  setButtonBusy(button, true, 'Opening billing');
  setStatus('');
  try {
    const data = await api('/v1/billing/portal', { body: {} });
    if (!data.url) throw new Error('Could not open billing.');
    window.location.assign(data.url);
  } catch (err) {
    setButtonBusy(button, false);
    throw err;
  }
});
bind('copy-code', async () => {
  const code = me?.partnerCode || '';
  if (!code) return;
  await navigator.clipboard.writeText(code);
  setStatus('Code copied.');
});
bind('reset-code', async () => {
  if (!window.confirm('Reset the code? The old one will stop working.')) return;
  const button = document.getElementById('reset-code');
  setButtonBusy(button, true, 'Resetting code');
  setStatus('');
  try {
    const data = await api('/v1/billing/partner/reset', { body: {} });
    me = data.user || me;
    if (me) me.uid = me.uid || auth?.currentUser?.uid || '';
    writePlanCookie(me);
    render();
    setStatus('New code ready. The old one no longer works.');
  } finally {
    setButtonBusy(button, false);
  }
});
bind('remove-partner', async () => {
  if (!window.confirm('Remove your partner? They lose access now.')) return;
  const button = document.getElementById('remove-partner');
  setButtonBusy(button, true, 'Removing partner');
  setStatus('');
  try {
    const data = await api('/v1/billing/partner/remove', { body: {} });
    me = data.user || me;
    if (me) me.uid = me.uid || auth?.currentUser?.uid || '';
    writePlanCookie(me);
    render();
    setStatus('Partner removed. This code will not work for anyone else. Reset it to make a new one.');
  } finally {
    setButtonBusy(button, false);
  }
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
    if (!agreedToTerms()) {
      setRedeemStatus(TERMS_AGREE_ERROR);
      return;
    }
    const code = document.getElementById('redeem-code')?.value || '';
    const button = event.submitter || document.querySelector('#redeem-form button');
    setButtonBusy(button, true, 'Checking code');
    setRedeemStatus('');
    try {
      await api('/v1/billing/partner/redeem', { body: { code } });
      window.location.assign('/thanks/');
    } catch (err) {
      setButtonBusy(button, false);
      setRedeemStatus(err instanceof Error ? err.message : 'Could not redeem that code.');
    }
  } catch (err) {
    setRedeemStatus(err instanceof Error ? err.message : 'Could not redeem that code.');
  }
});

if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
  render();
} else {
  const cachedPlan = readPlanCookie();
  if (cachedPlan?.uid || cachedPlan?.billingPlan || cachedPlan?.subscriptionTier === 'pro') {
    me = cachedPlan;
  }
  render();
  auth = getAuth(initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
  }));
  const account = bindSiteAccount(auth, sendPasswordResetEmail);
  onAuthStateChanged(auth, (user) => {
    account.setSignedIn(user);
    if (!user) {
      me = null;
      planLoading = false;
      writePlanCookie(null);
      setStatus('');
      render();
      return;
    }
    document.getElementById('sign-in-dialog')?.close();
    const saved = readPlanCookie();
    if (saved?.uid === user.uid) {
      me = saved;
    } else {
      me = null;
      planLoading = true;
      setStatus('Loading your plan', true);
    }
    render();
    refresh()
      .catch((err) => {
        setStatus(err instanceof Error ? err.message : 'Could not load your account.');
      })
      .finally(() => {
        planLoading = false;
        if (statusEl?.classList.contains('is-loading')) setStatus('');
        render();
      });
  });
}
