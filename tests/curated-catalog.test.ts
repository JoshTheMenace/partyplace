import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCatalog, parseCatalogGame } from '../packages/party-catalog/src/index';
import { readCatalog } from '../apps/party-server/src/catalog';
import { parseLibrary } from '../apps/party-client/src/library-store';
import { parseRoute } from '../apps/party-client/src/routes';
const game = { id: 'new-game', title: 'New game', description: 'A manually curated game.', players: { min: 1, max: 4 }, launch: 'external', playUrl: 'https://games.example.org/play/' };
const source = { version: 1, sources: [{ id: 'curated', name: 'Curated', games: [game] }] };

test('manual entries normalize without a runtime manifest; source identity is assigned by the source', () => {
  const parsed = parseCatalog(source)[0].games[0];
  assert.equal(parsed.launch, 'external'); assert.equal(parsed.sourceId, 'curated'); assert.equal(parsed.category, 'Game');
  assert.equal(parsed.requiresSharedDisplay, false); assert.equal(parsed.supportsSolo, true);
  assert.equal(parseCatalogGame({ ...game, launch: 'unavailable', playUrl: undefined, sourceUrl: 'https://github.com/example/game' }).launch, 'unavailable');
});
test('catalog rejects ambiguous identities, unsafe URLs and broken launches', () => {
  for (const playUrl of ['javascript:alert(1)', 'data:text/html,game', 'http://insecure.example/game', 'https://user:secret@example.org/']) assert.throws(() => parseCatalogGame({ ...game, playUrl }));
  assert.throws(() => parseCatalogGame({ ...game, artwork: 'javascript:alert(1)' }));
  assert.throws(() => parseCatalogGame({ ...game, playUrl: undefined }));
  assert.throws(() => parseCatalogGame({ ...game, players: { min: 4, max: 1 } }));
  assert.throws(() => parseCatalogGame({ ...game, supportsSolo: 'false' }));
  assert.throws(() => parseCatalog({ ...source, sources: [...source.sources, ...source.sources] }));
  assert.throws(() => parseCatalog({ ...source, sources: [{ ...source.sources[0], games: [game, game] }] }));
});
test('editing the separate source file updates reads without restarting; invalid edits are rejected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'party-catalog-')), path = join(dir, 'sources.json');
  try {
    await writeFile(path, JSON.stringify(source)); assert.equal((await readCatalog(path))[0].games.length, 1);
    await writeFile(path, JSON.stringify({ ...source, sources: [{ ...source.sources[0], games: [game, { ...game, id: 'second' }] }] }));
    assert.equal((await readCatalog(path))[0].games.length, 2);
    await writeFile(path, '{'); await assert.rejects(readCatalog(path));
    await writeFile(path, JSON.stringify({ ...source, sources: [{ ...source.sources[0], games: [{ ...game, launch: 'room', playUrl: undefined }] }] }));
    await assert.rejects(readCatalog(path, new Set(['kart-party'])), /Unknown room game/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('old favorites/history do not fill My Library; saved entries are validated and deduplicated', () => {
  assert.equal(parseLibrary({ favorites: ['kart-party'], recent: [{ id: 'kart-party', at: 123 }] }).games.length, 0);
  const parsed = parseCatalogGame(game);
  assert.deepEqual(parseLibrary({ games: [parsed, parsed, { ...parsed, playUrl: 'javascript:alert(1)' }] }).games.map(g => g.id), ['new-game']);
  assert.deepEqual(parseLibrary(null).games, []);
});
test('My Library is the default; Discover and game details are shareable routes', () => {
  assert.deepEqual(parseRoute({ pathname: '/', search: '' }), { view: 'home' });
  assert.deepEqual(parseRoute({ pathname: '/', search: '?view=discover' }), { view: 'discover' });
  assert.deepEqual(parseRoute({ pathname: '/', search: '?view=discover&game=new-game' }), { view: 'game', id: 'new-game' });
});
