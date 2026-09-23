import { greetingName } from '@/lib/personName';
import { userStorageKey } from '@/lib/userStorage';

const KEY = 'lms_greeting_name_v1';

export function greetingNameStyle() {
  if (typeof window === 'undefined') return 'last';
  const key = userStorageKey(KEY);
  if (!key) return 'last';
  return localStorage.getItem(key) === 'first' ? 'first' : 'last';
}

export function setGreetingNameStyle(style) {
  const key = userStorageKey(KEY);
  if (!key) return;
  localStorage.setItem(key, style === 'first' ? 'first' : 'last');
}

function dayPartLabel(date) {
  const hour = date.getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

export function greetingLine(displayName, date, style = greetingNameStyle()) {
  const hello = `Good ${dayPartLabel(date)}`;
  const name = greetingName(displayName, style);
  return name ? `${hello}, ${name}` : hello;
}
