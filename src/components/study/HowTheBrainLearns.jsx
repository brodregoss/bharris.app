import React from 'react';
import { ArrowRight, Check, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const KNOWN = [
  { id: 'synapse', term: 'Synapse', def: 'The gap where one neuron signals the next.' },
  { id: 'axon', term: 'Axon', def: 'The fiber that carries a signal away from the cell.' },
];

const STUCK_CARDS = [
  { id: 'wm', term: 'Working memory', def: 'The small workspace that holds what you are using right now.' },
  { id: 'cl', term: 'Cognitive load', def: 'How much of that workspace a task is using.' },
];

const OWN_TEXT = {
  wm: 'The short desk in your head that holds what you are using.',
  cl: 'How full that desk gets while you do the task.',
};

function push(steps, step) {
  steps.push({
    card: null,
    revealed: false,
    target: null,
    press: false,
    phase: null,
    typed: '',
    n: '',
    ...step,
  });
}

function buildSteps() {
  const steps = [];
  let left = 4;
  KNOWN.forEach((card) => {
    push(steps, { kind: 'card', card, revealed: false, target: 'show', effort: 22, left, ms: 380 });
    push(steps, { kind: 'card', card, revealed: false, target: 'show', press: true, effort: 16, left, ms: 140 });
    push(steps, { kind: 'card', card, revealed: true, target: 'got', effort: 12, left, ms: 420 });
    left -= 1;
    push(steps, { kind: 'card', card, revealed: true, target: 'got', press: true, effort: 10, left, ms: 220 });
  });
  for (let pass = 0; pass < 2; pass += 1) {
    STUCK_CARDS.forEach((card, i) => {
      const effort = 40 + pass * 22 + i * 8;
      push(steps, { kind: 'card', card, revealed: false, target: 'show', effort, left: 2, ms: 360 });
      push(steps, { kind: 'card', card, revealed: false, target: 'show', press: true, effort: effort + 3, left: 2, ms: 130 });
      push(steps, {
        kind: 'card',
        card,
        revealed: true,
        target: 'miss',
        effort: Math.min(82, effort + 8),
        left: 2,
        ms: 300,
      });
      push(steps, {
        kind: 'card',
        card,
        revealed: true,
        target: 'miss',
        press: true,
        effort: Math.min(88, effort + 14),
        left: 2,
        ms: 180,
      });
    });
  }
  push(steps, { kind: 'prompt', effort: 92, left: 2, ms: 880 });
  push(steps, { kind: 'prompt', target: 'next', effort: 93, left: 2, ms: 360 });
  push(steps, { kind: 'prompt', target: 'next', press: true, effort: 94, left: 2, ms: 160 });

  STUCK_CARDS.forEach((card, i) => {
    const text = OWN_TEXT[card.id];
    const n = `${i + 1}/2`;
    const chunk = i === 0 ? 4 : 6;
    push(steps, { kind: 'write', card, phase: 'look', target: 'start', effort: 95, left: 2, ms: i === 0 ? 520 : 340, n });
    push(steps, { kind: 'write', card, phase: 'look', target: 'start', press: true, effort: 96, left: 2, ms: 140, n });
    for (let c = chunk; c < text.length; c += chunk) {
      push(steps, {
        kind: 'write',
        card,
        phase: 'type',
        typed: text.slice(0, c),
        effort: 96,
        left: 2,
        ms: i === 0 ? 48 : 36,
        n,
      });
    }
    push(steps, { kind: 'write', card, phase: 'type', typed: text, target: 'next', effort: 97, left: 2, ms: i === 0 ? 900 : 520, n });
    push(steps, { kind: 'write', card, phase: 'type', typed: text, target: 'next', press: true, effort: 97, left: 2, ms: 160, n });
  });
  return steps;
}

const STEPS = buildSteps();
const STILL_STEP = STEPS.find((s) => s.kind === 'write' && s.card?.id === 'wm' && s.typed === OWN_TEXT.wm) || STEPS[STEPS.length - 1];

const NODES = [
  { x: 58, y: 62 },
  { x: 80, y: 48 },
  { x: 104, y: 44 },
  { x: 128, y: 52 },
  { x: 148, y: 70 },
  { x: 146, y: 92 },
  { x: 126, y: 82 },
  { x: 102, y: 76 },
  { x: 78, y: 88 },
  { x: 62, y: 104 },
  { x: 114, y: 100 },
  { x: 136, y: 118 },
];

const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [5, 6], [6, 7], [7, 8], [8, 9], [9, 0],
  [2, 7], [7, 10], [10, 6], [8, 10], [5, 11], [10, 11],
];

