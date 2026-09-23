import { initializeApp, getApps } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
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
import { Capacitor } from '@capacitor/core';
import { formatPersonName } from '@/lib/personName';
import { APP_CONFIG, firebaseConfigured } from '@/lib/appConfig';

let authPromise;

function isIosBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function firebaseAppConfig() {
  const config = { ...APP_CONFIG.firebase };
  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform() && isIosBrowser()) {
    config.authDomain = window.location.host;
  }
  return config;
}

export function getFirebaseAuth() {
  if (!firebaseConfigured()) {
    throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values and reload.');
  }
  if (authPromise) return authPromise;
  authPromise = (async () => {
    const app = getApps()[0] || initializeApp(firebaseAppConfig());
    if (Capacitor.isNativePlatform()) {
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

async function webProviderSignIn(auth, provider) {
  if (isIosBrowser()) {
    await signInWithRedirect(auth, provider);
    await new Promise(() => {});
  }
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function finishRedirectSignIn() {
  if (Capacitor.isNativePlatform() || !isIosBrowser()) return null;
  const auth = await getFirebaseAuth();
  try {
    await getRedirectResult(auth);
    return null;
  } catch (err) {
    return firebaseErrorMessage(err);
  }
}

export async function firebaseSignInWithGoogle() {
  const auth = await getFirebaseAuth();
  if (Capacitor.isNativePlatform()) {
    return nativeGoogleUser(auth);
  }
  return webProviderSignIn(auth, googleProvider());
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

export function passwordResetContinueUrl() {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return `${origin}/`;
    }
  }
  return 'https://enthusiastic-cram-genius-flow.base44.app/';
}

export async function firebaseResetPassword(email) {
  const auth = await getFirebaseAuth();
  const trimmed = email.trim();
  try {
    await sendPasswordResetEmail(auth, trimmed, {
      url: passwordResetContinueUrl(),
      handleCodeInApp: false,
    });
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      throw new Error('No account exists with that email.');
    }
    if (err?.code === 'auth/unauthorized-continue-uri' || err?.code === 'auth/invalid-continue-uri') {
      await sendPasswordResetEmail(auth, trimmed);
      return;
    }
    throw err;
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
    return 'Add this site to Firebase Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'That email already has an account. Sign in with the method you used first.';
  }
  return err?.message || 'Could not sign in.';
}
