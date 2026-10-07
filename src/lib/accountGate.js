export function accountRedirect({ authenticated = false, dev = false, sampleOpen = false } = {}) {
  if (authenticated) return null;
  if (dev && sampleOpen) return null;
  return '/account';
}
