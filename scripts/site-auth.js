import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js';

const cfg = window.BH_SITE || {};
const button = document.getElementById('site-sign-in');
if (button && cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId) {
  const auth = getAuth(initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
  }));
  const account = bindSiteAccount(auth);
  onAuthStateChanged(auth, (user) => account.setSignedIn(user));
} else if (button) {
  clearAuthWait();
  button.hidden = false;
}
