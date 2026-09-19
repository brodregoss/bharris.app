import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { tierFromDifficulty, confidenceFromTriage, normalizeExamType, inferRankMode, RANK_MODE, normalizeStudyMode, continueStudyPath, STUDY_MODE } from '@/lib/studyUtils';
import { Moon, Loader2, Check } from 'lucide-react';
import { invokeLlm } from '@/api/invokeLlm';
import { Button } from '@/components/ui/button';
import TriageCard from '@/components/triage/TriageCard';
import { emptySrs } from '@/lib/spacedCram';
import { beginSession } from '@/lib/sessionStore';

const TIERS = [
  { id: 'blank', label: 'Blank', sub: "Don't know", bg: '#FF8A8A' },
  { id: 'shaky', label: 'Shaky', sub: 'Kind of know', bg: '#FFC078' },
  { id: 'know_it', label: 'Know it', sub: 'Know it', bg: '#8CE99A' },
];

const COL_ORDER = ['blank', 'shaky', 'know_it'];
const RANK_BATCH = 12;

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Random deal, as even as possible: counts differ by at most 1 when the
// total isn't divisible by 3. Which column gets the extra(s) is random.
function dealIntoColumns(terms) {
  const shuffled = shuffle(terms);
  const n = COL_ORDER.length;
  const offset = Math.floor(Math.random() * n);
  return shuffled.map((t, i) => ({
    ...t,
    tier: COL_ORDER[(i + offset) % n],
  }));
}

function normalizeName(s) {
  return String(s || '').trim().toLowerCase();
}

function clampDifficulty(n) {
  const d = Number(n);
  if (!Number.isFinite(d)) return null;
  return Math.min(10, Math.max(1, Math.round(d)));
}

function extractTermList(res) {
  if (Array.isArray(res?.terms)) return res.terms;
  if (Array.isArray(res?.output?.terms)) return res.output.terms;
  if (Array.isArray(res)) return res;
  return [];
}

function isPreloadedSource(source) {
  return source?.kind === 'sample';
}

function needsPriorityRank(source, items) {
  if (isPreloadedSource(source) || !items.length) return false;
  return items.some((t) => clampDifficulty(t.difficulty) == null);
}

function extractRanking(res) {
  const candidates = [res?.ranking, res?.output?.ranking, res?.rankMode, res?.output?.rankMode];
  for (const value of candidates) {
    if (value === RANK_MODE.DIFFICULTY || value === RANK_MODE.IMPORTANCE) return value;
  }
  return null;
}

async function rankChunk(chunk, allNames, forcedRanking) {
  const res = await invokeLlm({
    prompt:
      `You are ranking a student's own study terms for a last-minute exam cram.\n` +
      `Do not add, remove, or rename terms. Rank each one from the list below.\n` +
      `First pick ranking:\n` +
      `- "difficulty" if this is a closed list where EVERY term is required (Bill of Rights, cranial nerves, a complete vocab quiz). Then score difficulty 1–10 by how hard it is to learn or remember: obscure, easy to mix up, or arbitrary details rank high; short, familiar, or obvious ones rank low. Do not treat any term as optional.\n` +
      `- "importance" if some terms matter more for the exam than others. Then difficulty 1–10 means hardest / most important to know.\n` +
      (forcedRanking
        ? `Use ranking "${forcedRanking}" for this batch.\n`
        : '') +
      `depends_on: array of OTHER term names from the full deck that this concept builds on (empty if none).\n` +
      `Full deck names: ${allNames.join(', ')}\n\n` +
      `Terms to rank:\n` +
      chunk.map((t, i) => `${i + 1}. ${t.term}: ${t.definition}`).join('\n'),
    feature: 'triage',
    response_json_schema: {
      type: 'object',
      properties: {
        ranking: { type: 'string', enum: ['difficulty', 'importance'] },
        terms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              difficulty: { type: 'number' },
              depends_on: { type: 'array', items: { type: 'string' } },
            },
            required: ['term', 'difficulty', 'depends_on'],
          },
        },
      },
      required: ['ranking', 'terms'],
    },
  });
  const ranked = extractTermList(res);
  const byName = new Map();
  ranked.forEach((r) => {
    const key = normalizeName(r.term);
    if (key && !byName.has(key)) byName.set(key, r);
  });
  return {
    ranking: forcedRanking || extractRanking(res),
    items: chunk.map((t) => {
      const hit = byName.get(normalizeName(t.term));
      return {
        ...t,
        difficulty: clampDifficulty(hit?.difficulty) ?? 5,
        depends_on: Array.isArray(hit?.depends_on) ? hit.depends_on : t.depends_on || [],
      };
    }),
  };
}

async function rankUserTerms(terms, onProgress, meta = {}) {
  const allNames = terms.map((t) => t.term).filter(Boolean);
  const out = [];
  let forcedRanking = null;
  for (let i = 0; i < terms.length; i += RANK_BATCH) {
    const chunk = terms.slice(i, i + RANK_BATCH);
    onProgress?.(`Ranking your terms… ${Math.min(i + chunk.length, terms.length)}/${terms.length}`);
    const { items, ranking } = await rankChunk(chunk, allNames, forcedRanking);
    if (!forcedRanking && (ranking === RANK_MODE.DIFFICULTY || ranking === RANK_MODE.IMPORTANCE)) {
      forcedRanking = ranking;
    }
    out.push(...items);
  }
  return {
    terms: out,
    rankMode:
      forcedRanking ||
      inferRankMode(out, { title: meta.title, id: meta.id, rankMode: meta.rankMode }),
  };
}

