import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Landing from './pages/Landing';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import CreateNotes from './pages/CreateNotes';
import UploadNotes from './pages/UploadNotes';
import Triage from './pages/Triage';
import StudyFlow from './pages/StudyFlow';
import PanicReview from './pages/PanicReview';
import PastSessions from './pages/PastSessions';
import Settings from './pages/Settings';
import { DebugProvider } from '@/lib/DebugContext';
import DebugPanel from '@/components/dev/DebugPanel';
import LaunchCountdown from '@/components/LaunchCountdown';


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <DebugProvider>
          <Router>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/setup" element={<Home />} />
              <Route path="/create-notes" element={<CreateNotes />} />
              <Route path="/history" element={<PastSessions />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/upload-notes" element={<UploadNotes />} />
              <Route path="/triage" element={<Triage />} />
              <Route path="/study" element={<StudyFlow />} />
              <Route path="/panic" element={<PanicReview />} />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
            <DebugPanel />
            <LaunchCountdown />
          </Router>
          <Toaster />
        </DebugProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App