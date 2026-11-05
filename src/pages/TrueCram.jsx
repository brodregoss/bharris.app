import React from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PartnerCockpit from '@/components/study/PartnerCockpit';
import { continueStudyPath, normalizeStudyMode, STUDY_MODE } from '@/lib/studyUtils';
import {
  currentCategoryName,
  gradeTrueCram,
  initTrueCramState,
  jumpToTerm,
  passLabel,
  startFlaggedPass,
} from '@/lib/trueCram';
import { loadSession, saveSession, saveFinishedSession, clearSession } from '@/lib/sessionStore';
import { getActiveUid } from '@/lib/userStorage';
import { withInferredMastery } from '@/lib/mastery';
import { logProductEvent } from '@/lib/productEvents';

function hydrate(location) {
  const ownerUid = getActiveUid();
  const { terms: rawTerms, setup: incomingSetup, sessionId } = location.state || {};
  if (rawTerms?.length) {
    const existing = loadSession();
    const trueCram = existing?.trueCram || initTrueCramState(rawTerms);
    return {
      id: sessionId || existing?.id,
      ownerUid,
      terms: rawTerms,
      setup: incomingSetup,
      trueCram,
      title: incomingSetup?.title || existing?.title,
      noteId: existing?.noteId || null,
    };
  }
  const saved = loadSession();
  if (saved?.terms?.length) {
    return {
      id: saved.id,
      ownerUid,
      terms: saved.terms,
      setup: saved.setup,
      trueCram: saved.trueCram || initTrueCramState(saved.terms),
      title: saved.title || saved.setup?.title,
      noteId: saved.noteId || null,
    };
  }
  return null;
}

export default function TrueCram() {
  const location = useLocation();
  const navigate = useNavigate();
  const [init] = React.useState(() => hydrate(location));
  const [terms, setTerms] = React.useState(() => init?.terms || []);
  const [trueCram, setTrueCram] = React.useState(() => init?.trueCram || initTrueCramState([]));
  const sessionIdRef = React.useRef(init?.id);
  const setup = init?.setup;

  React.useEffect(() => {
    if (!init) return;
    if (getActiveUid() !== init.ownerUid) {
      navigate('/', { replace: true });
      return;
    }
    const saved = saveSession({
      id: sessionIdRef.current,
      setup,
      terms,
      phase: trueCram.phase,
      trueCram,
      flaggedTermIds: trueCram.flaggedTermIds,
      coveredIds: trueCram.coveredIds || [],
      title: init.title || setup?.title,
      noteId: init.noteId || null,
    });
    if (saved?.id) sessionIdRef.current = saved.id;
  }, [init, setup, terms, trueCram, navigate]);

  const byId = React.useMemo(() => {
    const map = new Map(terms.map((t) => [t.id, t]));
    return map;
  }, [terms]);

  if (!init) return <Navigate to="/" replace />;
  if (normalizeStudyMode(setup?.studyMode) !== STUDY_MODE.TRUE_CRAM) {
    return <Navigate to={continueStudyPath(setup)} replace />;
  }

  const queueItems = (trueCram.queue || []).map((id) => byId.get(id)).filter(Boolean);
  const current = queueItems[trueCram.queueIndex];
  const totalCount = terms.length;
  const coveredCount = (trueCram.coveredIds || []).length;

  const markTerm = (correct) => {
    if (!current) return;
    setTerms((prev) =>
      prev.map((t) =>
        t.id === current.id
          ? {
              ...t,
              seen: true,
              correctStreak: correct ? (t.correctStreak || 0) + 1 : 0,
              recallHistory: [...(t.recallHistory || []), { result: correct ? 'got' : 'missed', at: Date.now() }],
            }
          : t
      )
    );
    setTrueCram((prev) => gradeTrueCram(prev, correct));
  };

  const finishSession = () => {
    logProductEvent('cram_finished', {
      feature: STUDY_MODE.TRUE_CRAM,
      detail: sessionIdRef.current || '',
    });
    saveFinishedSession({
      id: sessionIdRef.current,
      terms: withInferredMastery(terms),
      setup,
      title: setup?.title,
      flaggedTermIds: trueCram.flaggedTermIds,
      coveredIds: trueCram.coveredIds || [],
      trueCram,
      finishedAt: Date.now(),
    });
    clearSession();
    navigate('/');
  };

  const openSelfPractice = () => {
    navigate('/practice', { state: { wholeSet: true } });
  };

  const restartDeck = () => {
    setTrueCram(initTrueCramState(terms));
  };

  if (trueCram.phase === 'fork') {
    const flagged = trueCram.flaggedTermIds?.length || 0;
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="px-3 pt-safe pb-2">
          <Link
            to="/"
            aria-label="Home"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground shrink-0 hover:bg-primary/90 transition"
          >
            <Home className="w-4 h-4" />
          </Link>
        </header>
        <main className="flex-1 px-6 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <h1 className="text-2xl font-bold tracking-tight">Deck covered</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {flagged
                ? `${flagged} term${flagged === 1 ? '' : 's'} flagged from misses. Go over them again with your partner, or practice on your own.`
                : 'No misses to flag. You can head home or keep practicing the full set.'}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              {flagged > 0 ? (
                <div className="flex gap-3">
                  <Button
                    className="h-14 flex-1 min-w-0 rounded-full text-sm font-semibold px-2"
                    onClick={() => setTrueCram((prev) => startFlaggedPass(prev))}
                  >
                    Practice missed
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-14 flex-1 min-w-0 rounded-full text-sm font-semibold px-2"
                    onClick={openSelfPractice}
                  >
                    Self practice
                  </Button>
                </div>
              ) : (
                <Button
                  className="h-14 rounded-full text-base font-semibold"
                  onClick={openSelfPractice}
                >
                  Self practice
                </Button>
              )}
              <Button
                variant="outline"
                className="h-14 rounded-full text-base font-semibold"
                onClick={finishSession}
              >
                Done
              </Button>
              <button
                type="button"
                onClick={restartDeck}
                className="pt-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition"
              >
                Restart
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col overflow-hidden px-safe">
      <PartnerCockpit
        categories={trueCram.categories || []}
        termsById={byId}
        currentId={current?.id}
        flaggedTermIds={trueCram.flaggedTermIds || []}
        coveredIds={trueCram.coveredIds || []}
        categoryName={currentCategoryName(trueCram)}
        passLabel={passLabel(trueCram.pass)}
        coveredCount={coveredCount}
        totalCount={totalCount}
        onJumpToTerm={(id) => setTrueCram((prev) => jumpToTerm(prev, id))}
        onGotIt={() => markTerm(true)}
        onMissed={() => markTerm(false)}
      />
    </div>
  );
}
