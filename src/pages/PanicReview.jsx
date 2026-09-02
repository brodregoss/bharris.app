import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, RefreshCw, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { loadSession } from '@/lib/sessionStore';
import { panicSignature, loadPanicSummary, savePanicSummary } from '@/lib/panicCache';

const MD_COMPONENTS = {
  h1: (p) => <h2 className="text-base font-bold mt-5 mb-1.5" {...p} />,
  h2: (p) => <h3 className="text-sm font-bold mt-4 mb-1" {...p} />,
  h3: (p) => <h4 className="text-sm font-semibold mt-3 mb-1" {...p} />,
  p: (p) => <p className="text-sm leading-relaxed mb-2.5" {...p} />,
  ul: (p) => <ul className="list-disc pl-5 mb-2.5 space-y-0.5" {...p} />,
  ol: (p) => <ol className="list-decimal pl-5 mb-2.5 space-y-0.5" {...p} />,
  li: (p) => <li className="text-sm leading-relaxed" {...p} />,
  strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
};

// Read-only panic notes: a single AI-generated summary of what to know, built
// on demand from the saved session's terms. Cached per term-state signature —
// first open prompts to generate; a changed signature prompts to regenerate.
export default function PanicReview() {
  const navigate = useNavigate();
  const [summary, setSummary] = React.useState(null);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState(false);

  const session = loadSession();

  React.useEffect(() => {
    setSummary(loadPanicSummary());
  }, []);

  if (!session || !session.terms?.length) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">No terms to review yet.</p>
        <Button onClick={() => navigate('/')} className="rounded-2xl">Back to start</Button>
      </div>
    );
  }

  const terms = session.terms;
  const signature = panicSignature(terms);
  const hasSummary = !!summary?.text;
  const isStale = hasSummary && summary.signature !== signature;

  const generate = async () => {
    setGenerating(true);
    setError(false);
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
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          `You are writing last-minute exam cram notes for a student who is out of time. ` +
          `Below is a JSON array of the terms they must know, each with how well they currently know it. ` +
          `Write ONE cohesive page of study NOTES (not flashcards, not a definitions list) meant to be read straight through in a few minutes.\n\n` +
          `Rules:\n` +
          `- Open with the concepts they're weakest on (confidence "blank", many "missed", or tested false) — explain each plainly and fully, as if explaining to a friend in one breath. Bold the term name.\n` +
          `- Then a tighter refresher for "shaky" concepts.\n` +
          `- End with a one-line "You've got these:" list naming mastered concepts (confidence "know", few misses) — no explanations.\n` +
          `- Skip any term whose tier is "passive".\n` +
          `- Plain, casual language. Short paragraphs and bullet groups. No filler, no pep talks.\n` +
          `- Where depends_on shows a foundation, explain it before the concept that builds on it.\n` +
          `- Use markdown: "## Know these cold", "## Quick refresh", "## You've got these".\n\n` +
          `Terms (JSON):\n${JSON.stringify(payload)}`,
      });
      const text = typeof res === 'string' ? res : String(res);
      savePanicSummary(signature, text);
      setSummary({ signature, text });
    } catch {
      setError(true);
    }
    setGenerating(false);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Exam-type reminder strip */}
      <header className="sticky top-0 z-20 bg-background px-4 pt-safe pb-1 flex justify-start">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Exit"
          className="flex items-center justify-center w-11 h-11 -ml-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 px-5 pt-2 overflow-y-auto">
        <div className="max-w-md mx-auto w-full pb-8">
          {/* First-time generate prompt */}
          {!hasSummary && !generating && (
            <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-rose-50 text-rose-600 mx-auto mb-3">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold mb-1">Generate your panic notes?</h2>
              <p className="text-sm text-muted-foreground mb-5">
                A one-page summary of what to know — built from your terms, weakest concepts first.
              </p>
              <Button
                onClick={generate}
                className="w-full h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              >
                <FileText className="w-4 h-4 mr-2" /> Generate notes
              </Button>
            </div>
          )}

          {/* Generating */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-7 h-7 text-muted-foreground animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Writing your notes…</p>
            </div>
          )}

          {/* Regenerate-on-change banner */}
          {hasSummary && isStale && !generating && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 mb-4 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800 flex-1 leading-snug">
                Your terms changed since these notes were made.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={generate}
                className="border-amber-400 text-amber-700 hover:bg-amber-100 h-8"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
              </Button>
            </div>
          )}

          {/* Notes */}
          {hasSummary && !generating && (
            <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <ReactMarkdown components={MD_COMPONENTS}>{summary.text}</ReactMarkdown>
            </article>
          )}

          {/* Error */}
          {error && !generating && (
            <p className="text-sm text-rose-600 text-center mt-4">
              Couldn't generate notes — try again.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}