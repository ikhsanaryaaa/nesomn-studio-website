export function isSidebarActive(to: string, pathname: string, search: string, end = false) {
  const target = new URL(to, 'https://nesomn.invalid');
  if (pathname !== target.pathname && (end || !pathname.startsWith(target.pathname + '/')))
    return false;
  if (target.pathname !== '/marketplace') return true;
  const selected = new URLSearchParams(search).get('type') ?? 'all';
  return selected === (target.searchParams.get('type') ?? 'all');
}
