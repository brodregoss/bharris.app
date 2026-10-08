import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { useEffect, useState } from 'react';
import { HashRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import NativeChrome from '@/components/NativeChrome';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Landing from './pages/Landing';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import CreateNotes from './pages/CreateNotes';
import HighlightNotes from './pages/HighlightNotes';
import ReviewNotes from './pages/ReviewNotes';
import UploadNotes from './pages/UploadNotes';
import Triage from './pages/Triage';
import StudyFlow from './pages/StudyFlow';
import StudyMode from './pages/StudyMode';
import TrueCram from './pages/TrueCram';
import SpacedCram from './pages/SpacedCram';
import PanicReview from './pages/PanicReview';
import PastSessions from './pages/PastSessions';
import Settings from './pages/Settings';
import ManagePlan from './pages/ManagePlan';
import Practice from './pages/Practice';
import Account from './pages/Account';
import AccountCreate from './pages/AccountCreate';
import AccountSignIn from './pages/AccountSignIn';
import ForgotPassword from './pages/ForgotPassword';
import AccountResetPassword from './pages/AccountResetPassword';
import LegalDocument from './pages/LegalDocument';
import VideoPreview from './pages/VideoPreview';
import RequireAccount from '@/components/RequireAccount';
import { PaywallProvider } from '@/lib/PaywallContext';
import { DebugProvider } from '@/lib/DebugContext';
import DebugPanel from '@/components/dev/DebugPanel';
import { devToolsUnlocked } from '@/lib/devToolsLock';
import PageTransition from '@/components/PageTransition';
import { clearStaleAuthReturn } from '@/lib/onboarding';

function DevToolsGate() {
  const [unlocked, setUnlocked] = useState(devToolsUnlocked);
  useEffect(() => {
    const sync = () => setUnlocked(devToolsUnlocked());
    window.addEventListener('bharris-dev-tools', sync);
    window.addEventListener('lms:session', sync);
    return () => {
      window.removeEventListener('bharris-dev-tools', sync);
      window.removeEventListener('lms:session', sync);
    };
  }, []);
  if (!unlocked) return null;
  return <DebugPanel />;
}

function AuthReturnScope() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith('/account') && pathname !== '/terms' && pathname !== '/privacy') {
      clearStaleAuthReturn();
    }
  }, [pathname]);
  return null;
}

function AppRoutes({ location }) {
  return (
    <Routes location={location}>
      <Route path="/account" element={<Account />} />
      <Route path="/account/signin" element={<AccountSignIn />} />
      <Route path="/account/create" element={<AccountCreate />} />
      <Route path="/account/forgot" element={<ForgotPassword />} />
      <Route path="/account/reset" element={<AccountResetPassword />} />
      <Route path="/terms" element={<LegalDocument doc="terms" />} />
      <Route path="/privacy" element={<LegalDocument doc="privacy" />} />
      <Route element={<RequireAccount />}>
        <Route path="/" element={<Landing />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/setup" element={<Home />} />
        <Route path="/study-mode" element={<StudyMode />} />
        <Route path="/create-notes" element={<CreateNotes />} />
        <Route path="/highlight-notes" element={<HighlightNotes />} />
        <Route path="/review-notes" element={<ReviewNotes />} />
        <Route path="/history" element={<PastSessions />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/manage" element={<ManagePlan />} />
        <Route path="/settings/accounts" element={<Navigate to="/settings" replace />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/upload-notes" element={<UploadNotes />} />
        <Route path="/triage" element={<Triage />} />
        <Route path="/study" element={<StudyFlow />} />
        <Route path="/true-cram" element={<TrueCram />} />
        <Route path="/spaced-cram" element={<SpacedCram />} />
        <Route path="/panic" element={<PanicReview />} />
        <Route path="/dev/video" element={<VideoPreview />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="bharris-theme">
      <NativeChrome />
      <AuthProvider>
        <PaywallProvider>
        <QueryClientProvider client={queryClientInstance}>
          <DebugProvider>
            <Router>
              <ScrollToTop />
              <AuthReturnScope />
              <PageTransition>
                {(location) => <AppRoutes location={location} />}
              </PageTransition>
              <DevToolsGate />
            </Router>
            <Toaster />
          </DebugProvider>
        </QueryClientProvider>
        </PaywallProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