const FIRING = [
  [0],
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 11],
  [11, 10],
  [10, 7],
  [7, 2],
  [2, 7, 10],
  [10, 6, 4],
  [6, 5, 3],
  [1, 8, 9],
  [0, 7, 4],
  [2, 3, 10, 11],
  [8, 10, 5],
  [],
];

const SLICES = [
  { kind: 'cap', rx: 18, ry: 10 },
  { kind: 'high', rx: 30, ry: 17 },
  { kind: 'high', rx: 40, ry: 24 },
  { kind: 'fissure', rx: 48, ry: 30 },
  { kind: 'vent', rx: 52, ry: 33, split: false },
  { kind: 'vent', rx: 54, ry: 34, split: true },
  { kind: 'deep', rx: 52, ry: 34 },
  { kind: 'deep', rx: 48, ry: 33 },
  { kind: 'orbit', rx: 44, ry: 31 },
  { kind: 'orbit', rx: 38, ry: 28 },
  { kind: 'fossa', rx: 32, ry: 24 },
  { kind: 'cap', rx: 16, ry: 9 },
];

function usePrefersReducedMotion() {
  const [reduce, setReduce] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

function useOnScreen(ref) {
  const [on, setOn] = React.useState(true);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

function useTicker(length, ms, running, still) {
  const [index, setIndex] = React.useState(still);
  React.useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => setIndex((n) => (n + 1) % length), ms);
    return () => window.clearInterval(id);
  }, [length, ms, running]);
  return running ? index : still;
}

function effortColor(value) {
  if (value < 38) return '#3dbe78';
  if (value < 72) return '#e2b340';
  return '#e15b5b';
}

function effortLabel(value) {
  if (value < 38) return 'Low effort';
  if (value < 72) return 'Rising';
  return 'High effort';
}

