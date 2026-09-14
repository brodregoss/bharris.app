import React from 'react';
import { GitBranch, Moon, ClipboardCheck } from 'lucide-react';

// Static reference diagram of the whole app's decision tree — how the two
// setup choices (exam timing + exam type) branch what the user sees, what
// questions they get, and how the session ends. Not a live progress view.

const TYPE = 'bg-sky-100 text-sky-700';     // exam-type branch
const TIMING = 'bg-amber-100 text-amber-700'; // exam-timing branch

function Branch({ tag, tone = TYPE, children }) {
  return (
    <div className="flex gap-2">
      <span className={`shrink-0 mt-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${tone}`}>
        {tag}
      </span>
      <div className="flex-1 text-[11px] leading-relaxed text-slate-600">{children}</div>
    </div>
  );
}

function Node({ title, sub, icon }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 -mt-0.5">
        <p className="text-xs font-semibold text-slate-800">{title}</p>
        {sub && <p className="text-[11px] text-slate-500 leading-snug">{sub}</p>}
      </div>
    </div>
  );
}

function Bar() {
  return <div className="ml-3 border-l-2 border-dashed border-slate-200 h-3" />;
}

function Group({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">{label}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export default function AppFlowChart() {
  return (
    <div className="space-y-4">
      <Group label="1 · Setup">
        <Node title="Landing" sub="First visit → password, then Welcome. Returning → Continue session or start new cram." icon={<GitBranch className="w-3.5 h-3.5" />} />
        <Bar />
        <Node title="Welcome" sub="Photo of notes · create manually · use some of ours" icon={<ClipboardCheck className="w-3.5 h-3.5" />} />
        <Bar />
        <Node title="Review notes (photo upload)" sub="AI finds every term on the page, writes defs, then you edit or regenerate" />
        <Bar />
        <Node title="Time & test type" sub="Hours · exam type · exam timing · term count · back to notes. Large sets: drill what the clock can cover, skim the rest." />
        <Bar />
        <Node title="Triage (even random columns; AI ranks user terms only)" sub="Sample sets keep built-in difficulty. User notes get a difficulty rank. You drag Blank / Shaky / Know it. Big decks still triage all terms." />
        <Bar />
        <Node title="Skim notes? (optional)" sub="All terms + defs before flashcards, or skip straight in" />
      </Group>

      <Group label="2 · Triage tiers (by exam type)">
        <Branch tag="MCQ">d≥8 Critical · d≥5 Core · else Passive — wider Passive for broad coverage</Branch>
        <Branch tag="Short">d≥8 Critical · d≥4 Core · else Passive — narrower Critical, more depth</Branch>
        <Branch tag="Mixed">d≥7 Critical · d≥4 Core · else Passive</Branch>
        <p className="text-[11px] text-slate-500">User confidence (know / shaky / blank) layered on top of tiers → priority weight.</p>
      </Group>

      <Group label="3 · Study blocks">
        <Node title="Critical recall" sub="40% budget · retire after 2 correct · big decks overflow extra terms into skim" />
        <Bar />
        <Node title="Core recall" sub="30% budget · retire after 1 correct" />
        <Bar />
        <Node title="Passive skim" sub="skim-only, no recall grading" />
        <Bar />
        <Node title="Practice test" sub="up to 12 Qs · missed terms → still shaky" />
        <Bar />
        <Node title="Confidence sheet" sub="shaky-only drill · 5% budget" />
      </Group>

      <Group label="4 · Recall question style (by exam type)">
        <Branch tag="MCQ">1-in-4 recognition (pick definition), rest free-recall</Branch>
        <Branch tag="Short">1-in-5 "explain in your own words", rest free-recall</Branch>
        <Branch tag="Mixed">alternate recognition / free-recall card-by-card</Branch>
      </Group>

      <Group label="5 · Practice test (by exam type)">
        <Branch tag="MCQ">all multiple choice · under 4 terms, AI writes extra wrong answers</Branch>
        <Branch tag="Short">all AI-graded free response</Branch>
        <Branch tag="Mixed">alternate MCQ / short answer</Branch>
      </Group>

      <Group label="6 · Sleep protection (by exam timing)">
        <Branch tag="Today" tone={TIMING}>
          no sleep-time prompt · exam itself is the cutoff · no wind-down · ends "You're as ready as you'll be."
        </Branch>
        <Branch tag="Tomorrow" tone={TIMING}>
          asks sleep time → within 45 min of stop, wind-down kicks in: skips Passive + Test, drops to shaky-only 12-min drill · amber "get some sleep" notice · ends "You're as ready as you'll be."
        </Branch>
        <Branch tag="2 days" tone={TIMING}>
          same wind-down + stop time · ends "Day 1 done — pick up tomorrow"
        </Branch>
      </Group>

      <Group label="7 · Time trim (running behind)">
        <Node title="Passive trimmed first" sub="short_answer trims hardest (0.8×) · MCQ softest (1.3×) · mixed 1.0×" icon={<Moon className="w-3.5 h-3.5" />} />
      </Group>
    </div>
  );
}