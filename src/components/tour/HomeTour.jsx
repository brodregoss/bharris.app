import React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  REPLAY_TOUR_EVENT,
  consumeHomeTourReplay,
  homeTourChoice,
  setHomeTourChoice,
} from '@/lib/appTour';
import { PAGE_SLIDE_MS, armPageSlide } from '@/components/PageTransition';
import { loadLatestCram } from '@/lib/sessionStore';
import { trueCramPracticeState } from '@/lib/studyUtils';
import { HOME_TOUR_FLAG, userStorageKey } from '@/lib/userStorage';

const STEPS = [
  {
    route: '/',
    target: 'new-cram',
    title: 'Start new cram',
    body: (
      <ul className="list-disc space-y-1.5 pl-4">
        <li>Use this when you're ready to start studying another topic.</li>
        <li>Your past sets stay saved in Past sessions.</li>
      </ul>
    ),
  },
  {
    route: '/',
    target: 'practice',
    title: 'Practice',
    body: 'This opens practice.',
  },
  {
    route: '/practice',
    target: 'practice-slider',
    title: 'Practice content slider',
    body: (
      <ul className="list-disc space-y-1.5 pl-4">
        <li>
          <strong className="whitespace-nowrap font-semibold text-foreground">All terms</strong>
          {' '}lets you practice all of the terms in the set.
        </li>
        <li>
          <strong className="whitespace-nowrap font-semibold text-foreground">To work on</strong>
          {' '}lets you practice the terms in the set that seem a bit more challenging.
        </li>
        <li>You can see the term classification under the Terms dropdown.</li>
      </ul>
    ),
  },
  {
    route: '/practice',
    target: 'practice-modes',
    title: 'Practice modes',
    body: 'Pick whatever helps you learn best.',
  },
  {
    route: '/',
    target: 'panic',
    title: 'Panic notes',
    body: 'A cheat sheet for right before the test. Use it for one last review so the terms are fresh when you walk in.',
  },
  {
    route: '/',
    target: 'history',
    title: 'Past sessions',
    body: 'Old crams stay here.',
  },
  {
    route: '/',
    target: 'settings',
    title: 'Settings',
    body: 'Account, appearance, and plan.',
  },
];

function isParked(node) {
  let current = node;
  while (current) {
    const hidden = current.getAttribute?.('aria-hidden') === 'true';
    const parked = current.classList?.contains('pointer-events-none');
    if (hidden && parked) return true;
    current = current.parentElement;
  }
  return false;
}

function isShown(node) {
  return !!node && !isParked(node);
}

