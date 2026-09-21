import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseCatalog } from '../packages/party-catalog/src/index';
import { filterCatalog, gameCatalog } from '../apps/party-client/src/catalog';
import { games } from '../apps/party-server/src/registry';

const catalog = gameCatalog(games.map(game => game.manifest));
test('library exposes all sixteen games and truthful solo, shared-screen and development filters', () => {
  assert.equal(catalog.length, 16);
  assert.deepEqual(filterCatalog(catalog, '', 'solo').map(g => g.id), ['kart-party','phonedig','hotpot','starship-scramble','island-settlers','blockwild','kitchen-rush']);
  assert.deepEqual(filterCatalog(catalog, '', 'no-tv').map(g => g.id), ['kart-party','phonedig','hotpot','starship-scramble','island-settlers','blockwild','kitchen-rush']);
  assert.equal(filterCatalog(catalog, '', 'shared-screen').length, 9);
  assert.deepEqual(filterCatalog(catalog, '', 'in-progress').map(g => g.id), ['island-settlers','sky-clash']);
  assert.deepEqual(filterCatalog([{...catalog[0],status:'in-progress'}], '', 'in-progress').map(g=>g.id), ['kart-party']);
  assert.equal(filterCatalog(catalog, '', 'party').length, 10);
  assert.deepEqual(filterCatalog(catalog, '', 'co-op').map(g=>g.id).sort(), ['blockwild','kitchen-rush','night-job','phonedig','starship-scramble']);
});
test('search combines words with the selected filter and handles empty results', () => {
  assert.deepEqual(filterCatalog(catalog, '  COOKING teamwork ', 'co-op').map(g => g.id), ['kitchen-rush']);
  assert.deepEqual(filterCatalog(catalog, 'cooking', 'solo').map(g => g.id), ['kitchen-rush']);
  assert.equal(filterCatalog(catalog, '   ', 'all').length, 16);
});
test('seed metadata describes existing saves without promising offline or licensed downloads', () => {
  assert(catalog.every(game => game.creator?.name && game.detail && game.capabilities?.includes('browser-play')));
  assert.deepEqual(catalog.filter(game => game.capabilities?.includes('server-autosave')).map(game => game.id), ['starship-scramble','blockwild']);
  assert.deepEqual(catalog.filter(game => game.capabilities?.includes('host-browser-progress')).map(game => game.id), ['kitchen-rush']);
  assert(catalog.every(game => !game.capabilities?.some(value => /offline|download|remix|lan-only/.test(value))));
});

test('Night Job discovery and room metadata agree on its roster, controls and development status', () => {
  const room = catalog.find(game => game.id === 'night-job')!;
  const discovery = parseCatalog(JSON.parse(readFileSync(new URL('../catalog/sources.json', import.meta.url), 'utf8'))).flatMap(source => source.games).find(game => game.id === room.id)!;
  for (const key of ['title', 'description', 'players', 'supportsSolo', 'requiresSharedDisplay', 'cooperative', 'controls', 'playTime', 'status', 'creator', 'detail', 'capabilities'] as const) assert.deepEqual(discovery[key], room[key], key);
  assert.deepEqual(room.players, { min: 1, max: 4 });
  assert.equal(room.status, 'ready');
  assert.equal(room.supportsSolo, false); assert.equal(room.requiresSharedDisplay, true);
  assert.deepEqual(room.controls, ['Touch', 'Phone controllers']);
  assert.deepEqual(room.capabilities, ['browser-play', 'shared-display', 'phone-controllers', 'touch']);
  assert.deepEqual(filterCatalog(catalog, 'heist pixel', 'co-op').map(game => game.id), ['night-job']);
});
