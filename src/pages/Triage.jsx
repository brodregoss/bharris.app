import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tierFromDifficulty, confidenceFromTriage, normalizeExamType } from '@/lib/studyUtils';
import { Moon, Loader2, Check } from 'lucide-react';
import { invokeLlm } from '@/api/invokeLlm';
import { Button } from '@/components/ui/button';
import TriageCard from '@/components/triage/TriageCard';
import { saveSession } from '@/lib/sessionStore';

const TIERS = [
  { id: 'blank', label: 'Blank', sub: "Don't know", bg: '#FF8A8A' },
  { id: 'shaky', label: 'Shaky', sub: 'Kind of know', bg: '#FFC078' },
  { id: 'know_it', label: 'Know it', sub: 'Know it', bg: '#8CE99A' },
];

const COL_ORDER = ['blank', 'shaky', 'know_it'];
const MAX_TERMS = 15;

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealIntoColumns(terms) {
  return shuffle(terms).map((t, i) => ({
    ...t,
    tier: COL_ORDER[i % COL_ORDER.length],
  }));
}

function Triage() {
  const location = useLocation();
  const navigate = useNavigate();
  const source = location.state?.source;
  const setup = location.state?.setup;
  const sourceTitle = source?.title || 'Intro Psychology';

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [retryTick, setRetryTick] = React.useState(0);
  const [ranked, setRanked] = React.useState([]);
  const [dragOver, setDragOver] = React.useState(null);

  const lockIn = () => {
    if (!ranked.length) return;
    const studyTerms = ranked.map((t) => ({
      id: t.id,
      term: t.term,
      definition: t.definition,
      difficulty: t.difficulty,
      tier: tierFromDifficulty(t.difficulty, normalizeExamType(setup?.examType)),
      confidence: confidenceFromTriage(t.tier),
      depends_on: t.depends_on || [],
      recallHistory: [],
      correctStreak: 0,
      seen: false,
      testResult: null,
    }));
    saveSession({
      setup,
      terms: studyTerms,
      phase: 'notes_offer',
      blockStats: {},
      stillShaky: [],
      behind: false,
      stopTime: null,
      windDownAcknowledged: false,
      elapsedMs: 0,
      savedAt: Date.now(),
    });
    navigate('/study', { state: { terms: studyTerms, setup } });
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const cannedItems = source?.items || [];
      if (cannedItems.length) {
        const withIds = cannedItems.slice(0, MAX_TERMS).map((t, i) => ({
          term: t.term,
          definition: t.definition,
          difficulty: t.difficulty || 5,
          depends_on: t.depends_on || [],
          id: t.id || `t${i}`,
        }));
        setRanked(dealIntoColumns(withIds));
        setLoading(false);
        return;
      }

      const count = Math.min(source?.terms || 12, MAX_TERMS);
      try {
        const res = await invokeLlm({
          prompt: `You are building a last-minute study list for a student about to cram "${sourceTitle}". Generate exactly ${count} key terms/concepts a student must know for this exam. For each term provide: term (short name), definition (one concise sentence), difficulty (integer 1-10, 10 = hardest), depends_on (array of OTHER term names from your list that this concept builds upon). Return exactly ${count} terms.`,
          response_json_schema: {
            type: 'object',
            properties: {
              terms: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    term: { type: 'string' },
                    definition: { type: 'string' },
                    difficulty: { type: 'number' },
                    depends_on: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['term', 'definition', 'difficulty', 'depends_on'],
                },
              },
            },
            required: ['terms'],
          },
        });
        if (!mounted) return;
        const list = Array.isArray(res?.terms)
          ? res.terms
          : Array.isArray(res?.output?.terms)
            ? res.output.terms
            : Array.isArray(res)
              ? res
              : [];
        const raw = list.slice(0, count);
        if (!raw.length) throw new Error('empty terms');
        const withIds = raw.map((t, i) => ({ ...t, id: `t${i}`, depends_on: t.depends_on || [] }));
        setRanked(dealIntoColumns(withIds));
        setLoadError(false);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setRanked([]);
        setLoadError(true);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [retryTick]);

  const moveTerm = (id, destTier) => {
    setRanked((prev) => prev.map((t) => (t.id === id ? { ...t, tier: destTier } : t)));
  };

  const moveAllToBlank = () => {
    setRanked((prev) => prev.map((t) => (t.tier === 'blank' ? t : { ...t, tier: 'blank' })));
  };

  const termCount = ranked.length;
  const totalDone = ranked.filter((t) => t.tier === 'know_it').length;
  const outsideBlank = ranked.some((t) => t.tier !== 'blank');

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="px-6 pt-safe pb-2 flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground">
          <Moon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold tracking-tight leading-none">Last Minute Study</h1>
          <p className="text-[11px] text-muted-foreground leading-none mt-1">Triage — {sourceTitle}</p>
        </div>
        {!loading && (
          <span className="text-xs font-medium text-muted-foreground">{totalDone}/{termCount} ready</span>
        )}
      </header>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-sm font-medium">Loading your terms…</p>
        </div>
      ) : loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <p className="text-sm font-medium">Couldn’t load terms</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Add your OpenAI API key in Settings, or set up shared AI so testers don’t need a key. You can also create terms by hand from Welcome.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              type="button"
              onClick={() => {
                setLoadError(false);
                setLoading(true);
                setRetryTick((n) => n + 1);
              }}
              className="rounded-2xl"
            >
              Try again
            </Button>
            <Button type="button" variant="ghost" className="rounded-2xl" onClick={() => navigate('/settings')}>
              Settings
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="px-6 pb-2">
            <h2 className="text-lg font-bold tracking-tight">Triage your terms</h2>
            <p className="text-xs text-muted-foreground">Drag a card into the column that matches how well you know it.</p>
          </div>

          <main className="flex-1 px-3 pb-4 flex flex-row gap-2 overflow-hidden">
            {TIERS.map((tier) => {
              const items = ranked.filter((t) => t.tier === tier.id);
              return (
                <div
                  key={tier.id}
                  data-triage-col={tier.id}
                  className={`flex-1 flex flex-col min-w-0 rounded-t-lg transition-shadow ${
                    dragOver === tier.id ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
                  }`}
                >
                  <div
                    style={{ background: tier.bg }}
                    className="rounded-t-lg px-2 py-2"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-black text-sm leading-none">{tier.label}</span>
                      <span className="text-[10px] text-black/60 leading-none">{items.length}</span>
                    </div>
                    {tier.id === 'blank' && (
                      <button
                        type="button"
                        onClick={moveAllToBlank}
                        disabled={!outsideBlank}
                        className="mt-1.5 w-full min-h-9 rounded-md bg-black/10 hover:bg-black/15 active:bg-black/20 text-black text-[11px] font-semibold py-2 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Move all
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto bg-muted p-2 flex flex-col gap-2">
                    {items.map((item, idx) => (
                      <TriageCard
                        key={item.id}
                        item={item}
                        tier={tier.id}
                        animationDelay={idx * 0.06}
                        onMove={moveTerm}
                        onDragOver={setDragOver}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </main>

          <footer className="px-6 pt-1 pb-safe">
            <div className="max-w-md mx-auto w-full">
              <Button
                type="button"
                onClick={lockIn}
                disabled={!ranked.length}
                className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                <Check className="w-4 h-4 mr-2" /> Lock in triage
              </Button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default Triage;