function targetRect(id) {
  const nodes = document.querySelectorAll(`[data-tour="${id}"]`);
  for (const el of nodes) {
    if (!isShown(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    };
  }
  return null;
}

function cardStyle(rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(352, vw - 32);
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(16, Math.min(left, vw - 16 - width));
  const gap = 14;
  const estimate = 160;
  const belowTop = rect.bottom + gap;
  const roomBelow = vh - belowTop;
  const roomAbove = rect.top - gap;
  const shared = {
    left: `max(${left}px, calc(env(safe-area-inset-left) + 12px))`,
    width,
    maxWidth: 'calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right) - 24px)',
  };
  if (roomBelow >= estimate || roomBelow >= roomAbove) {
    return {
      ...shared,
      top: `max(${belowTop}px, calc(env(safe-area-inset-top) + 12px))`,
    };
  }
  return {
    ...shared,
    bottom: `max(${vh - rect.top + gap}px, calc(env(safe-area-inset-bottom) + 12px))`,
  };
}

function actionLabel(index) {
  const next = STEPS[index + 1];
  if (!next) return 'Done';
  if (next.route === '/practice' && STEPS[index].route !== '/practice') return 'Open';
  return 'Next';
}

function TourCard({ step, index, onNext, onSkip, nextRef }) {
  return (
    <div className="tour-step-in rounded-card border border-border bg-background p-5 text-foreground shadow-xl">
      <p className="text-xs font-medium text-muted-foreground">
        {index + 1} of {STEPS.length}
      </p>
      <h2 id="home-tour-title" className="mt-1 text-lg font-bold tracking-tight">
        {step.title}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Skip
        </button>
        <Button ref={nextRef} type="button" onClick={onNext} className="h-10 rounded-full px-5">
          {actionLabel(index)}
        </Button>
      </div>
    </div>
  );
}

function TourSpotlight({ step, index, onNext, onSkip }) {
  const nextRef = React.useRef(null);
  const [box, setBox] = React.useState(null);

  const measure = React.useCallback(() => {
    setBox(targetRect(step.target));
  }, [step.target]);

  React.useLayoutEffect(() => {
    measure();
    nextRef.current?.focus();
    const frame = window.requestAnimationFrame(measure);
    const later = window.setTimeout(measure, 400);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(later);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onSkip]);

  const dark = document.documentElement.classList.contains('dark');
  const shade = dark ? 'hsl(0 0% 0% / 0.72)' : 'hsl(0 0% 0% / 0.55)';
  const ring = dark ? 'hsl(0 0% 100% / 0.9)' : 'hsl(0 0% 100% / 0.95)';
  const pad = 6;
  const radius = box && Math.abs(box.width - box.height) < 4 ? 9999 : 16;

  const card = (
    <TourCard
      step={step}
      index={index}
      onNext={onNext}
      onSkip={onSkip}
      nextRef={nextRef}
    />
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-tour-title"
      className="fixed inset-0 z-[80]"
    >
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed"
          style={{
            top: box.top - pad,
            left: box.left - pad,
            width: box.width + pad * 2,
            height: box.height + pad * 2,
            borderRadius: radius,
            boxShadow: `0 0 0 2px ${ring}, 0 0 0 9999px ${shade}`,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55 dark:bg-black/70" />
      )}
      <div className="absolute inset-0 z-0" />
      {box ? (
        <div className="pointer-events-auto fixed z-10" style={cardStyle(box)}>
          {card}
        </div>
      ) : (
        <div className="pointer-events-auto fixed left-1/2 top-1/2 z-10 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2">
          {card}
        </div>
      )}
    </div>,
    document.body
  );
}

function openPractice(navigate) {
  const session = loadLatestCram();
  const cram = trueCramPracticeState(session);
  navigate('/practice', cram ? { state: cram } : undefined);
}

export default function HomeTour() {
  const location = useLocation();
  const navigate = useNavigate();
  const sentinelRef = React.useRef(null);
  const [phase, setPhase] = React.useState('idle');
  const [step, setStep] = React.useState(0);
  const [traveling, setTraveling] = React.useState(false);
  const openingTour = React.useRef(false);
  const travelTimer = React.useRef(0);
  const pathname = location.pathname;

  const finish = React.useCallback((value) => {
    setHomeTourChoice(value);
    setPhase('idle');
  }, []);

  const skip = React.useCallback(() => {
    window.clearTimeout(travelTimer.current);
    setTraveling(false);
    finish('skipped');
    if (pathname !== '/') navigate('/');
  }, [finish, navigate, pathname]);

  const start = React.useCallback(() => {
    openingTour.current = true;
    setStep(0);
    setPhase('tour');
  }, []);

  React.useEffect(() => {
    const node = sentinelRef.current;
    const sync = () => {
      if (pathname !== '/') return;
      if (consumeHomeTourReplay()) {
        setStep(0);
        setPhase('tour');
        return;
      }
      if (!document.querySelector('[data-tour="new-cram"]') || !isShown(node)) return;
      setPhase((current) => {
        if (current !== 'idle') return current;
        if (!userStorageKey(HOME_TOUR_FLAG) || homeTourChoice()) return current;
        return 'prompt';
      });
    };
    sync();
    const frame = window.requestAnimationFrame(sync);
    const soon = window.setTimeout(sync, 60);
    const later = window.setTimeout(sync, 320);
    const observer = new MutationObserver(sync);
    let ancestor = node?.parentElement;
    while (ancestor) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['aria-hidden'] });
      ancestor = ancestor.parentElement;
    }
    window.addEventListener(REPLAY_TOUR_EVENT, sync);
    window.addEventListener('lms:session', sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(soon);
      window.clearTimeout(later);
      observer.disconnect();
      window.removeEventListener(REPLAY_TOUR_EVENT, sync);
      window.removeEventListener('lms:session', sync);
    };
  }, [pathname]);

  React.useEffect(() => () => window.clearTimeout(travelTimer.current), []);

  const onNext = () => {
    const next = STEPS[step + 1];
    if (!next) {
      finish('done');
      if (pathname !== '/') navigate('/');
      return;
    }
    if (next.route === pathname) {
      setStep(step + 1);
      return;
    }
    const nextIndex = step + 1;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      setTraveling(true);
      armPageSlide();
    }
    if (next.route === '/practice') openPractice(navigate);
    else navigate(next.route);
    if (reduce) {
      setStep(nextIndex);
      return;
    }
    window.clearTimeout(travelTimer.current);
    travelTimer.current = window.setTimeout(() => {
      setStep(nextIndex);
      setTraveling(false);
    }, PAGE_SLIDE_MS + 50);
  };

  const current = STEPS[step];

  return (
    <>
      <span ref={sentinelRef} hidden />
      <Dialog
        open={phase === 'prompt' && pathname === '/'}
        onOpenChange={(open) => {
          if (open) return;
          if (openingTour.current) {
            openingTour.current = false;
            return;
          }
          skip();
        }}
      >
        <DialogContent className="max-w-sm rounded-card">
          <DialogHeader>
            <DialogTitle>Want a quick look around?</DialogTitle>
            <DialogDescription>A few seconds on where things are.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button type="button" className="h-12 rounded-full" onClick={start}>
              Show me
            </Button>
            <Button type="button" variant="secondary" className="h-12 rounded-full" onClick={skip}>
              Skip
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {phase === 'tour' && !traveling && current && pathname === current.route && (
        <TourSpotlight
          step={current}
          index={step}
          onNext={onNext}
          onSkip={skip}
        />
      )}
    </>
  );
}