function arcPath(cx, cy, r, a0, a1) {
  const pt = (a) => {
    const rad = (a * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  };
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function FiringBrain({ running }) {
  const frame = useTicker(FIRING.length, 150, running, 14);
  const hot = FIRING[frame] || [];
  const hotSet = new Set(hot);
  const scanY = 18 + (frame % 8) * 16;
  const edgeHot = (a, b) => hotSet.has(a) && hotSet.has(b);

  return (
    <svg viewBox="0 0 200 168" className="block h-auto w-full" aria-hidden="true">
      <defs>
        <radialGradient id="htb-hot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="38%" stopColor="#ff9a1f" />
          <stop offset="72%" stopColor="#ff3b1f" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ff3b1f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="htb-scan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ef0df" stopOpacity="0" />
          <stop offset="50%" stopColor="#9ff7ea" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#7ef0df" stopOpacity="0" />
        </linearGradient>
        <filter id="htb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="htb-grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#12343a" strokeWidth="0.4" />
        </pattern>
        <clipPath id="htb-brain-clip">
          <path d="M52 96 C38 78 42 50 66 38 C86 28 112 26 132 36 C154 46 172 62 170 80 C168 94 156 100 148 102 C162 110 160 130 140 138 C124 144 110 132 108 118 C104 130 88 136 72 128 C58 120 54 108 58 98 C40 102 36 100 52 96 Z" />
        </clipPath>
      </defs>
      <rect width="200" height="168" fill="#061016" />
      <rect width="200" height="168" fill="url(#htb-grid)" />
      <ellipse cx="108" cy="86" rx="78" ry="62" fill="#0c2428" stroke="#1a4a4e" strokeWidth="0.8" />
      <g clipPath="url(#htb-brain-clip)">
        <path
          d="M52 96 C38 78 42 50 66 38 C86 28 112 26 132 36 C154 46 172 62 170 80 C168 94 156 100 148 102 C162 110 160 130 140 138 C124 144 110 132 108 118 C104 130 88 136 72 128 C58 120 54 108 58 98 C40 102 36 100 52 96 Z"
          fill="#8f8c86"
        />
        <path d="M70 46 C78 62 72 78 64 96" fill="none" stroke="#3a3a36" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M96 40 C100 58 92 74 98 92" fill="none" stroke="#3a3a36" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M122 44 C130 60 118 76 128 92" fill="none" stroke="#3a3a36" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M146 62 C138 74 142 88 136 100" fill="none" stroke="#3a3a36" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M86 108 C98 102 112 108 124 116" fill="none" stroke="#4a4844" strokeWidth="1" strokeLinecap="round" />
        <path d="M118 112 C128 118 136 124 142 130" fill="none" stroke="#4a4844" strokeWidth="0.9" />
        <path d="M124 116 C132 122 138 126 146 128" fill="none" stroke="#4a4844" strokeWidth="0.8" />
      </g>
      <path
        d="M52 96 C38 78 42 50 66 38 C86 28 112 26 132 36 C154 46 172 62 170 80 C168 94 156 100 148 102 C162 110 160 130 140 138 C124 144 110 132 108 118 C104 130 88 136 72 128 C58 120 54 108 58 98 C40 102 36 100 52 96 Z"
        fill="none"
        stroke="#d7d3cb"
        strokeWidth="1.6"
      />
      <path
        d="M112 108 C128 104 150 112 146 128 C138 142 118 140 112 126 C108 118 108 112 112 108 Z"
        fill="#7c7a74"
        stroke="#d7d3cb"
        strokeWidth="1.15"
      />
      {EDGES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke={edgeHot(a, b) ? '#ffd27a' : '#2a4a46'}
          strokeWidth={edgeHot(a, b) ? 1.5 : 0.7}
          strokeLinecap="round"
        />
      ))}
      {NODES.map((n, i) => (
        <g key={i} filter={hotSet.has(i) ? 'url(#htb-glow)' : undefined}>
          {hotSet.has(i) && <circle cx={n.x} cy={n.y} r="11" fill="url(#htb-hot)" />}
          <circle cx={n.x} cy={n.y} r={hotSet.has(i) ? 2.5 : 1.7} fill={hotSet.has(i) ? '#fff6df' : '#2c3330'} />
        </g>
      ))}
      <rect x="0" y={scanY} width="200" height="12" fill="url(#htb-scan)" />
      <text x="8" y="14" fill="#7ef0df" fontSize="8" fontFamily="ui-monospace, monospace">
        fMRI · BOLD
      </text>
      <text x="8" y="160" fill="#5eead4" fontSize="8" fontFamily="ui-monospace, monospace" opacity="0.85">
        NEURONS
      </text>
    </svg>
  );
}

