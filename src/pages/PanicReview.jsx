import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { X, FileText, RefreshCw, Loader2, ALargeSmall } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { invokeLlm } from '@/api/invokeLlm';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { loadLatestCram } from '@/lib/sessionStore';
import { panicSignature, loadPanicSummary, savePanicSummary } from '@/lib/panicCache';
import { adsEnabledFor } from '@/lib/adAccess';
import { getCurrentUser } from '@/lib/accountStore';
import { hidePanicBanner, showPanicBanner } from '@/lib/ads';
import { PanicAdSlot } from '@/components/ads/RewardedAdSheet';

const TEXT_KEY = 'lms_panic_text_px';
const TEXT_MIN = 15;
const TEXT_MAX = 23;
const TEXT_DEFAULT = 17;

function loadTextPx() {
  try {
    const n = Number(localStorage.getItem(TEXT_KEY));
    if (Number.isFinite(n) && n >= TEXT_MIN && n <= TEXT_MAX) return n;
  } catch {
    // ignore
  }
  return TEXT_DEFAULT;
}

const MD_COMPONENTS = {
  h1: (p) => <h2 className="text-[1.35em] font-bold tracking-tight mt-[0.2em] mb-[0.7em] leading-snug" {...p} />,
  h2: (p) => (
    <h3
      className="text-[1.12em] font-bold tracking-tight mt-[1.6em] mb-[0.55em] pt-[0.35em] leading-snug first:mt-0"
      {...p}
    />
  ),
  h3: (p) => <h4 className="text-[1.02em] font-semibold mt-[1.2em] mb-[0.4em] leading-snug" {...p} />,
  p: (p) => <p className="text-[1em] leading-[1.75] mb-[1em] text-foreground/90" {...p} />,
  ul: (p) => <ul className="list-disc pl-[1.3em] mb-[1.15em] space-y-[0.55em]" {...p} />,
  ol: (p) => <ol className="list-decimal pl-[1.3em] mb-[1.15em] space-y-[0.55em]" {...p} />,
  li: (p) => <li className="text-[1em] leading-[1.7] text-foreground/90" {...p} />,
  strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
  hr: () => <hr className="my-6 border-border" />,
};

