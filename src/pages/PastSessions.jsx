import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, History, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { listRemoteSessions, loadPracticeSource, loadFinishedSession, loadRemoteSession, deleteRemoteSession, clearFinishedSession, loadSession, loadLatestCram, beginSession } from '@/lib/sessionStore';
import { continueStudyPath, trueCramPracticeState } from '@/lib/studyUtils';
import { listNotes, parseNoteTerms, deleteNote } from '@/lib/notesUpload';
import { useAuth } from '@/lib/AuthContext';
import { planLabel, sessionLimitForUser } from '@/lib/plans';

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function sessionTitle(session) {
  return session.title || session.setup?.title || session.terms?.[0]?.term || 'Cram';
}

function toListItem(session, { current = false, currentKind = null } = {}) {
  if (!session) return null;
  const kind = currentKind || (current ? 'active' : null);
  return {
    id: session.id || (kind === 'finished' ? 'local-finished' : current ? 'local-current' : 'local-finished'),
    title: sessionTitle(session),
    term_count: session.term_count || session.terms?.length || 0,
    finished_at: session.finished_at || session.finishedAt,
    updated_at: session.updated_at || session.savedAt,
    status: kind === 'active' ? 'active' : (session.status || 'finished'),
    current,
    currentKind: kind,
    kind: 'session',
    noteId: session.note_id || session.noteId || null,
  };
}

function currentSourceItem() {
  const source = loadPracticeSource();
  if (!source?.session) return null;
  return toListItem(source.session, { current: true, currentKind: source.kind });
}

async function resolveFullSession(session) {
  if (session?.kind === 'note' && session.terms?.length) {
    return {
      id: session.noteId,
      title: session.title,
      terms: session.terms,
      noteId: session.noteId,
    };
  }
  if (session?.id === 'local-finished' || session?.currentKind === 'finished') {
    const finished = loadFinishedSession();
    if (finished?.terms?.length) return finished;
  }
  if (session?.id && session.id !== 'local-finished' && session.id !== 'local-current') {
    try {
      const full = await loadRemoteSession(session.id);
      if (full?.terms?.length) return full;
    } catch {
      // Fall through to the local snapshot.
    }
  }
  const latest = loadPracticeSource()?.session;
  if (latest?.terms?.length && (!session?.id || latest.id === session.id)) return latest;
  return null;
}

function noteToListItem(note) {
  if (!note?.id) return null;
  const terms = parseNoteTerms(note);
  if (!terms.length) return null;
  const rawTitle = String(note.title || '').trim();
  if (!rawTitle || rawTitle === 'Untitled' || rawTitle === 'Your notes' || rawTitle === 'My notes') {
    return null;
  }
  return {
    id: `note:${note.id}`,
    noteId: note.id,
    title: rawTitle,
    term_count: terms.length,
    updated_at: note.updated_at || note.created_at,
    finished_at: null,
    status: 'saved',
    current: false,
    kind: 'note',
    sourceKind: note.kind === 'manual' ? 'manual' : 'photo',
    terms,
  };
}