function AxialSlice({ slice, index }) {
  const cx = 78;
  const cy = 68;
  const bone = slice.rx + 7;
  const boneY = slice.ry + 6;
  const clipId = `htb-slice-${index}`;
  return (
    <svg viewBox="0 0 160 140" className="block h-auto w-full" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <ellipse cx={cx} cy={cy} rx={slice.rx} ry={slice.ry} />
        </clipPath>
      </defs>
      <rect width="160" height="140" fill="#050505" />
      <line x1={cx} y1="18" x2={cx} y2="118" stroke="#1c4038" strokeWidth="0.35" />
      <line x1="14" y1={cy} x2="142" y2={cy} stroke="#1c4038" strokeWidth="0.35" />
      <ellipse cx={cx} cy={cy} rx={bone + 3} ry={boneY + 2.5} fill="#6a6a66" />
      <ellipse cx={cx} cy={cy} rx={bone} ry={boneY} fill="#f3f1ea" />
      <ellipse cx={cx} cy={cy} rx={bone - 3.2} ry={boneY - 2.8} fill="#101010" />
      {slice.kind === 'fossa' ? (
        <g>
          <ellipse cx={cx - slice.rx * 0.32} cy={cy + 4} rx={slice.rx * 0.42} ry={slice.ry * 0.62} fill="#c8c6be" />
          <ellipse cx={cx + slice.rx * 0.32} cy={cy + 4} rx={slice.rx * 0.42} ry={slice.ry * 0.62} fill="#d2d0c6" />
          <ellipse cx={cx} cy={cy + 2} rx="3.2" ry={slice.ry * 0.28} fill="#2a2a28" />
        </g>
      ) : (
        <ellipse cx={cx} cy={cy} rx={slice.rx} ry={slice.ry} fill="#c5c3bb" />
      )}
      <g clipPath={`url(#${clipId})`} fill="none" stroke="#3c3c38" strokeWidth="1.05" strokeLinecap="round" opacity="0.75">
        {slice.kind !== 'cap' && (
          <>
            <path d={`M ${cx} ${cy - slice.ry} L ${cx} ${cy + slice.ry * 0.15}`} />
            <path d={`M ${cx - slice.rx * 0.55} ${cy - 4} Q ${cx - 10} ${cy + 8} ${cx - slice.rx * 0.2} ${cy + slice.ry * 0.35}`} />
            <path d={`M ${cx + slice.rx * 0.5} ${cy - 2} Q ${cx + 12} ${cy + 10} ${cx + slice.rx * 0.15} ${cy + slice.ry * 0.4}`} />
          </>
        )}
        {slice.kind !== 'cap' && slice.kind !== 'high' && (
          <path d={`M ${cx - slice.rx * 0.15} ${cy - slice.ry * 0.55} Q ${cx + 8} ${cy} ${cx + 4} ${cy + slice.ry * 0.4}`} />
        )}
      </g>
      {slice.kind === 'vent' && !slice.split && (
        <ellipse cx={cx} cy={cy + 1} rx="5" ry="12" fill="#141414" />
      )}
      {slice.kind === 'vent' && slice.split && (
        <g fill="#121212">
          <path d={`M ${cx - 4} ${cy - 8} C ${cx - 18} ${cy - 14} ${cx - 20} ${cy + 6} ${cx - 8} ${cy + 10} C ${cx - 2} ${cy + 4} ${cx - 2} ${cy - 2} ${cx - 4} ${cy - 8} Z`} />
          <path d={`M ${cx + 4} ${cy - 8} C ${cx + 18} ${cy - 14} ${cx + 20} ${cy + 6} ${cx + 8} ${cy + 10} C ${cx + 2} ${cy + 4} ${cx + 2} ${cy - 2} ${cx + 4} ${cy - 8} Z`} />
        </g>
      )}
      {slice.kind === 'deep' && (
        <g>
          <ellipse cx={cx - 14} cy={cy + 2} rx="8" ry="11" fill="#141414" />
          <ellipse cx={cx + 14} cy={cy + 2} rx="8" ry="11" fill="#141414" />
          <rect x={cx - 1.2} y={cy - 8} width="2.4" height="16" rx="1" fill="#161616" />
          <ellipse cx={cx - 16} cy={cy + 2} rx="3.2" ry="4" fill="#8e8c86" />
          <ellipse cx={cx + 16} cy={cy + 2} rx="3.2" ry="4" fill="#8e8c86" />
        </g>
      )}
      {slice.kind === 'orbit' && (
        <g>
          <circle cx={cx - 16} cy={cy - slice.ry * 0.22} r="8" fill="#0c0c0c" />
          <circle cx={cx + 16} cy={cy - slice.ry * 0.22} r="8" fill="#0c0c0c" />
          <circle cx={cx - 16} cy={cy - slice.ry * 0.22} r="3" fill="#3a3a3a" />
          <circle cx={cx + 16} cy={cy - slice.ry * 0.22} r="3" fill="#3a3a3a" />
          <path d={`M ${cx - 6} ${cy + slice.ry * 0.15} L ${cx} ${cy + slice.ry * 0.55} L ${cx + 6} ${cy + slice.ry * 0.15} Z`} fill="#1a1a1a" />
        </g>
      )}
      <text x="6" y="12" fill="#35e08a" fontSize="8" fontFamily="ui-monospace, monospace">
        {`CT  AX ${String(index + 1).padStart(2, '0')}`}
      </text>
      <text x="6" y="132" fill="#35e08a" fontSize="7" fontFamily="ui-monospace, monospace" opacity="0.85">
        {`${index + 1} / ${SLICES.length}`}
      </text>
      {SLICES.map((_, i) => (
        <rect key={i} x="150" y={14 + i * 9} width="4" height="5" fill={i === index ? '#35e08a' : '#16382f'} />
      ))}
    </svg>
  );
}

