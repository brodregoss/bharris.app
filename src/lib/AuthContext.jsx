import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  lockApp as storeLockApp,
  refreshUser,
  subscribeAccount,
  unlockWithPin as storeUnlock,
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
    const lock = () => {
      closeAdminGate();
      storeLockApp();
      refresh();
    };
    return {
      user,
      isAuthenticated: !!user,
      isAdmin: !!user?.isAdmin,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      authChecked: !isLoadingAuth,
      logout: lock,
      lock,
      navigateToLogin: () => {},
      checkUserAuth: async () => refresh(),
      checkAppState: async () => {},
      unlock: async (pin) => {
        const next = await storeUnlock(pin);
        setUser(next);
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
