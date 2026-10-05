import React from 'react';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';

const ENTER_MS = 280;

/** Plays the page enter animation, then drops the class so no transform remains. */
export function PageEnter({ className, children }) {
  const [playing, setPlaying] = React.useState(() => Capacitor.isNativePlatform());

  React.useEffect(() => {
    if (!playing) return undefined;
    const id = window.setTimeout(() => setPlaying(false), ENTER_MS);
    return () => window.clearTimeout(id);
  }, [playing]);

  return (
    <div data-page-motion={playing ? 'playing' : 'settled'} className={cn(playing && 'page-in', className)}>
      {children}
    </div>
  );
}

/** Fades in when the view key changes. The first paint stays still so a route enter is not doubled. */
export default function ScreenSwap({ viewKey, className, children }) {
  const seen = React.useRef(false);
  const animate = seen.current;

  React.useEffect(() => {
    seen.current = true;
  });

  if (!animate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <PageEnter key={viewKey} className={className}>
      {children}
    </PageEnter>
  );
}