function SliceScan({ running }) {
  const index = useTicker(SLICES.length, 260, running, 5);
  return <AxialSlice slice={SLICES[index]} index={index} />;
}

function needlePoints(cx, cy, angleDeg, length, halfWidth) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const tx = cx + length * Math.cos(rad);
  const ty = cy + length * Math.sin(rad);
  const px = Math.cos(rad + Math.PI / 2);
  const py = Math.sin(rad + Math.PI / 2);
  return `${tx.toFixed(1)},${ty.toFixed(1)} ${(cx + halfWidth * px).toFixed(1)},${(cy + halfWidth * py).toFixed(1)} ${(cx - halfWidth * px).toFixed(1)},${(cy - halfWidth * py).toFixed(1)}`;
}

function EffortGauge({ value }) {
  const target = -90 + (value / 100) * 180;
  const [angle, setAngle] = React.useState(target);
  const angleRef = React.useRef(target);
  React.useEffect(() => {
    const from = angleRef.current;
    const start = performance.now();
    const id = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / 280);
      const next = from + (target - from) * (1 - (1 - t) ** 3);
      angleRef.current = next;
      setAngle(next);
      if (t >= 1) window.clearInterval(id);
    }, 32);
    return () => window.clearInterval(id);
  }, [target]);

  const cx = 80;
  const cy = 86;
  const r = 58;
  const color = effortColor(value);

  return (
    <div className="text-white">
      <svg viewBox="0 0 160 108" className="block h-auto w-full" aria-hidden="true">
        <path d={arcPath(cx, cy, r, 180, 112)} stroke="#3cba6f" strokeWidth="11" fill="none" strokeLinecap="butt" />
        <path d={arcPath(cx, cy, r, 112, 52)} stroke="#e0b03a" strokeWidth="11" fill="none" />
        <path d={arcPath(cx, cy, r, 52, 0)} stroke="#e15d5d" strokeWidth="11" fill="none" strokeLinecap="butt" />
        {Array.from({ length: 9 }, (_, i) => {
          const a = 180 - i * (180 / 8);
          const rad = (a * Math.PI) / 180;
          const inner = r - 18;
          const outer = r - 11;
          return (
            <line
              key={i}
              x1={cx + inner * Math.cos(rad)}
              y1={cy - inner * Math.sin(rad)}
              x2={cx + outer * Math.cos(rad)}
              y2={cy - outer * Math.sin(rad)}
              stroke="#d6d3d1"
              strokeWidth={i % 2 === 0 ? 1.6 : 1}
            />
          );
        })}
        <text x="14" y="102" fill="#a8a29e" fontSize="8" fontFamily="ui-monospace, monospace">
          LOW
        </text>
        <text x="122" y="102" fill="#a8a29e" fontSize="8" fontFamily="ui-monospace, monospace">
          HIGH
        </text>
        <polygon points={needlePoints(cx, cy, angle, 48, 3.2)} fill="#f5f5f4" />
        <polygon points={needlePoints(cx, cy, angle, 16, 2)} fill={color} />
        <circle cx={cx} cy={cy} r="6" fill="#e7e5e4" />
        <circle cx={cx} cy={cy} r="2.2" fill="#111113" />
      </svg>
      <p className="text-center font-mono text-sm font-bold leading-none tabular-nums" style={{ color }}>
        {Math.round(value)}
      </p>
      <p className="mt-0.5 text-center text-[10px] font-semibold tracking-wide" style={{ color }}>
        {effortLabel(value)}
      </p>
    </div>
  );
}

function Finger() {
  return (
    <span className="pointer-events-none absolute -right-0.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full bg-[#ffd7bd] shadow-md ring-2 ring-black/55" />
  );
}

function Tap({ on, press, className, children }) {
  return (
    <div className={cn('relative', className, on && press && 'scale-[0.96] brightness-110')}>
      {children}
      {on && <Finger />}
    </div>
  );
}

