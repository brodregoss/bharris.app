import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { afterAuthPath } from '@/lib/onboarding';

export default function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const from = location.state?.from;

  if (isAuthenticated) {
    return <Navigate to={from && from !== '/account' ? from : afterAuthPath()} replace />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-safe text-center">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">Welcome To</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mt-2 leading-[1.05]">
          Last Minute Study
        </h1>
        <p className="text-base text-muted-foreground mt-4">Sign in or create an account</p>
      </div>

      <footer className="px-6 pb-safe pt-4">
        <div className="max-w-md mx-auto w-full flex flex-col gap-3">
          <Button
            onClick={() => navigate('/account/create')}
            className="h-16 rounded-2xl text-lg font-bold shadow-lg"
          >
            Create an account
            <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/account/signin')}
            className="h-14 rounded-2xl text-base font-semibold"
          >
            Sign in
          </Button>
        </div>
      </footer>
    </div>
  );
}
