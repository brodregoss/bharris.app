import { initializeApp, getApps } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  OAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  setPersistence,
  getRedirectResult,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { Capacitor, registerPlugin } from '@capacitor/core';

const GoogleAuthSession = registerPlugin('GoogleAuthSession');
import { formatPersonName } from '@/lib/personName';
import { APP_CONFIG, firebaseConfigured } from '@/lib/appConfig';

let authPromise;

function isIosBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

const NATIVE_GOOGLE_REDIRECT_KEY = 'lms_google_redirect';

function isNativeCapacitorPage() {
  return Capacitor.isNativePlatform()
    && typeof window !== 'undefined'
    && window.location.protocol === 'capacitor:';
}

function isGoogleStartPage() {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') return false;
  return new URLSearchParams(window.location.search).get('googleStart') === '1';
}

function nativeGoogleReturnUrl() {
  if (typeof window === 'undefined') return '';
  const raw = new URLSearchParams(window.location.search).get('googleReturn') || '';
  try {
    const url = new URL(raw);
    if (url.protocol === 'bharris:' && url.hostname === 'auth') return 'bharris://auth';
    if (url.protocol === 'capacitor:' && url.hostname === APP_CONFIG.nativeAppHost) return `${url.origin}/`;
    return '';
  } catch {
    return '';
  }
}

function leaveNativeApp(returnUrl, params) {
  const back = new URL(returnUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) back.searchParams.set(key, value);
  });
  back.hash = '/account';
  window.location.replace(back.toString());
}

function iosAuthDomain() {
  if (typeof window === 'undefined' || !isIosBrowser()) return '';
  // Safari and the in-app https page use this site so Google’s helper stays first-party.
  if (!Capacitor.isNativePlatform() || window.location.protocol === 'https:') return window.location.host;
  return String(APP_CONFIG.workerUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function firebaseAppConfig() {
  const config = { ...APP_CONFIG.firebase };
  const domain = iosAuthDomain();
  if (domain) config.authDomain = domain;
  return config;
}

export function getFirebaseAuth() {
  if (!firebaseConfigured()) {
    throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values and reload.');
  }
  if (authPromise) return authPromise;
  authPromise = (async () => {
    const app = getApps()[0] || initializeApp(firebaseAppConfig());
    if (Capacitor.isNativePlatform() || isIosBrowser()) {
      // Do not attach the popup redirect helper here. On iPhone it loads an
      // iframe before anything else and makes Google sign-in feel stuck.
      try {
        return initializeAuth(app, { persistence: indexedDBLocalPersistence });
      } catch {
        return getAuth(app);
      }
    }
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    return auth;
  })();
  return authPromise;
}

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  provider.addScope('email');
  provider.addScope('profile');
  return provider;
}

async function nativeGoogleUser(auth) {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error('Google did not return a sign-in token.');
  const credential = GoogleAuthProvider.credential(idToken);
  const cred = await signInWithCredential(auth, credential);
  return cred.user;
}

export async function firebaseUpdateDisplayName(displayName) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to update your name.');
  const name = formatPersonName(displayName);
  await updateProfile(user, { displayName: name });
  try {
    await user.getIdToken(true);
  } catch {
    // The profile name is saved. The next sign-in refreshes the token.
  }
  return auth.currentUser || user;
}

export async function firebaseCreateAccount(email, password, displayName) {
  const auth = await getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const name = formatPersonName(displayName);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
    if (!cred.user.displayName) {
      try {
        await cred.user.reload();
      } catch {
        // The typed name is still sent to the study server.
      }
    }
  }
  return auth.currentUser || cred.user;
}

