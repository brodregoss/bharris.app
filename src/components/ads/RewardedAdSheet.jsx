import React from 'react';
import { Capacitor } from '@capacitor/core';
import { AD_PLACEMENTS, WEB_REWARD_SECONDS, beginNativeHold, playNativeReward, registerRewardCancel, registerRewardedFlow, subscribeRewardProgress } from '@/lib/ads';
import { Button } from '@/components/ui/button';

function RewardPrompt({ placement, onWatch, onDecline }) {
  const copy = AD_PLACEMENTS[placement] || AD_PLACEMENTS.review;

  return (
    <div className="fixed inset-0 z-[80] bg-background text-foreground flex flex-col" role="dialog" aria-modal="true" aria-labelledby="reward-prompt-title">
      <header className="px-5 pt-safe pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ad</p>
      </header>
      <main className="flex-1 px-6 flex flex-col items-center justify-center text-center">
        <h2 id="reward-prompt-title" className="text-2xl font-bold tracking-tight max-w-sm">{copy.title}</h2>
        <p className="text-sm text-muted-foreground mt-3 max-w-sm leading-relaxed">{copy.body}</p>
      </main>
      <footer className="px-6 pb-safe pt-2">
        <div className="w-full max-w-md mx-auto flex flex-col gap-3">
          <Button
            type="button"
            className="w-full h-12 rounded-2xl font-semibold"
            onClick={onWatch}
          >
            Watch ad
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-2xl font-semibold"
            onClick={onDecline}
          >
            Not now
          </Button>
        </div>
      </footer>
    </div>
  );
}

function GenerationProgress({ progress }) {
  const fraction = progress?.fraction || 0;
  const label = progress?.label || 'Reading your notes…';
  return (
    <div className="px-5 pt-safe pb-2">
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        aria-label="Notes generating"
      >
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-300"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5 text-center">{label}</p>
    </div>
  );
}

function RewardedAdSheet({ onFinish, hold = false, progress = null }) {
  const [left, setLeft] = React.useState(WEB_REWARD_SECONDS);
  const nativeHold = hold && Capacitor.isNativePlatform();

  React.useEffect(() => {
    if (nativeHold) return undefined;
    let cycleStart = Date.now();
    const id = window.setInterval(() => {
      const remaining = WEB_REWARD_SECONDS - Math.floor((Date.now() - cycleStart) / 1000);
      if (remaining <= 0) {
        if (hold) {
          cycleStart = Date.now();
          setLeft(WEB_REWARD_SECONDS);
          return;
        }
        window.clearInterval(id);
        onFinish(true);
        return;
      }
      setLeft(remaining);
    }, 250);
    return () => window.clearInterval(id);
  }, [onFinish, hold, nativeHold]);

  return (
    <div className="fixed inset-0 z-[80] bg-background text-foreground flex flex-col" role="dialog" aria-modal="true" aria-label="Ad">
      {hold ? <GenerationProgress progress={progress} /> : null}
      <header className={`px-5 pb-2 flex items-center justify-between ${hold ? '' : 'pt-safe'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ad</p>
        {hold ? null : (
          <button
            type="button"
            onClick={() => onFinish(false)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        )}
      </header>
      <main className="flex-1 px-6 flex flex-col items-center justify-center text-center">
        {nativeHold ? (
          <p className="text-sm text-muted-foreground max-w-xs">An ad plays while your notes are read.</p>
        ) : (
          <div className="w-full max-w-md rounded-3xl border border-border bg-muted/50 px-6 py-16">
            <p className="text-5xl font-bold tabular-nums">{left}</p>
            <p className="text-xs text-muted-foreground mt-2">seconds left</p>
          </div>
        )}
      </main>
      {hold ? null : (
        <footer className="px-6 pb-safe pt-2">
          <Button
            type="button"
            variant="outline"
            className="w-full max-w-md mx-auto h-12 rounded-2xl font-semibold flex"
            onClick={() => onFinish(false)}
          >
            Close without continuing
          </Button>
        </footer>
      )}
    </div>
  );
}

export function AdsProvider({ children }) {
  const [request, setRequest] = React.useState(null);
  const [progress, setProgress] = React.useState(null);
  const requestRef = React.useRef(null);
  const adSeq = React.useRef(0);

  React.useEffect(() => subscribeRewardProgress(setProgress), []);

  React.useEffect(() => {
    registerRewardedFlow((placement, options) => new Promise((resolve) => {
      const hold = !!options?.withProgress;
      if (options?.prompted && Capacitor.isNativePlatform() && !hold) {
        playNativeReward()
          .catch(() => true)
          .then((earned) => resolve(!!earned));
        return;
      }
      requestRef.current = { resolve };
      adSeq.current += 1;
      setRequest({
        id: adSeq.current,
        placement,
        phase: options?.prompted ? 'ad' : 'prompt',
        withProgress: hold,
      });
      if (hold && Capacitor.isNativePlatform()) {
        let stopped = false;
        beginNativeHold(() => { stopped = true; });
        (async () => {
          while (!stopped) {
            await playNativeReward().catch(() => true);
            if (stopped) break;
            await new Promise((done) => setTimeout(done, 400));
          }
        })();
      }
    }));
    return () => registerRewardedFlow(null);
  }, []);

  const finish = React.useCallback((earned) => {
    const current = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    current?.resolve(!!earned);
  }, []);

  React.useEffect(() => {
    registerRewardCancel(() => finish(true));
    return () => registerRewardCancel(null);
  }, [finish]);

  const watch = React.useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      const current = requestRef.current;
      requestRef.current = null;
      setRequest(null);
      playNativeReward()
        .catch(() => true)
        .then((earned) => current?.resolve(!!earned));
      return;
    }
    setRequest((current) => (current ? { ...current, phase: 'ad' } : current));
  }, []);

  return (
    <>
      {children}
      {request?.phase === 'prompt' && (
        <RewardPrompt placement={request.placement} onWatch={watch} onDecline={() => finish(false)} />
      )}
      {request?.phase === 'ad' && (
        <RewardedAdSheet
          key={request.id}
          onFinish={finish}
          hold={request.withProgress}
          progress={request.withProgress ? progress : null}
        />
      )}
    </>
  );
}

export function PanicAdSlot() {
  return (
    <div className="rounded-2xl border border-border bg-muted/40 px-4 py-8 text-center mb-6" role="region" aria-label="Ad">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ad</p>
      <p className="text-sm text-muted-foreground mt-2">This stays up while your notes are written.</p>
    </div>
  );
}
