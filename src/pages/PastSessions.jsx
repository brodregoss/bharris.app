import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listRemoteSessions, loadFinishedSession, loadRemoteSession } from '@/lib/sessionStore';

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PastSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = React.useState(() => {
    const finished = loadFinishedSession();
    return finished ? [{
      id: finished.id || 'local-finished',
      title: finished.setup?.title || finished.terms?.[0]?.term || 'Last cram',
      term_count: finished.terms?.length || 0,
      finished_at: finished.finishedAt,
      status: 'finished',
    }] : [];
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await listRemoteSessions();
        if (!cancelled && remote.length) setSessions(remote);
      } catch {
        // Keep the local finished snapshot if the Worker is unreachable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-1 px-3 pt-safe pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold tracking-tight">Past sessions</h1>
      </header>
      {loading && !sessions.length ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
        </div>
      ) : sessions.length ? (
        <div className="flex-1 overflow-y-auto px-5 pb-safe">
          <div className="max-w-md mx-auto w-full divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={async () => {
                  try {
                    const full = await loadRemoteSession(session.id);
                    if (full?.terms?.length) {
                      navigate('/practice', { state: { session: full, kind: 'history' } });
                      return;
                    }
                  } catch {
                    // Fall through to the local snapshot.
                  }
                  navigate('/practice');
                }}
                className="w-full text-left px-5 py-4 hover:bg-accent/60 transition"
              >
                <p className="text-sm font-semibold truncate">{session.title || 'Cram'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {session.term_count || 0} terms
                  {session.status ? ` · ${session.status}` : ''}
                  {formatWhen(session.finished_at || session.updated_at) ? ` · ${formatWhen(session.finished_at || session.updated_at)}` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <History className="w-8 h-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No past sessions yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Completed crams will show up here.</p>
        </div>
      )}
    </div>
  );
}
