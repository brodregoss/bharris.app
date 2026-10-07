import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  EmailAuthProvider,
  browserLocalPersistence,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  setPersistence,
  signOut,
  updatePassword,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const cfg = window.BH_ACCOUNT || {};
const statusEl = document.getElementById('account-status');
let auth = null;
let me = null;
let authReady = false;

function setStatus(message) {
  if (statusEl) statusEl.textContent = message || '';
}

function setPasswordStatus(message) {
  const el = document.getElementById('account-password-status');
  if (el) el.textContent = message || '';
}

function passwordDialog() {
  return document.getElementById('account-password-dialog');
}

function openPasswordDialog() {
  const dialog = passwordDialog();
  if (!dialog || dialog.open) return;
  setPasswordStatus('');
  dialog.classList.remove('closing');
  dialog.showModal();
}

function closePasswordDialog() {
  const dialog = passwordDialog();
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

function show(id, on) {
  const el = document.getElementById(id);
  if (el) el.hidden = !on;
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

function render() {
  const signedIn = !!auth?.currentUser;
  show('account-loading', !authReady);
  show('account-signed-out', authReady && !signedIn);
  show('account-signed-in', authReady && signedIn);
  if (!signedIn) {
    closePasswordDialog();
    return;
  }
  const name = document.getElementById('account-name');
  const email = document.getElementById('account-email');
  const plan = document.getElementById('account-plan');
  if (name) name.textContent = me?.displayName || auth.currentUser.displayName || '—';
  if (email) email.textContent = me?.email || auth.currentUser.email || '—';
  if (plan) plan.textContent = me ? sitePlanName(me) : '…';
  const hasPassword = !!auth.currentUser?.providerData?.some((provider) => provider.providerId === 'password');
  show('account-password-open', hasPassword);
  show('account-password-note', !hasPassword);
  if (!hasPassword) closePasswordDialog();
  if (!me) return;
  const priceEl = document.getElementById('account-price');
  const price = planPriceLabel(me);
  if (priceEl) {
    priceEl.hidden = !price;
    priceEl.textContent = price;
  }
  const lines = document.getElementById('account-lines');
  if (lines) {
    lines.replaceChildren();
    managePlanLines(me).forEach((text) => {
      const row = document.createElement('p');
      row.textContent = text;
      lines.appendChild(row);
    });
  }
  const partner = me.billingPlan === 'partner';
  show('account-partner', partner);
  const codeEl = document.getElementById('account-code');
  const code = partner ? (me.partnerCode || '') : '';
  if (codeEl) codeEl.textContent = code || 'Your code is on its way.';
  const copy = document.getElementById('account-copy');
  if (copy) {
    copy.hidden = !code;
    copy.dataset.code = code;
  }
  show('account-billing', !!me.hasBilling);
  show('account-plans', !ownsWebsitePlan(me) && me.billingPlan !== 'guest');
  show('account-cancel', canCancelWebsitePlan(me));
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

async function refresh() {
  try {
    await loadMe();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Could not load your account.');
  }
  render();
}

document.getElementById('account-billing')?.addEventListener('click', async () => {
  setStatus('Opening billing information…');
  try {
    const data = await api('/v1/billing/portal', { body: {} });
    if (!data.url) throw new Error('Could not open billing.');
    window.location.assign(data.url);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Could not open billing.');
  }
});

document.getElementById('account-cancel')?.addEventListener('click', async () => {
  if (!canCancelWebsitePlan(me)) return;
  if (!window.confirm(cancelPlanQuestion(me))) return;
  const button = document.getElementById('account-cancel');
  if (button) button.disabled = true;
  setStatus('Canceling plan…');
  try {
    const data = await api('/v1/billing/cancel', { body: {} });
    me = data.user || me;
    if (me) me.uid = me.uid || auth?.currentUser?.uid || '';
    writePlanCookie(me);
    render();
    setStatus('Plan canceled.');
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Could not cancel the plan.');
    if (button) button.disabled = false;
  }
});

document.getElementById('account-copy')?.addEventListener('click', async () => {
  const code = document.getElementById('account-copy')?.dataset.code || '';
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    setStatus('Code copied.');
  } catch {
    setStatus('Could not copy the code.');
  }
});

document.getElementById('account-password-open')?.addEventListener('click', () => {
  document.getElementById('account-password-form')?.reset();
  openPasswordDialog();
});

document.getElementById('account-password-close')?.addEventListener('click', closePasswordDialog);
passwordDialog()?.addEventListener('click', (event) => {
  if (event.target === passwordDialog()) closePasswordDialog();
});
passwordDialog()?.addEventListener('cancel', (event) => {
  event.preventDefault();
  closePasswordDialog();
});

document.getElementById('account-password-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const current = auth?.currentUser;
  const email = current?.email || '';
  const currentPassword = document.getElementById('account-current-password')?.value || '';
  const next = document.getElementById('account-new-password')?.value || '';
  const confirm = document.getElementById('account-confirm-password')?.value || '';
  if (!email) {
    setPasswordStatus('Sign in with email to change your password.');
    return;
  }
  if (!currentPassword) {
    setPasswordStatus('Enter your current password.');
    return;
  }
  if (next !== confirm) {
    setPasswordStatus('Passwords do not match.');
    return;
  }
  if (next.length < 8) {
    setPasswordStatus('Use at least 8 characters.');
    return;
  }
  const button = document.getElementById('account-password-save');
  if (button) button.disabled = true;
  setPasswordStatus('Updating password…');
  try {
    const credential = EmailAuthProvider.credential(email, currentPassword);
    await reauthenticateWithCredential(current, credential);
    await updatePassword(current, next);
    document.getElementById('account-password-form')?.reset();
    closePasswordDialog();
    setStatus('Password updated.');
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
      setPasswordStatus('Current password is wrong.');
    } else if (code === 'auth/weak-password') {
      setPasswordStatus('Use at least 8 characters.');
    } else if (code === 'auth/requires-recent-login') {
      setPasswordStatus('Enter your current password again.');
    } else {
      setPasswordStatus(err?.message || 'Could not change the password.');
    }
  } finally {
    if (button) button.disabled = false;
  }
});