export async function firebaseSignIn(email, password) {
  const auth = await getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

function rememberNativeGoogleRedirect() {
  try {
    localStorage.setItem(NATIVE_GOOGLE_REDIRECT_KEY, '1');
  } catch {
    // The redirect can still complete if session storage survives.
  }
}

function clearNativeGoogleRedirect() {
  try {
    localStorage.removeItem(NATIVE_GOOGLE_REDIRECT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function nativeGoogleRedirectPending() {
  try {
    return localStorage.getItem(NATIVE_GOOGLE_REDIRECT_KEY) === '1';
  } catch {
    return false;
  }
}

async function webProviderSignIn(auth, provider) {
  if (isIosBrowser()) {
    rememberNativeGoogleRedirect();
    try {
      await Promise.race([
        signInWithRedirect(auth, provider, browserPopupRedirectResolver),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Google sign-in did not open. Try again.')), 10000);
        }),
      ]);
    } catch (err) {
      clearNativeGoogleRedirect();
      const returnUrl = isGoogleStartPage() ? nativeGoogleReturnUrl() : '';
      if (returnUrl) {
        leaveNativeApp(returnUrl, { googleCancelled: '1' });
        await new Promise(() => {});
      }
      throw err;
    }
    return null;
  }
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

async function returnGoogleResultToApp(result) {
  const returnUrl = nativeGoogleReturnUrl();
  if (!returnUrl) return false;
  const idToken = result ? GoogleAuthProvider.credentialFromResult(result)?.idToken || '' : '';
  leaveNativeApp(returnUrl, idToken ? { googleIdToken: idToken } : { googleCancelled: '1' });
  await new Promise(() => {});
  return true;
}

export async function finishRedirectSignIn() {
  if (!isIosBrowser() || !nativeGoogleRedirectPending()) return null;
  clearNativeGoogleRedirect();
  const auth = await getFirebaseAuth();
  try {
    const result = await Promise.race([
      getRedirectResult(auth, browserPopupRedirectResolver),
      new Promise((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error('redirect-timeout'), { code: 'auth/timeout' })), 12000);
      }),
    ]);
    if (isGoogleStartPage()) await returnGoogleResultToApp(result);
    return null;
  } catch (err) {
    if (isGoogleStartPage()) await returnGoogleResultToApp(null);
    if (err?.code === 'auth/argument-error' || err?.code === 'auth/timeout') return null;
    return firebaseErrorMessage(err);
  }
}

export async function adoptNativeGoogleHandoff() {
  if (!isNativeCapacitorPage()) return '';
  const params = new URLSearchParams(window.location.search);
  const token = params.get('googleIdToken') || '';
  const cancelled = params.get('googleCancelled') === '1';
  if (!token && !cancelled) return '';
  const clean = new URL(window.location.href);
  clean.searchParams.delete('googleIdToken');
  clean.searchParams.delete('googleCancelled');
  window.history.replaceState(null, '', `${clean.pathname}${clean.search}${clean.hash}`);
  if (cancelled) return 'cancelled';
  const auth = await getFirebaseAuth();
  await signInWithCredential(auth, GoogleAuthProvider.credential(token));
  return 'signed-in';
}

async function requestGoogleAuthUri() {
  const worker = String(APP_CONFIG.workerUrl || '').replace(/\/$/, '');
  if (!worker) {
    const error = new Error('Google sign-in is not available in the app yet.');
    error.code = 'auth/use-legacy-google';
    throw error;
  }
  const continueUri = `https://${APP_CONFIG.firebase.authDomain}/`;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(APP_CONFIG.firebase.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'google.com',
        continueUri,
        oauthScope: 'openid email profile',
        customParameter: { prompt: 'select_account' },
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  const authUri = data?.authUri || '';
  if (!response.ok || !authUri) {
    throw new Error(data?.error?.message || 'Could not open Google sign-in.');
  }
  const authUrl = new URL(authUri);
  if (authUrl.hostname !== 'accounts.google.com') {
    const error = new Error('Google sign-in opened on the wrong page.');
    error.code = 'auth/use-legacy-google';
    throw error;
  }
  const redirectUri = `${worker}/__/auth/handler`;
  const nonce = (crypto.randomUUID?.() || String(Date.now())).replace(/-/g, '');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', `bh.${nonce}`);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('scope', 'openid email profile');
  // Ask Google for the account token in the link, so the app can sign in
  // without Firebase exchanging a code that was issued for a different page.
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.delete('code_challenge');
  authUrl.searchParams.delete('code_challenge_method');
  return { authUri: authUrl.toString(), redirectUri };
}

async function exchangeGoogleCallback(auth, started, callback) {
  const params = callback.searchParams;
  if (params.get('error')) {
    const error = new Error('Google sign-in was closed.');
    error.code = 'auth/popup-closed-by-user';
    throw error;
  }
  const googleIdToken = params.get('id_token') || params.get('googleIdToken') || '';
  if (googleIdToken) {
    const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(googleIdToken));
    return cred.user;
  }
  const code = params.get('code') || '';
  if (!code) throw new Error('Google did not return a sign-in token.');
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(APP_CONFIG.firebase.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestUri: started.redirectUri,
        returnSecureToken: true,
        returnIdpCredential: true,
        postBody: new URLSearchParams({
          code,
          providerId: 'google.com',
        }).toString(),
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  const oauthIdToken = data?.oauthIdToken || '';
  const oauthAccessToken = data?.oauthAccessToken || '';
  if (!response.ok || (!oauthIdToken && !oauthAccessToken)) {
    throw new Error('Google sign-in could not be verified. Try again.');
  }
  const cred = await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(oauthIdToken || undefined, oauthAccessToken || undefined),
  );
  return cred.user;
}

