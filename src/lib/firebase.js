import { initializeApp, getApps } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { APP_CONFIG, firebaseConfigured } from '@/lib/appConfig';

let authPromise;

export function getFirebaseAuth() {
  if (!firebaseConfigured()) {
    throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values and reload.');
  }
  if (authPromise) return authPromise;
  authPromise = (async () => {
    const app = getApps()[0] || initializeApp(APP_CONFIG.firebase);
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

export async function firebaseCreateAccount(email, password) {
  const auth = await getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function firebaseSignIn(email, password) {
  const auth = await getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function firebaseSignInWithGoogle() {
  const auth = await getFirebaseAuth();
  if (Capacitor.isNativePlatform()) {
    return nativeGoogleUser(auth);
  }
  const cred = await signInWithPopup(auth, googleProvider());
  return cred.user;
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

export function firebaseErrorMessage(err) {
  const code = err?.code || '';
  const message = String(err?.message || '');
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
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Google sign-in was closed.';
  }
  if (code === 'auth/popup-blocked') return 'Allow popups to sign in with Google.';
  if (code === 'auth/operation-not-allowed') {
    return 'Turn on Google sign-in in Firebase Authentication → Sign-in method.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Add this site to Firebase Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'That email already has an account. Sign in with email, then you can use Google next time.';
  }
  if (/canceled|cancelled/i.test(message)) return 'Google sign-in was closed.';
  return err?.message || 'Could not sign in.';
}
