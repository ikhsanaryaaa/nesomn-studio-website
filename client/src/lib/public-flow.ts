export function safeReturnTo(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\%]/.test(value) ||
    [...value].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)
  )
    return '/account';
  const path = value.split(/[?#]/)[0];
  if (/^\/(login|register|api|admin)(\/|$)/.test(path)) return '/account';
  return value;
}
export const loginUrl = (path: string) =>
  '/login?returnTo=' + encodeURIComponent(safeReturnTo(path));
export const rp = (value: string | number) =>
  new Intl.NumberFormat('en-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