function splitQuickReview(text) {
  const source = String(text || '').replace(/\r\n/g, '\n').trim();
  const parts = source.split(/\n(?=## )/);
  if (parts.length < 2) return { intro: source, sections: [] };
  return {
    intro: parts[0].trim(),
    sections: parts.slice(1).map((part) => part.trim()).filter(Boolean),
  };
}

function storedDefinition(term) {
  return String(term?.definition || '').trim();
}

function TermGlossary({ terms, textPx, wideWeb }) {
  const listed = (terms || []).filter((term) => String(term?.term || '').trim());
  if (!listed.length) return null;
  return (
    <section
      aria-label="All terms"
      className={`mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm ${wideWeb ? 'lg:p-8' : ''}`}
      style={{ fontSize: `${textPx}px` }}
    >
      <h2 className="text-[1.12em] font-bold tracking-tight mb-[0.9em]">All terms</h2>
      <div className={wideWeb ? 'lg:columns-2 lg:gap-x-14' : undefined}>
        {listed.map((term, index) => (
          <div key={term.id || index} className="mb-[1.35em] break-inside-avoid">
            <p className="font-semibold leading-snug">{term.term}</p>
            <p className="mt-[0.35em] leading-relaxed text-foreground/90">
              {storedDefinition(term) || 'No definition yet.'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TextSizePopover({ textPx, onChange }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Text size"
          className="flex items-center justify-center w-11 h-11 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition"
        >
          <ALargeSmall className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-64 rounded-2xl p-4">
        <p className="text-xs font-semibold mb-3">Text size</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Smaller text"
            onClick={() => onChange(Math.max(TEXT_MIN, textPx - 2))}
            className="flex items-center justify-center w-11 h-11 rounded-xl border border-border bg-card text-sm font-medium hover:bg-accent"
          >
            A−
          </button>
          <Slider
            min={TEXT_MIN}
            max={TEXT_MAX}
            step={1}
            value={[textPx]}
            onValueChange={([v]) => onChange(v)}
            className="flex-1"
          />
          <button
            type="button"
            aria-label="Larger text"
            onClick={() => onChange(Math.min(TEXT_MAX, textPx + 2))}
            className="flex items-center justify-center w-11 h-11 rounded-xl border border-border bg-card text-base font-semibold hover:bg-accent"
          >
            A+
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Read-only panic notes: a single AI-generated summary of what to know, built
// on demand from the saved session's terms. Cached per term-state signature —
// first open prompts to generate; a changed signature prompts to regenerate.
export default function PanicReview() {
  const navigate = useNavigate();
  const [summary, setSummary] = React.useState(null);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [adVisible, setAdVisible] = React.useState(false);
  const [canSkipAd, setCanSkipAd] = React.useState(false);
  const adOn = React.useRef(false);
  const [textPx, setTextPx] = React.useState(TEXT_DEFAULT);

  const session = loadLatestCram();

  React.useEffect(() => {
    setSummary(loadPanicSummary());
    setTextPx(loadTextPx());
  }, []);

  React.useEffect(() => () => {
    adOn.current = false;
    hidePanicBanner();
  }, []);

  const changeTextPx = (n) => {
    const next = Math.min(TEXT_MAX, Math.max(TEXT_MIN, n));
    setTextPx(next);
    try {
      localStorage.setItem(TEXT_KEY, String(next));
    } catch {
      // ignore
    }
  };

  if (!session || !session.terms?.length) {
    return (
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center px-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">No cram to build notes from yet.</p>
        <Button onClick={() => navigate('/')} className="rounded-2xl">Back to start</Button>
      </div>
    );
  }

  const terms = session.terms;
  const signature = panicSignature(terms);
  const hasSummary = !!summary?.text;
  const isStale = hasSummary && summary.signature !== signature;
  const wideWeb = !Capacitor.isNativePlatform();
  const review = hasSummary ? splitQuickReview(summary.text) : { intro: '', sections: [] };
  const columns = wideWeb && review.sections.length > 1;

  const skipAd = () => {
    if (!canSkipAd) return;
    adOn.current = false;
    setAdVisible(false);
    hidePanicBanner();
  };

  const generate = async () => {
    setGenerating(true);
    setError(false);
    setCanSkipAd(false);
    const ads = adsEnabledFor(getCurrentUser());
    if (ads) {
      adOn.current = true;
      setAdVisible(true);
      if (Capacitor.isNativePlatform()) {
        const shown = await showPanicBanner();
        if (!shown) {
          adOn.current = false;
          setAdVisible(false);
        }
      }
    }
    try {
      const payload = terms
        .filter((t) => t.tier === 'critical' || t.tier === 'core')
        .map((t) => ({
          term: t.term,
          definition: t.definition,
          tier: t.tier,
          confidence: t.confidence,
          missed: (t.recallHistory || []).filter((h) => h.result === 'missed').length,
          tested: t.testResult,
          depends_on: t.depends_on || [],
        }));
      const res = await invokeLlm({
        prompt:
          `Write a calm, easy-to-skim review page for a student who wants a last look before an exam. ` +
          `They are nervous — keep the page friendly, airy, and unintimidating. Not a cram wall. Not a lecture.\n\n` +
          `Below is JSON of the terms they studied, including how well they currently know each one.\n\n` +
          `Follow this layout exactly:\n` +
          `- Start with "# Your quick review" and one short sentence under it.\n` +
          `- Then 3–6 sections. Each section has:\n` +
          `  - A clear ## heading in plain English (the idea, not a command). Examples: "How memory works", "The two kinds of conditioning". Never "Know these cold", "Must know", or "Don't miss".\n` +
          `  - Then either 1–2 short paragraphs OR a short bullet list — not a dense mix.\n` +
          `  - Put a blank line after every heading and after every paragraph.\n` +
          `- Weakest ideas first (confidence "blank", many "missed", or tested false). Explain each like you're sitting next to them — one idea at a time. Bold the term name once.\n` +
          `- Next, a ## heading such as "Quick refresh" for shaky ideas — even shorter.\n` +
          `- End with "## You're already solid" and a short list of term names only, no explanations.\n` +
          `- Skip any term whose tier is "passive".\n` +
          `- If depends_on lists a foundation, give that foundation its own short section first.\n` +
          `- Casual language. Short sentences. Breathing room over packing everything in.\n` +
          `- No pep talks, no "you must", no walls of text.\n\n` +
          `Terms (JSON):\n${JSON.stringify(payload)}`,
        feature: 'panic',
      });
      const text = typeof res === 'string' ? res : String(res);
      savePanicSummary(signature, text);
      setSummary({ signature, text });
    } catch {
      setError(true);
      adOn.current = false;
      setAdVisible(false);
      hidePanicBanner();
    }
    setGenerating(false);
    if (adOn.current) setCanSkipAd(true);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur px-3 pt-safe pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Exit"
          className="flex items-center justify-center w-11 h-11 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>
        <TextSizePopover textPx={textPx} onChange={changeTextPx} />
      </header>

      <main className={`flex-1 overflow-y-auto px-5 pt-2 pb-safe ${wideWeb ? 'lg:px-10' : ''}`}>
        <div className={`mx-auto w-full max-w-md pb-8 ${wideWeb ? 'lg:max-w-6xl' : ''}`}>
          {!hasSummary && !generating && (
            <div className={`rounded-2xl border border-border bg-card p-6 text-center shadow-sm ${wideWeb ? 'lg:mx-auto lg:mt-[12vh] lg:max-w-md' : ''}`}>
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-primary-foreground mx-auto mb-3">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold mb-1">Generate your panic notes?</h2>
              <p className="text-sm text-muted-foreground mb-5">
                A one-page summary of what to know — built from {session.title || session.setup?.title || 'your last cram'}, weakest concepts first.
              </p>
              <Button
                onClick={generate}
                className="w-full h-11 rounded-2xl font-semibold"
              >
                <FileText className="w-4 h-4 mr-2" /> Generate notes
              </Button>
            </div>
          )}

          {(generating || adVisible) && (
            <div className="flex flex-col items-center justify-center py-8">
              {adVisible && !Capacitor.isNativePlatform() && <PanicAdSlot />}
              {adVisible && Capacitor.isNativePlatform() && <div className="h-16 w-full" aria-hidden="true" />}
              {generating ? (
                <>
                  <Loader2 className="w-7 h-7 text-muted-foreground animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">Writing your notes…</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium mb-4">Notes are ready</p>
                  <Button
                    type="button"
                    onClick={skipAd}
                    disabled={!canSkipAd}
                    className="h-11 rounded-2xl font-semibold"
                  >
                    Skip ad
                  </Button>
                </>
              )}
            </div>
          )}

          {hasSummary && isStale && !generating && !adVisible && (
            <div className="rounded-xl border border-border bg-card p-3 mb-4 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground flex-1 leading-snug">
                Your terms changed since these notes were made.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={generate}
                className="h-8 rounded-xl"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
              </Button>
            </div>
          )}

          {hasSummary && !generating && !adVisible && (
            <>
              <article
                className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${wideWeb ? 'lg:p-8' : ''}`}
                style={{ fontSize: `${textPx}px` }}
              >
                <ReactMarkdown components={MD_COMPONENTS}>{review.intro}</ReactMarkdown>
                {review.sections.length > 0 && (
                  <div className={columns ? 'lg:columns-2 lg:gap-x-14' : undefined}>
                    {review.sections.map((section, index) => (
                      <div
                        key={index}
                        className={`mt-[1.6em] break-inside-avoid ${columns ? 'lg:mb-[1.6em] lg:mt-0' : ''}`}
                      >
                        <ReactMarkdown components={MD_COMPONENTS}>{section}</ReactMarkdown>
                      </div>
                    ))}
                  </div>
                )}
              </article>
              <p className="text-[11px] text-muted-foreground text-center mt-5 leading-relaxed px-3">
                These notes are generated with AI. Fact-check important information.
              </p>
            </>
          )}

          {!generating && !adVisible && (
            <TermGlossary terms={terms} textPx={textPx} wideWeb={wideWeb} />
          )}

          {error && !generating && (
            <p className="text-sm text-destructive text-center mt-4">
              Couldn't generate notes — try again.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
