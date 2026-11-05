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

/** Fades in when the view key changes. The first paint stays still so a route enter is not doubled.
 *  The wrapper stays the same element while the key is unchanged, so a later update (a grade,
 *  a saved term) cannot remount the screen and wipe what the user is looking at. */
export default function ScreenSwap({ viewKey, className, children }) {
  const skip = React.useRef(true);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return undefined;
    }
    setPlaying(true);
    const id = window.setTimeout(() => setPlaying(false), ENTER_MS);
    return () => window.clearTimeout(id);
  }, [viewKey]);

  return (
    <div key={viewKey} data-page-motion={playing ? 'playing' : 'settled'} className={cn(playing && 'page-in', className)}>
      {children}
    </div>
  );
}
