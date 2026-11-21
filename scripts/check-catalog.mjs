// Run with: node --import tsx scripts/check-catalog.mjs [path]
import { readCatalog } from '../apps/party-server/src/catalog.ts';
import { rosters } from '../apps/party-server/src/registry.ts';
try {
  const sources = await readCatalog(process.argv[2], rosters());
  console.log(`Catalog valid: ${sources.length} sources, ${sources.reduce((n, s) => n + s.games.length, 0)} games.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