function prepareItems(raw) {
  return raw.map((t, i) => ({
    term: t.term,
    definition: t.definition,
    difficulty: clampDifficulty(t.difficulty) ?? 5,
    depends_on: t.depends_on || [],
    id: t.id || `t${i}`,
  }));
}

function Triage() {
  const location = useLocation();
  const navigate = useNavigate();
  const source = location.state?.source;
  const setup = location.state?.setup;
  const sourceTitle = source?.title || source?.name || 'your notes';

  const [ranked, setRanked] = React.useState(() => {
    const incoming = (source?.items || []).filter((t) => t?.term && t?.definition);
    if (incoming.length && (isPreloadedSource(source) || !needsPriorityRank(source, incoming))) {
      return dealIntoColumns(prepareItems(incoming));
    }
    return [];
  });
  const [loading, setLoading] = React.useState(() => ranked.length === 0);
  const [loadingHint, setLoadingHint] = React.useState('Loading your terms…');
  const [loadError, setLoadError] = React.useState(false);
  const [retryTick, setRetryTick] = React.useState(0);
  const [dragOver, setDragOver] = React.useState(null);
  const [detectedRankMode, setDetectedRankMode] = React.useState(() => {
    const incoming = (source?.items || []).filter((t) => t?.term && t?.definition);
    if (!incoming.length) return null;
    if (isPreloadedSource(source) || !needsPriorityRank(source, incoming)) {
      return inferRankMode(incoming, {
        title: source?.title || source?.name,
        id: source?.id,
        rankMode: source?.rankMode,
      });
    }
    return null;
  });

  const lockIn = () => {
    if (!ranked.length) return;
    const studyMode = normalizeStudyMode(setup?.studyMode);
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
      ...(studyMode === STUDY_MODE.SPACED_CRAM ? { srs: emptySrs() } : {}),
    }));
    const rankMode = inferRankMode(studyTerms, {
      title: source?.title || source?.name || setup?.title,
      id: source?.id,
      rankMode: detectedRankMode || source?.rankMode,
    });
    const nextSetup = {
      ...setup,
      studyMode,
      title: source?.title || source?.name || setup?.title,
      sourceId: source?.id || setup?.sourceId,
      rankMode,
    };
    const phase =
      studyMode === STUDY_MODE.TRUE_CRAM
        ? 'true_cram'
        : studyMode === STUDY_MODE.SPACED_CRAM
          ? 'spaced_plan'
          : 'notes_offer';
    const saved = beginSession({
      setup: nextSetup,
      terms: studyTerms,
      phase,
      blockStats: {},
      stillShaky: [],
      behind: false,
      stopTime: null,
      windDownAcknowledged: false,
      elapsedMs: 0,
      savedAt: Date.now(),
      noteId: source?.noteId || null,
      title: source?.title || setup?.title || 'Cram',
      flaggedTermIds: [],
    });
    navigate(continueStudyPath(nextSetup), { state: { terms: studyTerms, setup: nextSetup, sessionId: saved?.id } });
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const incoming = (source?.items || []).filter((t) => t?.term && t?.definition);
      const preloaded = isPreloadedSource(source);

      if (incoming.length && (preloaded || !needsPriorityRank(source, incoming))) {
        if (!mounted) return;
        if (retryTick > 0) {
          setRanked(dealIntoColumns(prepareItems(incoming)));
        }
        setDetectedRankMode(
          inferRankMode(incoming, {
            title: source?.title || source?.name,
            id: source?.id,
            rankMode: source?.rankMode,
          })
        );
        setLoadError(false);
        setLoading(false);
        return;
      }

      if (incoming.length && needsPriorityRank(source, incoming)) {
        setLoadingHint('Ranking your terms…');
        try {
          const rankedResult = await rankUserTerms(prepareItems(incoming), setLoadingHint, {
            title: source?.title || source?.name,
            id: source?.id,
            rankMode: source?.rankMode,
          });
          if (!mounted) return;
          setRanked(dealIntoColumns(rankedResult.terms));
          setDetectedRankMode(rankedResult.rankMode);
          setLoadError(false);
          setLoading(false);
        } catch {
          if (!mounted) return;
          setRanked([]);
          setLoadError(true);
          setLoading(false);
        }
        return;
      }

      // Photo extract happens on Review notes. Samples and typed notes
      // should already arrive with items.
      if (!mounted) return;
      setRanked([]);
      setLoadError(true);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [retryTick, source]);

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
          <p className="text-sm font-medium">{loadingHint}</p>
        </div>
      ) : loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <p className="text-sm font-medium">Couldn’t load terms</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            The study AI isn’t available right now, or there aren’t any terms yet. Try again, or go back and look over your notes.
          </p>
          <Button
            type="button"
            onClick={() => {
              setLoadError(false);
              setLoading(true);
              setLoadingHint('Loading your terms…');
              setRetryTick((n) => n + 1);
            }}
            className="mt-2 rounded-2xl"
          >
            Try again
          </Button>
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
