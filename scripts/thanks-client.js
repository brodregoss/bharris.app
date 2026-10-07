import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const cfg = window.BH_THANKS || {};
const params = new URLSearchParams(window.location.search);
const expectPartner = params.get('plan') === 'partner';
const block = document.getElementById('partner-thanks');
const codeEl = document.getElementById('partner-thanks-code');
const copyBtn = document.getElementById('partner-thanks-copy');
const manageEl = document.querySelector('.thanks-manage');
let partnerCode = '';

function show(on) {
  if (block) block.hidden = !on;
}

function showCode(code) {
  partnerCode = code || '';
  if (codeEl) codeEl.textContent = partnerCode || 'Your code is on its way.';
  if (copyBtn) {
    copyBtn.hidden = !partnerCode;
    copyBtn.dataset.code = partnerCode;
  }
  if (manageEl) manageEl.hidden = false;
  show(true);
}

function showSignIn() {
  partnerCode = '';
  if (codeEl) {
    codeEl.textContent = '';
    const link = document.createElement('a');
    link.href = '/app/#/account/signin?return=%2Fthanks%2F%3Fplan%3Dpartner';
    link.textContent = 'Sign in to see your partner code';
    codeEl.append(link);
  }
  if (copyBtn) copyBtn.hidden = true;
  if (manageEl) manageEl.hidden = true;
  show(true);
}

async function api(auth) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch('/v1/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Could not load your account.');
  return data.user || null;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadPartnerCode(auth) {
  if (expectPartner) showCode('');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const user = await api(auth);
    if (user && auth.currentUser) {
      writePlanCookie({ ...user, uid: user.uid || auth.currentUser.uid });
    }
    const plan = user?.billingPlan || '';
    if (plan === 'partner' && user?.partnerCode) {
      showCode(user.partnerCode);
      return;
    }
    if (plan && plan !== 'partner') {
      show(false);
      return;
    }
    if (plan === 'partner' || expectPartner) {
      showCode('');
      await sleep(1200);
      continue;
    }
    show(false);
    return;
  }
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.focus();
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

copyBtn?.addEventListener('click', async () => {
  const code = copyBtn.dataset.code || partnerCode;
  if (!code) return;
  const copied = await writeClipboard(code);
  if (!copied) return;
  copyBtn.setAttribute('aria-label', 'Copied');
  window.setTimeout(() => copyBtn.setAttribute('aria-label', 'Copy code'), 1600);
});

if (!expectPartner && (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId)) {
  show(false);
} else if (cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId) {
  const auth = getAuth(initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
  }));
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      if (expectPartner) showSignIn();
      else show(false);
      return;
    }
    loadPartnerCode(auth).catch(() => {
      if (expectPartner) showCode('');
    });
  });
} else if (expectPartner) {
  showCode('');
}
