import React from 'react';
import { useTheme } from 'next-themes';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

function applyNativeChrome(dark) {
  const color = dark ? '#1e1c1a' : '#f8fafc';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', color);
  const status = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  // black-translucent = white time/battery over the page; default = black.
  if (status) status.setAttribute('content', dark ? 'black-translucent' : 'default');
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

  if (!Capacitor.isNativePlatform()) return;
  // DARK = white icons on a dark page; LIGHT = black icons on a light page.
  SystemBars.setStyle({
    style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  }).catch(() => {});
}

// Keeps the iOS status bar (time, battery, signal) readable against the app theme.
export default function NativeChrome() {
  const { resolvedTheme, theme } = useTheme();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setReady(true);
  }, []);

  const dark = ready && (resolvedTheme || theme) === 'dark';

  React.useEffect(() => {
    if (!ready) return;
    applyNativeChrome(dark);
  }, [dark, ready]);

  return null;
}
