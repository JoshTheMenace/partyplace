// Run with: node --import tsx scripts/check-catalog.mjs [path]
import { readCatalog } from '../apps/party-server/src/catalog.ts';
import { games } from '../apps/party-server/src/registry.ts';
try {
  const sources = await readCatalog(process.argv[2], new Set(games.map(g => g.manifest.id)));
  console.log(`Catalog valid: ${sources.length} sources, ${sources.reduce((n, s) => n + s.games.length, 0)} games.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
