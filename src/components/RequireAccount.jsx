import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { accountRedirect } from '@/lib/accountGate';
import { devSampleOpen } from '@/lib/devSampleGate';

export default function RequireAccount() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const dest = accountRedirect({
    authenticated: isAuthenticated,
    dev: import.meta.env.DEV === true,
    sampleOpen: import.meta.env.DEV === true && devSampleOpen(),
  });
  if (dest) {
    return <Navigate to={dest} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