function CardSim({ step }) {
  const card = step.card;
  const retired = 4 - step.left;
  const enterKey =
    step.kind === 'prompt'
      ? 'prompt'
      : step.kind === 'write'
        ? `write-${card.id}-${step.phase}`
        : `card-${card.id}-${step.revealed}`;

  return (
    <div className="relative flex min-h-[196px] flex-col">
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5 text-[8px] text-muted-foreground">
        <span className="truncate font-medium">
          {step.kind === 'card' ? 'Recall' : step.kind === 'prompt' ? 'Stuck cards' : 'Write your own def'}
        </span>
        {step.kind === 'write' && <span className="shrink-0">{step.n}</span>}
      </div>
      <div key={enterKey} className="brain-prompt-in flex flex-1 flex-col">
        {step.kind === 'prompt' ? (
          <div className="flex flex-1 flex-col px-2 pb-2 pt-1">
            <p className="text-[13px] font-bold tracking-tight leading-tight">Feeling stuck?</p>
            <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">
              Try writing your own definition to lock it in.
            </p>
            <div className="mt-1.5 space-y-1">
              {STUCK_CARDS.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card px-2 py-1">
                  <p className="text-[10px] font-semibold leading-tight">{c.term}</p>
                </div>
              ))}
            </div>
            <Tap on={step.target === 'next'} press={step.press} className="mt-1.5">
              <div className="flex h-7 items-center justify-center gap-1 rounded-xl bg-primary text-[10px] font-semibold text-primary-foreground">
                Next
                <ArrowRight className="h-3 w-3" />
              </div>
            </Tap>
            <p className="mt-1 text-center text-[8px] text-muted-foreground underline underline-offset-2">
              Keep going
            </p>
          </div>
        ) : step.kind === 'write' ? (
          <div className="flex flex-1 flex-col px-2 pb-2 pt-0.5">
            <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Term</p>
            <p className="text-[13px] font-bold leading-tight tracking-tight">{card.term}</p>
            <p className="mt-0.5 text-[8px] leading-snug text-muted-foreground">
              Don’t just rewrite — paraphrase it.
            </p>
            <div className="relative mt-1 min-h-[2.4rem] overflow-hidden rounded-xl border border-border bg-card px-2 py-1">
              <p className="text-[7px] uppercase tracking-wide text-muted-foreground">Definition</p>
              {step.phase === 'type' ? (
                <p className="text-[9px] font-medium text-muted-foreground">Hold to peek</p>
              ) : (
                <p className="text-[9px] leading-snug text-muted-foreground">{card.def}</p>
              )}
            </div>
            {step.phase === 'type' ? (
              <>
                <div className="mt-1 min-h-[2.35rem] rounded-xl border border-border bg-background px-2 py-1 text-[10px] leading-snug">
                  {step.typed}
                  <span className="brain-caret" />
                </div>
                <Tap on={step.target === 'next'} press={step.press} className="mt-1">
                  <div className="flex h-7 items-center justify-center gap-1 rounded-xl bg-primary text-[10px] font-semibold text-primary-foreground">
                    Next
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </Tap>
              </>
            ) : (
              <Tap on={step.target === 'start'} press={step.press} className="mt-1">
                <div className="flex h-7 items-center justify-center rounded-xl bg-primary text-[10px] font-semibold text-primary-foreground">
                  Start typing
                </div>
              </Tap>
            )}
          </div>
        ) : (
          <>
            <div className="mx-2 mt-1 flex min-h-[92px] flex-col items-center justify-center rounded-card border border-border bg-card px-2 py-2 text-center">
              <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Term</p>
              <p className="mt-0.5 text-[15px] font-bold leading-tight tracking-tight">{card.term}</p>
              {step.revealed ? (
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{card.def}</p>
              ) : (
                <p className="mt-1.5 text-[8px] leading-snug text-muted-foreground">
                  Reveal the definition, then grade yourself.
                </p>
              )}
            </div>
            <div className="px-2 pt-1.5">
              {!step.revealed ? (
                <Tap on={step.target === 'show'} press={step.press}>
                  <div className="flex h-7 items-center justify-center gap-1 rounded-xl bg-primary text-[10px] font-semibold text-primary-foreground">
                    <Eye className="h-3 w-3" /> Show answer
                  </div>
                </Tap>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <Tap on={step.target === 'miss'} press={step.press}>
                    <div className="flex h-7 items-center justify-center gap-1 rounded-xl bg-destructive text-[10px] font-semibold text-destructive-foreground">
                      <X className="h-3 w-3" /> Missed
                    </div>
                  </Tap>
                  <Tap on={step.target === 'got'} press={step.press}>
                    <div className="flex h-8 items-center justify-center gap-1 rounded-pill bg-know/12 text-label text-know">
                      <Check className="h-3 w-3" /> Got it
                    </div>
                  </Tap>
                </div>
              )}
            </div>
            <p className="px-2 pb-1.5 pt-1 text-center text-[8px] text-muted-foreground">
              {retired} retired · {step.left} in rotation
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function HowTheBrainLearns() {
  const ref = React.useRef(null);
  const onScreen = useOnScreen(ref);
  const reduce = usePrefersReducedMotion();
  const running = onScreen && !reduce;
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (!running) return undefined;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % STEPS.length), STEPS[index].ms);
    return () => window.clearTimeout(id);
  }, [running, index]);

  const step = reduce ? STILL_STEP : STEPS[index];

  return (
    <section ref={ref} aria-label="How the brain learns" className="mx-auto mt-8 w-full max-w-md border-t border-border pt-6">
      <h2 className="text-center text-lg font-bold tracking-tight">How the brain learns</h2>
      <div className="mt-4">
        <div className="float-right mb-3 ml-3 flex w-[46%] max-w-[10.5rem] min-w-[7.5rem] flex-col gap-2">
          <div className="overflow-hidden rounded-xl ring-1 ring-black/50">
            <FiringBrain running={running} />
          </div>
          <div className="overflow-hidden rounded-xl ring-1 ring-black/50">
            <SliceScan running={running} />
          </div>
        </div>
        <div className="space-y-4 text-sm leading-relaxed text-pretty">
          <p>
            <strong>Learning works best when the brain has to work.</strong> Research on learning shows that
            actively retrieving information and working through appropriately challenging questions helps
            strengthen memory. The goal isn&apos;t to make studying harder for the sake of it—it&apos;s to create
            the <em>right</em> amount of difficulty: challenging enough to require thinking, but not so difficult
            that the learner becomes overwhelmed. This idea is known as <strong>desirable difficulty</strong>.
          </p>
          <p>
            <strong>A cleaner environment leaves more room for learning.</strong> Cognitive Load Theory suggests
            that our working memory has limited capacity. When an interface is cluttered with unnecessary
            buttons, information, and distractions, part of that capacity is spent figuring out the interface
            instead of learning. By removing unnecessary complexity, bharris.app reduces{' '}
            <strong>extraneous cognitive load</strong>, helping you focus your attention on what actually
            matters: the material.
          </p>
        </div>
        <div className="clear-both" />
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold tracking-tight">Where flashcards get sticky</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          A card you already know is a quick flip. The gauge stays on low effort, because that answer came easily.
        </p>
        <div
          className="mt-3 flex items-stretch gap-2 overflow-hidden rounded-card border border-border bg-background p-2"
          data-kind={step.kind}
          data-phase={step.phase || ''}
          data-effort={step.effort}
          data-term={step.card?.term || 'prompt'}
          data-typed={step.typed || ''}
        >
          <div className="flex w-[6.6rem] shrink-0 flex-col justify-center">
            <EffortGauge value={step.effort} />
          </div>
          <div className="w-px self-stretch bg-white/15" aria-hidden="true" />
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl bg-background text-foreground">
            <CardSim step={step} />
          </div>
        </div>
        <div className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-muted-foreground">
          <p>
            Then the set is down to two cards. They come past twice, and both times they are still missed. That
            repeat is the sticky spot in a normal flashcard deck: the card keeps returning, and another look at
            the answer leaves it stuck.
          </p>
          <p>
            bharris.app breaks that loop. After those misses, the same prompt from a real session comes up, and
            the screen switches to writing the definition in your own words. The gauge sits on high effort,
            because you have to rebuild the idea instead of flipping the card again. That is the part that pulls
            a stuck card loose.
          </p>
        </div>
      </div>
    </section>
  );
}
