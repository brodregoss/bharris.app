import React from 'react';
import { BookOpen, ArrowRight, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import TermDefList from './TermDefList';
import WriteOwnDef, { writtenReviewPlan } from './WriteOwnDef';
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
  inferRankMode,
  rankModeSkimHint,
  tierLabelsFor,
  SKIM_TIER_ORDER,
  topTierTerms,
  recommendedOwnDefTerms,
  OWN_DEF_ADD_MORE_BELOW,
} from '@/lib/studyUtils';

export function NotesOfferPrompt({ onSkim, onSkip }) {
  return (
    <div className="w-full flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-5">
        <BookOpen className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">Skim your notes first?</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-8">
        Quick look at every term and definition before flashcards start. You can skip and jump straight in.
      </p>
      <div className="w-full max-w-xs space-y-3">
        <Button type="button" onClick={onSkim} className="w-full h-12 rounded-2xl font-semibold">
          Skim notes
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full min-h-11 text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          Skip — start flashcards
        </button>
      </div>
    </div>
  );
}

function idsOf(list) {
  return (list || []).map((t) => t.id).filter(Boolean);
}

function groupedTerms(terms, labels) {
  const list = Array.isArray(terms) ? terms : [];
  const groups = SKIM_TIER_ORDER.map((id) => ({
    id,
    title: labels[id],
    items: list.filter((t) => t.tier === id),
  })).filter((g) => g.items.length);
  const leftover = list.filter((t) => !SKIM_TIER_ORDER.includes(t.tier));
  if (leftover.length) groups.push({ id: 'other', title: groups.length ? 'Other' : null, items: leftover });
  return groups;
}

function recommendCopy(groupLabel, topCount, recCount) {
  const lead = `Putting ${groupLabel} in your own words helps them stick.`;
  if (topCount <= 0) return `${lead} Pick any terms you want — no limit.`;
  if (topCount === 1) return `${lead} We’ll start you with that 1 term — add more if you want.`;
  if (topCount <= recCount) return `${lead} We’ll start you with those ${topCount} terms — add more if you want.`;
  return `${lead} We’ll start you with the ${recCount} hardest — add more if you want.`;
}

