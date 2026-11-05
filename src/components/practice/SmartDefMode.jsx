import React from 'react';
import { orderLikeSkim } from '@/lib/studyUtils';
import WriteOwnDef, { writtenReviewPlan } from '@/components/study/WriteOwnDef';
import PracticeFlashcards from '@/components/practice/PracticeFlashcards';
import TermPicker from '@/components/practice/TermPicker';

export default function SmartDefMode({ terms, onUpdateTerm, onDone, onBack, rankMode }) {
  const ordered = React.useMemo(() => orderLikeSkim(terms), [terms]);
  const [stage, setStage] = React.useState('pick');
  const [cards, setCards] = React.useState([]);
  const [reviewIds, setReviewIds] = React.useState([]);
  const [reviewDefs, setReviewDefs] = React.useState({});
  const reviewTerms = React.useMemo(
    () =>
      reviewIds
        .map((id) => {
          const t = ordered.find((term) => term.id === id);
          if (!t) return null;
          return { ...t, ownDefinition: reviewDefs[id] || t.ownDefinition };
        })
        .filter(Boolean),
    [reviewIds, ordered, reviewDefs],
  );

  if (stage === 'pick') {
    return (
      <TermPicker
        terms={terms}
        rankMode={rankMode}
        verb="write"
        action="Start writing"
        onBack={onBack}
        onStart={(picked) => {
          setCards(picked);
          setStage('write');
        }}
      />
    );
  }

  if (stage === 'practice') {
    return (
      <PracticeFlashcards
        terms={reviewTerms}
        heading="Practice your wording"
        onUpdateTerm={onUpdateTerm}
        onDone={onDone}
        onBack={onBack}
      />
    );
  }

  if (stage === 'write') {
    return (
      <WriteOwnDef
        cards={cards}
        allTerms={ordered}
        variant="defMode"
        onBack={onBack}
        onComplete={(entries) => {
          const { ids, defs } = writtenReviewPlan(entries, cards);
          ids.forEach((id) => {
            if (defs[id]) onUpdateTerm(id, { ownDefinition: defs[id] });
          });
          if (!ids.length) {
            onDone();
            return;
          }
          setReviewDefs(defs);
          setReviewIds(ids);
          setStage('practice');
        }}
        onSkip={() => setStage('pick')}
      />
    );
  }

  return null;
}
