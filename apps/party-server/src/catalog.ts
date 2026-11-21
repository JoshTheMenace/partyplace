import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCatalog } from '../../../packages/party-catalog/src/index';
/**
 * Read the separate curator-owned file on each request; edits never require a rebuild.
 * `rooms` maps each installed game to its manifest roster, which replaces the listing's own `players`:
 * raising a game's `players.max` never needs a catalog edit.
 */
export async function readCatalog(path = resolve(process.env.PARTY_CATALOG_PATH ?? 'catalog/sources.json'), rooms?: ReadonlyMap<string, { min: number; max: number }>) {
  if ((await stat(path)).size > 2 * 1024 * 1024) throw Error('Catalog exceeds 2 MiB');
  const sources = parseCatalog(JSON.parse(await readFile(path, 'utf8')));
  if (rooms) for (const game of sources.flatMap(s => s.games)) if (game.launch === 'room') { const players = rooms.get(game.id); if (!players) throw Error(`Unknown room game: ${game.id}`); game.players = { ...players }; }
  return sources;
}
