import React from 'react';
import { checkUsernameAvailable } from '@/lib/workerClient';
import { parseUsername, typedUsername } from '@/lib/username';

export function useUsernameAvailability(value, current = '') {
  const [status, setStatus] = React.useState('');
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    const parsed = parseUsername(value);
    const mine = typedUsername(current);
    if (!value || (parsed.error && value.length < 3) || parsed.username === mine) {
      setStatus('');
      setNote('');
      return undefined;
    }
    if (parsed.error) {
      setStatus('invalid');
      setNote(parsed.error);
      return undefined;
    }
    let cancelled = false;
    setStatus('');
    setNote('');
    const timer = window.setTimeout(async () => {
      setStatus('checking');
      setNote('Checking…');
      try {
        const data = await checkUsernameAvailable(parsed.username);
        if (cancelled) return;
        if (data?.available) {
          setStatus('available');
          setNote('Available');
        } else {
          setStatus('taken');
          setNote('That username is taken.');
        }
      } catch {
        if (!cancelled) {
          setStatus('');
          setNote('');
        }
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, current]);

  return { status, note };
}

export function UsernameAvailability({ status, note }) {
  if (!note) return null;
  const tone = status === 'taken' || status === 'invalid'
    ? 'text-destructive'
    : status === 'available'
      ? 'text-know'
      : 'text-muted-foreground';
  return <p className={`text-sm ${tone}`}>{note}</p>;
}
