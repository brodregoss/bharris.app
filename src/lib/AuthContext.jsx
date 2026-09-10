import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createAccount as createStoredAccount,
  getCurrentUser,
  listAccounts as storeListAccounts,
  refreshUser,
  setAccountLimit as storeSetAccountLimit,
  signIn as storeSignIn,
  signOut as storeSignOut,
  subscribeAccount,
} from '@/lib/accountStore';
import { closeAdminGate } from '@/lib/adminGate';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getCurrentUser());
  const [isLoadingAuth, setIsLoadingAuth] = useState(() => !!getCurrentUser());

  useEffect(() => subscribeAccount(() => setUser(getCurrentUser())), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getCurrentUser()) {
        setIsLoadingAuth(false);
        return;
      }
      await refreshUser();
      if (!cancelled) setIsLoadingAuth(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => {
    const refresh = () => setUser(getCurrentUser());
    return {
      user,
      isAuthenticated: !!user,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      authChecked: !isLoadingAuth,
      logout: () => {
        closeAdminGate();
        storeSignOut();
        refresh();
      },
      navigateToLogin: () => {},
      checkUserAuth: async () => refresh(),
      checkAppState: async () => {},
      signIn: async (email, password) => {
        const next = await storeSignIn(email, password);
        setUser(next);
        return next;
      },
      createAccount: async (email, password) => {
        const next = await createStoredAccount(email, password);
        setUser(next);
        return next;
      },
      listAccounts: () => storeListAccounts(),
      setAccountLimit: async (email, options) => {
        const next = await storeSetAccountLimit(email, options);
        refresh();
        return next;
      },
    };
  }, [user, isLoadingAuth]);

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
