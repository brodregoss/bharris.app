const SITE_RETURNS = new Set(['/', '/plans/', '/account/', '/manage/', '/privacy/', '/terms/', '/thanks/', '/contact/']);

export function safeAuthReturn(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '';
  if (value.includes('..') || value.includes('\\')) return '';
  if (value === '/thanks/?plan=partner') return value;
  if (/[?#]/.test(value)) return '';
  const path = value === '/' ? '/' : (value.endsWith('/') ? value : `${value}/`);
  return SITE_RETURNS.has(path) ? path : '';
}
