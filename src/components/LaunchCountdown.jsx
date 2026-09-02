import React from 'react';

// One-shot launch intro: a 7-segment digital clock counts 1:37 -> 0:01,
// flashes, then shows the current time in the same style before fading away.
// Plays once per browser session.

const SESSION_KEY = 'lms_launch_seen';
const TICK_MS = 55; // fast countdown
const START = 97; // 1:37
const END = 1; // 0:01

function fmtCountdown(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtNow() {
  const d = new Date();
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function LaunchCountdown() {
  const [phase, setPhase] = React.useState('hold'); // hold | count | flash | now | message | done
  const [secs, setSecs] = React.useState(START);
  const [now, setNow] = React.useState('');

  React.useEffect(() => {
    // First-time visitors go straight to the welcome screen — no countdown.
    const firstVisit = !localStorage.getItem('lms_onboarded');
    if (firstVisit || sessionStorage.getItem(SESSION_KEY)) {
      setPhase('done');
      return;
    }
    // Hold the opening number (1:37) for a beat before the countdown starts.
    const startTimer = setTimeout(() => setPhase('count'), 1500);
    let cur = START;
    const id = setInterval(() => {
      cur -= 1;
      if (cur <= END) {
        clearInterval(id);
        setSecs(END);
        setPhase('flash');
        setTimeout(() => {
          setNow(fmtNow());
          setPhase('now');
          setTimeout(() => {
            setPhase('message');
            setTimeout(() => {
              sessionStorage.setItem(SESSION_KEY, '1');
              setPhase('done');
            }, 1800);
          }, 1300);
        }, 180);
      } else {
        setSecs(cur);
      }
    }, TICK_MS);
    return () => {
      clearTimeout(startTimer);
      clearInterval(id);
    };
  }, []);

  if (phase === 'done') return null;

  if (phase === 'message') {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center px-8 text-center animate-in fade-in duration-700" aria-hidden>
        <p className="text-white text-2xl font-semibold tracking-tight">you don't need more time</p>
        <p className="text-white/60 text-2xl font-semibold tracking-tight mt-2">you just need to use it</p>
      </div>
    );
  }

  const display = phase === 'now' ? now : fmtCountdown(secs);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-500 ${
        phase === 'now' ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden
    >
      {phase === 'flash' && <div className="absolute inset-0 bg-white animate-pulse" />}
      <div className="flex flex-col items-center">
        <div
          className="font-mono font-bold leading-none tracking-wider select-none"
          style={{
            fontSize: 'clamp(4rem, 18vw, 9rem)',
            color: '#ff0000',
            textShadow:
              '0 0 6px #ff0000, 0 0 18px #ff0000, 0 0 40px rgba(255,0,0,0.6)',
          }}
        >
          {display}
        </div>
        {/* mirrored reflection */}
        <div
          className="font-mono font-bold leading-none tracking-wider select-none -mt-1"
          style={{
            fontSize: 'clamp(4rem, 18vw, 9rem)',
            color: '#ff0000',
            opacity: 0.3,
            transform: 'scaleY(-1)',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 60%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent 60%)',
            textShadow: '0 0 12px rgba(255,0,0,0.5)',
          }}
          aria-hidden
        >
          {display}
        </div>
      </div>
    </div>
  );
}