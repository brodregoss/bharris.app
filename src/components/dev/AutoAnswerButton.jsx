import React from 'react';
import { Check } from 'lucide-react';
import { useDebug } from '@/lib/DebugContext';

// Dev-only helper: reads the term currently shown on screen, looks up its
// definition from the debug terms snapshot, and drives the correct answer
// via real DOM clicks — no study-component logic is touched.
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function findButtonByText(text) {
  return [...document.querySelectorAll('button')].find(
    (b) => b.textContent.trim().toLowerCase() === text.toLowerCase()
  );
}

export default function AutoAnswerButton() {
  const dbg = useDebug();
  const [busy, setBusy] = React.useState(false);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Practice test — skip the current question and mark it correct via a
      // dev event the PracticeTest component listens for (no answering/grading).
      if ([...document.querySelectorAll('span')].some((s) => s.textContent.includes('Practice test'))) {
        window.dispatchEvent(new CustomEvent('dev:skip-correct'));
        return;
      }
      const terms = dbg?.termsSnap || [];
      // The term is rendered as a bold heading inside the study card.
      const termEl = document.querySelector('p.text-2xl.font-bold, p.text-xl.font-bold');
      const termText = termEl?.textContent?.trim();
      const term = terms.find((t) => t.term === termText);
      const definition = term?.definition;

      const card = document.querySelector('.rounded-3xl.border');
      const optionButtons = card ? [...card.querySelectorAll('button')] : [];

      if (optionButtons.length && definition) {
        // MCQ recognition — pick the correct option, then Continue.
        const correctBtn = optionButtons.find((b) => b.textContent.trim() === definition);
        if (correctBtn) correctBtn.click();
        await sleep(150);
        const cont = findButtonByText('Continue') || findButtonByText('Next');
        if (cont) cont.click();
        return;
      }

      // Free recall / explain — reveal the answer, then mark Got it.
      const showBtn = findButtonByText('Show answer');
      if (showBtn) {
        showBtn.click();
        await sleep(200);
      }
      const gotBtn = findButtonByText('Got it');
      if (gotBtn) {
        gotBtn.click();
        return;
      }

      // Summary / skim — just advance.
      const cont = findButtonByText('Continue') || findButtonByText('Next');
      if (cont) cont.click();
    } finally {
      await sleep(200);
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      title="Answer current question correctly"
      className="w-10 h-10 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center opacity-40 hover:opacity-100 transition disabled:opacity-30"
    >
      <Check className="w-5 h-5" />
    </button>
  );
}