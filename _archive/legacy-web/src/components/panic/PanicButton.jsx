import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { loadSession } from '@/lib/sessionStore';

// Persistent panic button — visible on every screen once a session with terms
// exists. Low visual weight (muted dark pill, bottom-left) but easy to find
// under pressure. Hidden on the panic page itself.
export default function PanicButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const [hasTerms, setHasTerms] = React.useState(false);

  const check = React.useCallback(() => {
    setHasTerms(!!loadSession());
  }, []);

  React.useEffect(() => {
    check();
    window.addEventListener('lms:session', check);
    return () => window.removeEventListener('lms:session', check);
  }, [check]);

  // Re-check on every route change (covers first save timing).
  React.useEffect(() => {
    check();
  }, [location.pathname, check]);

  if (!hasTerms || location.pathname === '/panic' || location.pathname === '/') return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/panic')}
      aria-label="Test is now — panic review"
      className="fixed z-[60] bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-4 flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-3.5 py-2 text-[11px] font-bold shadow-lg opacity-80 hover:opacity-100 transition active:scale-95"
    >
      <Zap className="w-3.5 h-3.5 text-rose-400" />
      Test is now
    </button>
  );
}