function mergeHistory({ sessions = [], notes = [], cap }) {
  const current = currentSourceItem();
  const sessionItems = sessions.map((item) => toListItem(item)).filter(Boolean);
  const usedNoteIds = new Set(
    [current, ...sessionItems].map((item) => item?.noteId).filter(Boolean),
  );
  const noteItems = notes
    .map(noteToListItem)
    .filter(Boolean)
    .filter((item) => !usedNoteIds.has(item.noteId));
  const past = [...sessionItems, ...noteItems]
    .filter((item) => !current || item.id !== current.id)
    .sort((a, b) => {
      const aTime = new Date(a.updated_at || a.finished_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.finished_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, cap);
  return current ? [current, ...past] : past;
}

export default function PastSessions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cap = sessionLimitForUser(user);
  const [sessions, setSessions] = React.useState(() => {
    const finished = toListItem(loadFinishedSession());
    return mergeHistory({ sessions: finished ? [finished] : [], notes: [], cap });
  });
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(null);
  const [choice, setChoice] = React.useState(null);
  const [opening, setOpening] = React.useState(null);
  const [choiceError, setChoiceError] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState('');

  const refreshLocal = React.useCallback(() => {
    setSessions((prev) => {
      const current = currentSourceItem();
      const past = prev.filter((item) => !item.current && (!current || item.id !== current.id));
      const finished = toListItem(loadFinishedSession());
      const withFinished = finished
        && (!current || finished.id !== current.id)
        && !past.some((item) => item.id === finished.id)
        ? [finished, ...past]
        : past;
      return current ? [current, ...withFinished] : withFinished;
    });
  }, []);

  React.useEffect(() => {
    window.addEventListener('lms:session', refreshLocal);
    return () => window.removeEventListener('lms:session', refreshLocal);
  }, [refreshLocal]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [remote, notes] = await Promise.all([
          listRemoteSessions().catch(() => []),
          listNotes().catch(() => []),
        ]);
        if (!cancelled) {
          setSessions(mergeHistory({ sessions: remote, notes, cap }));
        }
      } catch {
        // Keep the local current + finished snapshot if the Worker is unreachable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cap]);

  const openSession = (session) => {
    if (session.current && session.currentKind === 'notes') {
      const notes = loadPracticeSource();
      navigate('/practice', notes?.session ? { state: { session: notes.session, kind: 'notes' } } : undefined);
      return;
    }
    if (session.current && session.currentKind !== 'finished') {
      navigate(continueStudyPath(loadSession()?.setup || session.setup));
      return;
    }
    setChoiceError('');
    setOpening(null);
    setChoice(session);
  };

  const startChoice = async (action) => {
    if (!choice || opening) return;
    setOpening(action);
    setChoiceError('');
    try {
      if (action === 'practice' && choice.current && choice.currentKind === 'finished') {
        const cram = trueCramPracticeState(loadLatestCram());
        navigate('/practice', cram ? { state: cram } : undefined);
        return;
      }
      const full = await resolveFullSession(choice);
      if (!full?.terms?.length) {
        setChoiceError('Couldn’t load those terms.');
        return;
      }
      if (action === 'practice') {
        const saved = beginSession({
          setup: full.setup || { title: full.title || choice.title },
          terms: full.terms,
          title: full.title || choice.title,
          noteId: full.noteId || full.note_id || choice.noteId || null,
          phase: full.phase || null,
          flaggedTermIds: full.flaggedTermIds || full.trueCram?.flaggedTermIds,
          coveredIds: full.coveredIds || full.trueCram?.coveredIds,
          trueCram: full.trueCram,
        });
        const session = saved?.terms?.length ? saved : full;
        const cram = trueCramPracticeState(session);
        navigate('/practice', {
          state: { session, kind: saved ? 'active' : 'history', ...(cram || {}) },
        });
        return;
      }
      navigate('/setup', {
        state: {
          source: {
            kind: choice.kind === 'note' ? (choice.sourceKind || 'manual') : 'manual',
            title: full.title || choice.title,
            items: full.terms,
            terms: full.terms.length,
            noteId: full.noteId || full.note_id || choice.noteId || null,
            returnTo: '/history',
          },
          setup: full.setup || undefined,
        },
      });
    } catch {
      setChoiceError('Couldn’t open that session.');
    } finally {
      setOpening(null);
    }
  };

  const pastCount = sessions.filter((session) => !session.current).length;

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    setError('');
    try {
      if (pending.kind === 'note') {
        await deleteNote(pending.noteId);
      } else if (pending.id === 'local-finished') {
        clearFinishedSession();
      } else {
        await deleteRemoteSession(pending.id);
      }
      setSessions((prev) => prev.filter((s) => s.id !== pending.id));
      setPending(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t delete that session.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-5 pt-safe">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back" className="-ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {loading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Loading sessions" />
          )}
        </div>
        <h1 className="mt-6 text-display text-foreground">Past sessions</h1>
      </header>
      <p className="px-5 mt-3 mb-1 text-sm text-muted-foreground">
        {loading && !sessions.length
          ? (user?.subscriptionTier === 'pro'
            ? `${planLabel(user)} keeps your last ${cap} crams.`
            : `Free keeps your last ${cap} crams. Oldest drop off.`)
          : `You have ${pastCount} of ${cap} past sessions. ${
              user?.subscriptionTier === 'pro'
                ? `${planLabel(user)} keeps your last ${cap} crams.`
                : 'Oldest drop off on Free.'
            }`}
      </p>
      {loading && !sessions.length ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
        </div>
      ) : sessions.length ? (
        <div className="flex-1 overflow-y-auto px-5 pb-safe">
          <div className="mx-auto w-full max-w-md space-y-2">
            {sessions.map((session) => {
              const when = session.currentKind === 'finished'
                ? 'Practice uses these'
                : formatWhen(session.finished_at || session.updated_at);
              const status = session.current
                ? (session.currentKind === 'finished' ? 'Current' : 'Open')
                : 'Saved';
              return (
                <div key={session.id} className="option-surface flex items-center rounded-card pr-1">
                  <button
                    type="button"
                    onClick={() => openSession(session)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{session.title || 'Cram'}</span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {session.term_count || 0} terms{when ? ` · ${when}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-base font-semibold tabular-nums">{session.term_count || 0}</span>
                      <span className={session.current ? 'block text-sm font-semibold text-gain' : 'block text-sm text-muted-foreground'}>
                        {status}
                      </span>
                    </span>
                  </button>
                  {!session.current && (
                    <button
                      type="button"
                      aria-label={`Delete ${session.title || 'cram'}`}
                      onClick={() => {
                        setError('');
                        setPending(session);
                      }}
                      className="ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {error ? <p className="text-sm text-destructive text-center mt-3">{error}</p> : null}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <History className="w-8 h-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No past sessions yet.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Your crams and custom sets will show up here.</p>
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && !deleting && setPending(null)}>
        <AlertDialogContent className="rounded-card max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this cram?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.title || 'This session'} will be removed from past sessions. You can’t get it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!choice}
        onOpenChange={(open) => {
          if (!open && !opening) {
            setChoice(null);
            setChoiceError('');
          }
        }}
      >
        <DialogContent className="rounded-card max-w-sm">
          <DialogHeader>
            <DialogTitle>Practice or cram?</DialogTitle>
            <DialogDescription>
              {choice?.title || 'This set'}
              {choice ? ` · ${choice.term_count || 0} terms` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <Button
              disabled={!!opening}
              onClick={() => startChoice('practice')}
              className="h-12 rounded-full font-semibold"
            >
              {opening === 'practice' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Practice
            </Button>
            <Button
              variant="secondary"
              disabled={!!opening}
              onClick={() => startChoice('cram')}
              className="h-12 rounded-full font-semibold"
            >
              {opening === 'cram' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Cram
            </Button>
            {choiceError ? <p className="text-sm text-destructive text-center pt-1">{choiceError}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
