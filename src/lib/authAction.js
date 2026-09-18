export function rewriteFirebaseResetUrl() {
  if (typeof window === 'undefined') return;
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash || '';
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const hashParams = new URLSearchParams(hashQuery);
  const mode = search.get('mode') || hashParams.get('mode');
  const oobCode = search.get('oobCode') || hashParams.get('oobCode');
  if (mode !== 'resetPassword' || !oobCode) return;
  if (hash.startsWith('#/account/reset')) return;
  const next = `${window.location.pathname}#/account/reset?mode=${encodeURIComponent(mode)}&oobCode=${encodeURIComponent(oobCode)}`;
  window.location.replace(next);
}