document.getElementById('account-sign-out')?.addEventListener('click', async () => {
  setStatus('Signing out…');
  try {
    writePlanCookie(null);
    await signOut(auth);
    window.location.assign('/');
  } catch (err) {
    setStatus(err?.message || 'Could not sign out.');
  }
});

document.getElementById('account-delete')?.addEventListener('click', async () => {
  const current = auth?.currentUser;
  if (!current) return;
  const ok = window.confirm('Remove this account? This deletes your login, notes, and study sessions. It cannot be undone. A website subscription is cancelled with the account. An App Store subscription still has to be cancelled in iPhone Settings.');
  if (!ok) return;
  const button = document.getElementById('account-delete');
  if (button) button.disabled = true;
  setStatus('Removing account…');
  try {
    await api('/v1/users/me', { method: 'DELETE' });
    try {
      await deleteUser(current);
    } catch (err) {
      if (err?.code === 'auth/requires-recent-login') {
        throw new Error('Sign out, sign back in, and remove the account again.');
      }
      throw err;
    }
    writePlanCookie(null);
    await signOut(auth).catch(() => {});
    window.location.assign('/');
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Could not remove the account.');
    if (button) button.disabled = false;
  }
});

function watchAuth() {
  const account = bindSiteAccount(auth);
  onAuthStateChanged(auth, (user) => {
    authReady = true;
    account.setSignedIn(user);
    render();
    refresh();
  });
}

if (cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId) {
  auth = getAuth(initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
  }));
  setPersistence(auth, browserLocalPersistence).catch(() => {}).finally(watchAuth);
} else {
  authReady = true;
  render();
}
