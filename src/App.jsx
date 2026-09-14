import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import NativeChrome from '@/components/NativeChrome';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Landing from './pages/Landing';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import CreateNotes from './pages/CreateNotes';
import ReviewNotes from './pages/ReviewNotes';
import UploadNotes from './pages/UploadNotes';
import Triage from './pages/Triage';
import StudyFlow from './pages/StudyFlow';
import PanicReview from './pages/PanicReview';
import PastSessions from './pages/PastSessions';
import Settings from './pages/Settings';
import Practice from './pages/Practice';
import Account from './pages/Account';
import RequireAccount from '@/components/RequireAccount';
import { DebugProvider } from '@/lib/DebugContext';
import DebugPanel from '@/components/dev/DebugPanel';


function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="lms-theme">
      <NativeChrome />
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <DebugProvider>
            <Router>
              <ScrollToTop />
              <Routes>
                <Route path="/account" element={<Account />} />
                <Route path="/account/signin" element={<Navigate to="/account" replace />} />
                <Route path="/account/create" element={<Navigate to="/account" replace />} />
                <Route element={<RequireAccount />}>
                  <Route path="/" element={<Landing />} />
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/setup" element={<Home />} />
                  <Route path="/create-notes" element={<CreateNotes />} />
                  <Route path="/review-notes" element={<ReviewNotes />} />
                  <Route path="/history" element={<PastSessions />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/accounts" element={<Navigate to="/settings" replace />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/upload-notes" element={<UploadNotes />} />
                  <Route path="/triage" element={<Triage />} />
                  <Route path="/study" element={<StudyFlow />} />
                  <Route path="/panic" element={<PanicReview />} />
                  <Route path="*" element={<PageNotFound />} />
                </Route>
              </Routes>
              <DebugPanel />
            </Router>
            <Toaster />
          </DebugProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
