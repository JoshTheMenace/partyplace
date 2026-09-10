import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';
/** Client routes. `/?game=<id>` is shareable on the current static server; `/games/<id>` is accepted for a future SPA fallback. */
export type Route = { view: 'home' | 'discover' } | { view: 'game'; id: string };
const browser = typeof window !== 'undefined';
export function parseRoute(url: { pathname: string; search: string } = browser ? location : { pathname: '/', search: '' }): Route {
  const path = url.pathname.match(/^\/games\/([a-z0-9-]{1,40})\/?$/i);
  const id = path?.[1] ?? new URLSearchParams(url.search).get('game');
  return id && /^[a-z0-9-]{1,40}$/i.test(id) ? { view: 'game', id: id.toLowerCase() } : { view: new URLSearchParams(url.search).get('view') === 'discover' ? 'discover' : 'home' };
}
export const gameHref = (id: string) => `/?game=${encodeURIComponent(id)}`;
const listeners = new Set<() => void>();
let current = parseRoute();
function refresh() { current = parseRoute(); for (const listener of listeners) listener(); }
if (browser) window.addEventListener('popstate', refresh);
export function navigate(route: Route) {
  const search = new URLSearchParams(location.search); search.delete('game'); search.delete('view');
  if (route.view === 'game') search.set('game', route.id);
  if (route.view === 'discover') search.set('view', 'discover');
  const query = search.toString();
  history.pushState(null, '', `/${query ? `?${query}` : ''}`);
  refresh();
  window.scrollTo(0, 0);
}
export function useRoute() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => current); }
/** Same-tab navigation without a reload; modified clicks and middle clicks keep native behaviour. */
export function Link({ route, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { route: Route }) {
  const href = route.view === 'game' ? gameHref(route.id) : route.view === 'discover' ? '/?view=discover' : '/';
  return <a {...props} href={href} onClick={(event: MouseEvent<HTMLAnchorElement>) => { onClick?.(event); if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(route); }}/>;
}
