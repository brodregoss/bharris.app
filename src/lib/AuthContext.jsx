import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  subscribeAccount,
  ensureCloudUser,
  refreshUser,
  cacheUser,
  clearAccountCache,
  deleteCloudAccount,
} from '@/lib/accountStore';
import {
  firebaseCreateAccount,
  firebaseErrorMessage,
  firebaseSignIn,
  adoptNativeGoogleHandoff,
  firebaseSignInWithApple,
  firebaseSignInWithGoogle,
  firebaseDeleteAccount,
  firebaseSignOut,
  finishRedirectSignIn,
  listenFirebaseUser,
  shouldStartHostedGoogleSignIn,
} from '@/lib/firebase';
import { firebaseConfigured } from '@/lib/appConfig';
import { cancelPendingCloudSave, hydrateRemoteSession } from '@/lib/sessionStore';
import { configurePurchases, logOutPurchases } from '@/lib/premiumAccess';
import { closeAdminGate } from '@/lib/adminGate';
import { clearAccountLocalData, getActiveUid } from '@/lib/userStorage';
import { formatPersonName } from '@/lib/personName';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getCurrentUser());
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => subscribeAccount(() => setUser(getCurrentUser())), []);

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;
    const watchdog = setTimeout(() => {
      if (!cancelled) setIsLoadingAuth(false);
    }, 8000);
    (async () => {
      if (!firebaseConfigured()) {
        setAuthError('Add Firebase config to .env.local to sign in.');
        setIsLoadingAuth(false);
        return;
      }
      try {
        const handoff = await adoptNativeGoogleHandoff();
        if (cancelled) return;
        if (handoff === 'cancelled') setAuthError('Google sign-in was closed.');
        const redirectError = await finishRedirectSignIn();
        if (cancelled) return;
        if (redirectError) setAuthError(redirectError);
        if (shouldStartHostedGoogleSignIn()) {
          await firebaseSignInWithGoogle();
          return;
        }
        unsubscribe = await listenFirebaseUser(async (next) => {
          clearTimeout(watchdog);
          setFirebaseUser(next || null);
          if (!next) {
            cancelPendingCloudSave();
            clearAccountCache();
            setUser(null);
            setIsLoadingAuth(false);
            return;
          }
          try {
            const cloud = await ensureCloudUser(next);
            setUser(cloud);
            setAuthError(null);
            configurePurchases(next.uid).catch(() => {});
            if (!cancelled) setIsLoadingAuth(false);
            hydrateRemoteSession().catch(() => {});
          } catch (err) {
            const cached = getCurrentUser();
            if (!cached || cached.uid !== next.uid) {
              clearAccountCache();
              setUser(null);
            }
            setAuthError(err instanceof Error ? err.message : 'Could not reach the study server.');
          } finally {
            if (!cancelled) setIsLoadingAuth(false);
          }
        });
      } catch (err) {
        if (!cancelled) {
          setAuthError(err instanceof Error ? err.message : 'Firebase is not ready.');
          setIsLoadingAuth(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    const refresh = async () => {
      const next = await refreshUser();
      setUser(next);
      return next;
    };
    const retryCloud = async () => {
      if (!firebaseUser) return null;
      setIsLoadingAuth(true);
      setAuthError(null);
      try {
        const cloud = await ensureCloudUser(firebaseUser);
        setUser(cloud);
        configurePurchases(firebaseUser.uid).catch(() => {});
        hydrateRemoteSession().catch(() => {});
        return cloud;
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Could not reach the study server.');
        throw err;
      } finally {
        setIsLoadingAuth(false);
      }
    };
    const logout = async () => {
      cancelPendingCloudSave();
      closeAdminGate();
      await logOutPurchases();
      await firebaseSignOut();
      clearAccountCache();
      setUser(null);
    };
    const deleteAccount = async () => {
      const uid = firebaseUser?.uid || user?.uid || getActiveUid();
      cancelPendingCloudSave();
      await deleteCloudAccount();
      await firebaseDeleteAccount();
      closeAdminGate();
      await logOutPurchases();
      clearAccountLocalData(uid);
      await firebaseSignOut();
      clearAccountCache();
      setUser(null);
    };
    return {
      user,
      firebaseUser,
      isAuthenticated: !!user && !!firebaseUser,
      isAdmin: !!user?.isAdmin,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked: !isLoadingAuth,
      logout,
      deleteAccount,
      lock: logout,
      navigateToLogin: () => {},
      checkUserAuth: refresh,
      retryCloud,
      checkAppState: async () => {},
      createAccount: async (email, password, displayName) => {
        try {
          const name = formatPersonName(displayName);
          const fbUser = await firebaseCreateAccount(email, password, name);
          const cloud = await ensureCloudUser({
            email: fbUser.email,
            displayName: fbUser.displayName || name,
          });
          cacheUser(cloud);
          setUser(cloud);
          setAuthError(null);
          configurePurchases(fbUser.uid).catch(() => {});
          hydrateRemoteSession().catch(() => {});
          return cloud;
        } catch (err) {
          throw new Error(firebaseErrorMessage(err));
        }
      },
      signIn: async (email, password) => {
        try {
          const fbUser = await firebaseSignIn(email, password);
          const cloud = await ensureCloudUser(fbUser);
          cacheUser(cloud);
          setUser(cloud);
          setAuthError(null);
          configurePurchases(fbUser.uid).catch(() => {});
          hydrateRemoteSession().catch(() => {});
          return cloud;
        } catch (err) {
          throw new Error(firebaseErrorMessage(err));
        }
      },
      signInWithGoogle: async () => {
        try {
          const fbUser = await firebaseSignInWithGoogle();
          if (!fbUser) return null;
          const cloud = await ensureCloudUser(fbUser);
          cacheUser(cloud);
          setUser(cloud);
          setAuthError(null);
          configurePurchases(fbUser.uid).catch(() => {});
          hydrateRemoteSession().catch(() => {});
          return cloud;
        } catch (err) {
          throw new Error(firebaseErrorMessage(err, 'Google'));
        }
      },
      signInWithApple: async () => {
        try {
          const fbUser = await firebaseSignInWithApple();
          if (!fbUser) return null;
          const cloud = await ensureCloudUser(fbUser);
          cacheUser(cloud);
          setUser(cloud);
          setAuthError(null);
          configurePurchases(fbUser.uid).catch(() => {});
          hydrateRemoteSession().catch(() => {});
          return cloud;
        } catch (err) {
          throw new Error(firebaseErrorMessage(err, 'Apple'));
        }
      },
    };
  }, [user, firebaseUser, isLoadingAuth, authError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
