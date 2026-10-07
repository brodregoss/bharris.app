const PLAN_COOKIE = 'bharris_plan';
const CHOICE_COOKIE = 'bharris_cookie';
let pendingPlanUser = null;

function cookieBase() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  return `; Path=/; SameSite=Lax${secure}`;
}

function readCookieValue(name) {
  const parts = document.cookie ? document.cookie.split('; ') : [];
  const row = parts.find((item) => item.startsWith(`${name}=`));
  if (!row) return '';
  try {
    return decodeURIComponent(row.slice(name.length + 1));
  } catch {
    return '';
  }
}

function readCookieChoice() {
  const value = readCookieValue(CHOICE_COOKIE);
  return value === 'accepted' || value === 'declined' ? value : '';
}

function readPlanCookie() {
  const parts = document.cookie ? document.cookie.split('; ') : [];
  const row = parts.find((item) => item.startsWith(`${PLAN_COOKIE}=`));
  if (!row) return null;
  try {
    const data = JSON.parse(decodeURIComponent(row.slice(PLAN_COOKIE.length + 1)));
    if (!data || typeof data !== 'object' || !data.u) return null;
    const plan = data.p === 'solo' || data.p === 'partner' || data.p === 'guest' ? data.p : '';
    return {
      uid: String(data.u),
      billingPlan: plan,
      subscriptionTier: data.t === 'pro' ? 'pro' : 'free',
      hasBilling: plan === 'solo' || plan === 'partner',
      billingNotice: data.n === 'beta_ended' ? 'beta_ended' : '',
      partnerCode: plan === 'partner' ? String(data.c || '') : '',
      partnerLinked: plan === 'partner' && data.l === 1,
    };
  } catch {
    return null;
  }
}

function writePlanCookie(user) {
  const base = cookieBase();
  if (!user?.uid) {
    pendingPlanUser = null;
    document.cookie = `${PLAN_COOKIE}=${base}; Max-Age=0`;
    return;
  }
  pendingPlanUser = {
    uid: user.uid,
    billingPlan: user.billingPlan,
    subscriptionTier: user.subscriptionTier,
    billingNotice: user.billingNotice,
    partnerCode: user.partnerCode,
    partnerLinked: user.partnerLinked,
  };
  if (readCookieChoice() !== 'accepted') return;
  const plan = user.billingPlan === 'solo' || user.billingPlan === 'partner' || user.billingPlan === 'guest'
    ? user.billingPlan
    : '';
  const payload = {
    u: user.uid,
    p: plan,
    t: user.subscriptionTier === 'pro' ? 'pro' : 'free',
  };
  if (!plan && user.billingNotice === 'beta_ended') payload.n = 'beta_ended';
  if (plan === 'partner' && user.partnerCode) payload.c = user.partnerCode;
  if (plan === 'partner' && user.partnerLinked) payload.l = 1;
  document.cookie = `${PLAN_COOKIE}=${encodeURIComponent(JSON.stringify(payload))}${base}`;
}

function sitePlanName(user) {
  const plan = user?.billingPlan || '';
  if (plan === 'partner' || plan === 'guest') return 'Partner study';
  if (plan === 'solo' || user?.subscriptionTier === 'pro') return 'Study';
  return 'Free';
}

function bindSiteAccount(auth, sendPasswordResetEmail) {
  const signIn = document.getElementById('site-sign-in');
  const accountBtn = document.getElementById('site-account');
  const dialog = document.getElementById('site-account-dialog');
  const nameEl = document.getElementById('site-account-name');
  const emailEl = document.getElementById('site-account-email');
  const planEl = document.getElementById('site-account-plan');
  const partnerWrap = document.getElementById('site-account-partner');
  const codeEl = document.getElementById('site-account-code');
  const copyBtn = document.getElementById('site-account-copy');
  const resetBtn = document.getElementById('site-account-reset');
  const planNote = document.getElementById('site-account-plan-note');
  const statusEl = document.getElementById('site-account-status');
  let profile = null;
  let firebaseUser = null;

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  function paint(user) {
    const email = user?.email || firebaseUser?.email || '';
    const name = user?.displayName || firebaseUser?.displayName || '';
    if (nameEl) nameEl.textContent = name || '—';
    if (emailEl) emailEl.textContent = email || '—';
    if (planEl) planEl.textContent = user ? sitePlanName(user) : '—';
    const showCode = user?.billingPlan === 'partner';
    if (partnerWrap) partnerWrap.hidden = !showCode;
    const code = showCode ? (user.partnerCode || '') : '';
    if (codeEl) codeEl.textContent = code || 'Your code is on its way.';
    if (copyBtn) {
      copyBtn.hidden = !code;
      copyBtn.dataset.code = code;
    }
    let note = user ? cancelPlanNote(user) : '';
    if (!note && user?.billingPlan === 'guest') {
      note = 'Your friend pays for this plan. They can cancel it from their account.';
    }
    if (planNote) {
      planNote.hidden = !note;
      planNote.textContent = note;
    }
  }

  async function loadProfile() {
    if (!auth.currentUser) return;
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Could not load your account.');
    profile = data.user || null;
    if (profile) {
      writePlanCookie({ ...profile, uid: profile.uid || auth.currentUser.uid });
    }
    paint(profile);
  }

  function setSignedIn(user) {
    firebaseUser = user || null;
    if (signIn) signIn.hidden = !!user;
    if (accountBtn) accountBtn.hidden = !user;
    if (!user) {
      profile = null;
      writePlanCookie(null);
      if (dialog?.open) dialog.close();
    }
  }

  accountBtn?.addEventListener('click', () => {
    if (!dialog) return;
    setStatus('');
    if (!profile && firebaseUser) {
      const cached = readPlanCookie();
      if (cached?.uid && cached.uid === firebaseUser.uid) profile = cached;
    }
    paint(profile);
    dialog.showModal();
    loadProfile().catch((err) => {
      setStatus(err instanceof Error ? err.message : 'Could not load your account.');
    });
  });

  document.getElementById('site-account-close')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  resetBtn?.addEventListener('click', async () => {
    const email = auth.currentUser?.email || '';
    if (!email) {
      setStatus('This account has no email for a password reset.');
      return;
    }
    resetBtn.disabled = true;
    setStatus('Sending reset email…');
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus(`Password reset email sent to ${email}.`);
    } catch (err) {
      setStatus(err?.message || 'Could not send the reset email.');
    } finally {
      resetBtn.disabled = false;
    }
  });

  copyBtn?.addEventListener('click', async () => {
    const code = copyBtn.dataset.code || '';
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setStatus('Code copied.');
    } catch {
      setStatus('Could not copy the code.');
    }
  });

  return { setSignedIn };
}

window.addEventListener('bharris-cookies-accepted', () => {
  if (pendingPlanUser) writePlanCookie(pendingPlanUser);
});
window.addEventListener('bharris-cookies-declined', () => {
  pendingPlanUser = null;
});
