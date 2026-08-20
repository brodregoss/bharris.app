import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

/**
 * Lightweight auth provider for standalone development.
 * Base44 platform auth is not used — the app runs without login.
 * AI features still call Base44 via base44Client + .env.local.
 */
export const AuthProvider = ({ children }) => {
  const value = {
    user: null,
    isAuthenticated: false,
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    authError: null,
    appPublicSettings: null,
    authChecked: true,
    logout: () => {},
    navigateToLogin: () => {},
    checkUserAuth: async () => {},
    checkAppState: async () => {},
  };

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
