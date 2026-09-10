import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseCatalog } from '../../../packages/party-catalog/src/index';
/** Read the separate curator-owned file on each request; edits never require a rebuild. */
export async function readCatalog(path = resolve(process.env.PARTY_CATALOG_PATH ?? 'catalog/sources.json'), roomIds?: ReadonlySet<string>) {
  if ((await stat(path)).size > 2 * 1024 * 1024) throw Error('Catalog exceeds 2 MiB');
  const sources = parseCatalog(JSON.parse(await readFile(path, 'utf8')));
  if (roomIds) for (const game of sources.flatMap(s => s.games)) if (game.launch === 'room' && !roomIds.has(game.id)) throw Error(`Unknown room game: ${game.id}`);
  return sources;
}