function OwnDefPicker({ terms, labels, selected, setSelected, suggestedIds, onBack, onStart }) {
  const sections = groupedTerms(terms, labels);
  const suggested = suggestedIds instanceof Set ? suggestedIds : new Set(suggestedIds || []);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col px-5 pt-4 pb-4 min-h-0">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col min-h-0">
        <button
          type="button"
          onClick={onBack}
          className="self-start text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mb-3"
        >
          Back to notes
        </button>
        <h2 className="text-xl font-bold tracking-tight mb-1">Add more terms?</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Suggested terms are selected. Tap any others you want — no limit.
        </p>
        <div className="flex-1 overflow-y-auto space-y-5 mb-4">
          {sections.map((g) => (
            <div key={g.id}>
              {g.title && (
                <p className="text-sm font-bold tracking-tight mb-2">
                  {g.title}
                  <span className="text-muted-foreground font-semibold"> · {g.items.length}</span>
                </p>
              )}
              <div className="space-y-2">
                {g.items.map((t) => {
                  const on = selected.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggle(t.id)}
                      className={cn(
                        'w-full text-left rounded-xl border p-3 transition',
                        on ? 'border-foreground bg-card' : 'border-border bg-muted/30',
                      )}
                    >
                      <p className="text-sm font-semibold">
                        {t.term}
                        {suggested.has(t.id) ? (
                          <span className="ml-2 text-[11px] font-semibold text-muted-foreground">Suggested</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.definition}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <Button
          disabled={!selected.size}
          onClick={onStart}
          className="w-full h-12 rounded-2xl font-semibold"
        >
          Start writing · {selected.size}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export function NotesSkim({ terms, onDone, onUpdateTerm, rankMode }) {
  const mode = inferRankMode(terms, { rankMode });
  const labels = tierLabelsFor(mode);
  const top = React.useMemo(() => topTierTerms(terms), [terms]);
  const recommended = React.useMemo(() => recommendedOwnDefTerms(terms), [terms]);
  const recommendedIds = React.useMemo(() => new Set(idsOf(recommended)), [recommended]);
  const extrasExist = (terms || []).some((t) => t?.id && !recommendedIds.has(t.id));
  const canWrite = (terms || []).some((t) => t?.id && !String(t.ownDefinition || '').trim());

  const [stage, setStage] = React.useState('skim');
  const [askAddMore, setAskAddMore] = React.useState(false);
  const [picked, setPicked] = React.useState(() => new Set());

  const writeCards = React.useMemo(
    () => (terms || []).filter((t) => picked.has(t.id)),
    [terms, picked],
  );

  const beginWithRecommended = () => {
    const next = new Set(idsOf(recommended));
    setPicked(next);
    if (!recommended.length) {
      if (extrasExist) setStage('pick');
      return;
    }
    if (top.length < OWN_DEF_ADD_MORE_BELOW && extrasExist) {
      setAskAddMore(true);
      return;
    }
    setStage('write');
  };

  const startWriting = (ids) => {
    setPicked(new Set(ids));
    setAskAddMore(false);
    setStage('write');
  };

  if (stage === 'write') {
    return (
      <WriteOwnDef
        cards={writeCards}
        allTerms={terms}
        variant="defMode"
        skipLabel="Not now"
        onComplete={(entries) => {
          const { ids, defs } = writtenReviewPlan(entries, writeCards);
          ids.forEach((id) => {
            if (defs[id]) onUpdateTerm?.(id, { ownDefinition: defs[id] });
          });
          setStage('skim');
        }}
        onSkip={() => setStage('skim')}
      />
    );
  }

  if (stage === 'pick') {
    return (
      <OwnDefPicker
        terms={terms}
        labels={labels}
        selected={picked}
        setSelected={setPicked}
        suggestedIds={recommendedIds}
        onBack={() => setStage('skim')}
        onStart={() => startWriting(picked)}
      />
    );
  }

  const writtenCount = (terms || []).filter((t) => String(t.ownDefinition || '').trim()).length;
  const group = labels.critical;

  return (
    <div className="flex flex-col px-5 pt-4 pb-4 min-h-0">
      <div className="max-w-md mx-auto w-full">
        <h2 className="text-xl font-bold tracking-tight mb-1">Your notes</h2>
        <p className="text-xs text-muted-foreground mb-3">{rankModeSkimHint(mode)}</p>

        <div className="rounded-2xl border border-border bg-card p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted text-muted-foreground shrink-0">
              <PenLine className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Write your own definitions</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                {recommendCopy(group, top.length, recommended.length)}
              </p>
              {writtenCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {writtenCount} saved in your wording.
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={beginWithRecommended}
            disabled={!canWrite}
            className="w-full h-11 rounded-2xl font-semibold mt-3"
          >
            {recommended.length
              ? `Write ${recommended.length} ${group} term${recommended.length === 1 ? '' : 's'}`
              : 'Pick terms to write'}
          </Button>
        </div>

        <div className="mb-4">
          <TermDefList terms={terms} rankMode={mode} />
        </div>
        <Button type="button" onClick={onDone} className="w-full h-12 rounded-2xl font-semibold">
          Start flashcards
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <AlertDialog open={askAddMore} onOpenChange={setAskAddMore}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Want to add more?</AlertDialogTitle>
            <AlertDialogDescription>
              {top.length === 1
                ? `There is only 1 ${group} term. You can add terms from other groups, or just write this one.`
                : `There are only ${top.length} ${group} terms. You can add terms from other groups, or just write these.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => startWriting(idsOf(recommended))}
            >
              Just {top.length === 1 ? 'this one' : 'these'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPicked(new Set(idsOf(recommended)));
                setStage('pick');
              }}
            >
              Add more
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
