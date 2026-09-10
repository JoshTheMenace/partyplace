/** Catalog metadata is independent of the room/game runtime. */
export type CatalogCapability = 'browser-play' | 'shared-display' | 'phone-controllers' | 'solo' | 'keyboard' | 'touch' | 'server-autosave' | 'host-browser-progress' | 'lan-only';
export type CatalogGame = {
  id: string; title: string; description: string; category: string;
  status: 'ready' | 'in-progress'; players: { min: number; max: number }; supportsSolo: boolean;
  requiresSharedDisplay: boolean; cooperative: boolean; controls: string[]; playTime: string;
  launch: 'room' | 'external' | 'unavailable'; playUrl?: string; sourceUrl?: string; artwork?: string;
  searchTerms: string[]; creator?: { name: string; url?: string }; detail?: string;
  capabilities?: CatalogCapability[]; tags?: string[]; released?: string; sourceId?: string; sourceName?: string;
};
export type CatalogSource = { id: string; name: string; description: string; games: CatalogGame[] };
export const isCatalogId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{1,40}$/.test(value);
const capabilities: CatalogCapability[] = ['browser-play','shared-display','phone-controllers','solo','keyboard','touch','server-autosave','host-browser-progress','lan-only'];
function object(value: unknown): Record<string, any> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected an object'); return value; }
function text(value: unknown, label: string, max = 2000): string { if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`Invalid ${label}`); return value.trim(); }
function id(value: unknown): string { if (!isCatalogId(value)) throw Error('Invalid id (use 1–40 lowercase letters, digits or hyphens)'); return value; }
function strings(value: unknown): string[] { if (value === undefined) return []; if (!Array.isArray(value) || value.length > 30) throw Error('Expected at most 30 labels'); return value.map(v => text(v, 'label', 100)); }
function flag(value: unknown, fallback: boolean): boolean { if (value === undefined) return fallback; if (typeof value !== 'boolean') throw Error('Expected a boolean'); return value; }
function url(value: unknown): string {
  const result = text(value, 'URL', 2048), parsed = new URL(result);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw Error('URLs must use HTTPS without credentials');
  return parsed.href;
}
export function parseCatalogGame(value: unknown): CatalogGame {
  const g = object(value), players = object(g.players);
  if (!Number.isInteger(players.min) || !Number.isInteger(players.max) || players.min < 1 || players.max < players.min || players.max > 1000) throw Error('Invalid player range');
  if (!['room','external','unavailable'].includes(g.launch)) throw Error('Choose launch: room, external or unavailable');
  if (g.status !== undefined && !['ready','in-progress'].includes(g.status)) throw Error('Invalid status');
  const result: CatalogGame = {
    id: id(g.id), title: text(g.title, 'title', 120), description: text(g.description, 'description'),
    category: text(g.category ?? 'Game', 'category', 60), status: g.status ?? 'ready', players: { min: players.min, max: players.max },
    supportsSolo: flag(g.supportsSolo, players.min === 1), requiresSharedDisplay: flag(g.requiresSharedDisplay, false), cooperative: flag(g.cooperative, false),
    controls: strings(g.controls), playTime: text(g.playTime ?? 'Varies', 'play time', 80), launch: g.launch, searchTerms: strings(g.searchTerms),
  };
  for (const key of ['playUrl','sourceUrl','artwork'] as const) if (g[key] !== undefined) result[key] = url(g[key]);
  if (result.launch === 'external' && !result.playUrl) throw Error('External games need playUrl');
  if (result.launch !== 'external' && result.playUrl) throw Error('playUrl requires launch: external');
  if (g.creator !== undefined) { const c = object(g.creator); result.creator = { name: text(c.name, 'creator', 120), ...(c.url !== undefined ? { url: url(c.url) } : {}) }; }
  if (g.detail !== undefined) result.detail = text(g.detail, 'detail', 8000);
  if (g.tags !== undefined) result.tags = strings(g.tags);
  if (g.capabilities !== undefined) { const list = strings(g.capabilities); if (list.some(c => !capabilities.includes(c as CatalogCapability))) throw Error('Unknown capability'); result.capabilities = list as CatalogCapability[]; }
  if (g.released !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(g.released) || !Number.isFinite(Date.parse(g.released))) throw Error('Invalid release date'); result.released = g.released; }
  if (g.sourceId !== undefined) result.sourceId = id(g.sourceId);
  if (g.sourceName !== undefined) result.sourceName = text(g.sourceName, 'source name', 120);
  return result;
}
export function parseCatalog(value: unknown): CatalogSource[] {
  const data = object(value);
  if (data.version !== 1 || !Array.isArray(data.sources) || data.sources.length > 100) throw Error('Expected version 1 and up to 100 sources');
  const sourceIds = new Set<string>(), gameIds = new Set<string>();
  return data.sources.map((value: unknown) => {
    const source = object(value), sourceId = id(source.id), name = text(source.name, 'source name', 120);
    if (sourceIds.has(sourceId) || !Array.isArray(source.games)) throw Error(`Invalid or duplicate source: ${sourceId}`);
    sourceIds.add(sourceId);
    const games = source.games.map((value: unknown) => {
      const game = parseCatalogGame(value);
      if (gameIds.has(game.id) || gameIds.size >= 500) throw Error(`Duplicate game or catalog exceeds 500 games: ${game.id}`);
      gameIds.add(game.id); return { ...game, sourceId, sourceName: name };
    });
    return { id: sourceId, name, description: source.description === undefined ? '' : text(source.description, 'source description'), games };
  });
}