async function legacyGooglePopup(auth) {
  if (!APP_CONFIG.workerUrl) throw new Error('Google sign-in is not available in the app yet.');
  const start = new URL(`${APP_CONFIG.workerUrl}/`);
  start.searchParams.set('googleStart', '1');
  start.searchParams.set('googleReturn', 'bharris://auth');
  start.hash = '/account';
  const result = await GoogleAuthSession.start({ url: start.toString() });
  const callback = new URL(String(result?.url || ''));
  if (callback.searchParams.get('googleCancelled') === '1') {
    const error = new Error('Google sign-in was closed.');
    error.code = 'auth/popup-closed-by-user';
    throw error;
  }
  const idToken = callback.searchParams.get('googleIdToken') || '';
  if (!idToken) throw new Error('Google did not return a sign-in token.');
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return cred.user;
}

async function nativeGooglePopup(auth) {
  let started;
  try {
    started = await requestGoogleAuthUri();
  } catch (err) {
    if (err?.code === 'auth/popup-closed-by-user') throw err;
    return legacyGooglePopup(auth);
  }
  const result = await GoogleAuthSession.start({ url: started.authUri });
  const callback = new URL(String(result?.url || ''));
  if (callback.searchParams.get('googleCancelled') === '1') {
    const error = new Error('Google sign-in was closed.');
    error.code = 'auth/popup-closed-by-user';
    throw error;
  }
  return exchangeGoogleCallback(auth, started, callback);
}

export async function firebaseSignInWithGoogle() {
  const auth = await getFirebaseAuth();
  // Stay on the sign-in screen. iOS asks to use accounts.google.com, then
  // shows Google in a sheet and brings the account back into the app.
  if (isNativeCapacitorPage()) {
    return nativeGooglePopup(auth);
  }
  if (Capacitor.isNativePlatform() && !isIosBrowser()) {
    return nativeGoogleUser(auth);
  }
  return webProviderSignIn(auth, googleProvider());
}

export function shouldStartHostedGoogleSignIn() {
  return isGoogleStartPage() && !!nativeGoogleReturnUrl() && !nativeGoogleRedirectPending();
}

function appleProvider() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return provider;
}

async function nativeAppleUser(auth) {
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
  const idToken = result.credential?.idToken;
  const rawNonce = result.credential?.nonce;
  if (!idToken) throw new Error('Apple did not return a sign-in token.');
  const credential = appleProvider().credential({ idToken, rawNonce });
  const cred = await signInWithCredential(auth, credential);
  const displayName = formatPersonName(result.user?.displayName);
  if (displayName && !cred.user.displayName) {
    try {
      await updateProfile(cred.user, { displayName });
    } catch {
      // The name is optional. Sign-in already succeeded.
    }
  }
  return cred.user;
}

export async function firebaseSignInWithApple() {
  const auth = await getFirebaseAuth();
  if (Capacitor.isNativePlatform()) {
    return nativeAppleUser(auth);
  }
  return webProviderSignIn(auth, appleProvider());
}

export async function firebaseDeleteAccount() {
  const auth = await getFirebaseAuth();
  const current = auth.currentUser;
  if (!current) throw new Error('Sign in again before deleting this account.');
  try {
    await deleteUser(current);
  } catch (err) {
    if (err?.code === 'auth/requires-recent-login') {
      throw new Error('Sign out, sign back in, and delete the account again.');
    }
    throw new Error(firebaseErrorMessage(err));
  }
}

export async function firebaseSignOut() {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        await FirebaseAuthentication.signOut({ skipNativeAuth: true });
      } catch {
        // Plugin may not be ready on first launch.
      }
    }
    const auth = await getFirebaseAuth();
    await signOut(auth);
  } catch {
    // Already signed out or Firebase is not configured.
  }
}

