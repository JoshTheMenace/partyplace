import { useSyncExternalStore } from 'react';
import { isCatalogId, parseCatalogGame, type CatalogGame } from '../../../packages/party-catalog/src/index';
/** Membership is explicit; old favorites/recent entries do not populate a new library. */
export type LibraryState = { games: CatalogGame[]; favorites: string[]; recent: { id: string; at: number }[] };
const KEY = 'party.library.v1', RECENT_MAX = 12;
export function parseLibrary(raw: Partial<LibraryState> | null): LibraryState {
  const games: CatalogGame[] = [];
  if (Array.isArray(raw?.games)) for (const value of raw.games.slice(0, 500)) try { const game = parseCatalogGame(value); if (!games.some(g => g.id === game.id)) games.push(game); } catch { /* Skip malformed saved entries. */ }
  return { games, favorites: Array.isArray(raw?.favorites) ? raw.favorites.filter(isCatalogId) : [], recent: Array.isArray(raw?.recent) ? raw.recent.filter(entry => entry && isCatalogId(entry.id) && Number.isFinite(entry.at)).slice(0, RECENT_MAX) : [] };
}
function read(): LibraryState { try { return parseLibrary(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return parseLibrary(null); } }
let state = read();
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };
function write(next: LibraryState) { state = next; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Keep the in-memory copy if storage is unavailable. */ } notify(); }
if (typeof window !== 'undefined') window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { state = read(); notify(); } });
export const library = {
  add(game: CatalogGame) { if (!state.games.some(g => g.id === game.id) && state.games.length < 500) write({ ...state, games: [...state.games, parseCatalogGame(game)] }); },
  remove(id: string) { write({ ...state, games: state.games.filter(g => g.id !== id), favorites: state.favorites.filter(g => g !== id), recent: state.recent.filter(g => g.id !== id) }); },
  toggleFavorite(id: string) { if (isCatalogId(id)) write({ ...state, favorites: state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id] }); },
  touch(id: string) { if (isCatalogId(id)) write({ ...state, recent: [{ id, at: Date.now() }, ...state.recent.filter(entry => entry.id !== id)].slice(0, RECENT_MAX) }); },
};
export function useLibrary() {
  const snapshot = useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => state);
  return { ...snapshot, has: (id: string) => snapshot.games.some(g => g.id === id), isFavorite: (id: string) => snapshot.favorites.includes(id), ...library };
}