function workerOrigin() {
  return String(APP_CONFIG.workerUrl || '').replace(/\/$/, '');
}

export function passwordResetContinueUrl() {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return `${origin}/#/account/signin`;
    }
  }
  const worker = workerOrigin();
  return worker ? `${worker}/open-app` : '';
}

function isResetLinkDomainError(err) {
  return err?.code === 'auth/invalid-hosting-link-domain'
    || err?.code === 'auth/unauthorized-continue-uri'
    || err?.code === 'auth/invalid-continue-uri';
}

export async function firebaseResetPassword(email) {
  const auth = await getFirebaseAuth();
  const trimmed = email.trim();
  const continueUrl = passwordResetContinueUrl();
  if (!continueUrl) {
    await sendPasswordResetEmail(auth, trimmed);
    return;
  }
  const worker = workerOrigin();
  const settings = { handleCodeInApp: false, url: continueUrl };
  if (worker) settings.linkDomain = new URL(worker).host;

  const send = (next) => sendPasswordResetEmail(auth, trimmed, next);
  try {
    await send(settings);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      throw new Error('No account exists with that email.');
    }
    if (!isResetLinkDomainError(err)) throw err;
    const withoutDomain = { ...settings };
    delete withoutDomain.linkDomain;
    try {
      await send(withoutDomain);
    } catch (retryErr) {
      if (retryErr?.code === 'auth/user-not-found') {
        throw new Error('No account exists with that email.');
      }
      if (!isResetLinkDomainError(retryErr)) throw retryErr;
      await sendPasswordResetEmail(auth, trimmed);
    }
  }
}

export async function firebaseVerifyResetCode(oobCode) {
  const auth = await getFirebaseAuth();
  return verifyPasswordResetCode(auth, oobCode);
}

export async function firebaseConfirmResetPassword(oobCode, newPassword) {
  const auth = await getFirebaseAuth();
  await confirmPasswordReset(auth, oobCode, newPassword);
}

export function firebaseHasPasswordProvider(user) {
  return Array.isArray(user?.providerData)
    && user.providerData.some((provider) => provider.providerId === 'password');
}

export async function firebaseChangePassword(currentPassword, newPassword) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user?.email) {
    throw new Error('Sign in with email to change your password.');
  }
  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  } catch (err) {
    if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
      throw new Error('Current password is wrong.');
    }
    throw err;
  }
}

export async function getIdToken(forceRefresh = false) {
  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return '';
  return user.getIdToken(forceRefresh);
}

export async function listenFirebaseUser(callback) {
  const auth = await getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export function firebaseErrorMessage(err, provider) {
  const code = err?.code || '';
  const message = String(err?.message || '');
  const who = provider || 'Google';
  if (code === 'auth/email-already-in-use') return 'That email already has an account.';
  if (code === 'auth/invalid-email') return 'Enter a valid email.';
  if (code === 'auth/weak-password') return 'Use at least 6 characters.';
  if (code === 'auth/requires-recent-login') return 'Enter your current password again.';
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Email or password is wrong.';
  }
  if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
    return 'This reset link expired or was already used. Request a new one.';
  }
  if (code === 'auth/too-many-requests') return 'Too many tries. Wait a minute and try again.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection.';
  if (
    code === 'auth/popup-closed-by-user'
    || code === 'auth/cancelled-popup-request'
    || code === '1001'
    || /canceled|cancelled|AuthorizationError error 1001/i.test(message)
  ) {
    return `${who} sign-in was closed.`;
  }
  if (code === 'auth/popup-blocked') return `Allow popups to sign in with ${who}.`;
  if (code === 'auth/operation-not-allowed') {
    return `Turn on ${who} sign-in in Firebase Authentication → Sign-in method.`;
  }
  if (code === 'auth/missing-or-invalid-nonce') return 'Apple sign-in could not be verified. Try again.';
  if (code === 'auth/unauthorized-domain') {
    if (Capacitor.isNativePlatform() && window.location.protocol === 'capacitor:') {
      return 'Google sign-in could not open inside the app. Try again.';
    }
    return 'Add this site to Firebase Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'That email already has an account. Sign in with the method you used first.';
  }
  return err?.message || 'Could not sign in.';
}
