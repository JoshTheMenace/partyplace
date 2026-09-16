import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCatalog, gameCatalog } from '../apps/party-client/src/catalog';
import { games } from '../apps/party-server/src/registry';

const catalog = gameCatalog(games.map(game => game.manifest));
test('library exposes all fourteen games and truthful solo, shared-screen and development filters', () => {
  assert.equal(catalog.length, 14);
  assert.deepEqual(filterCatalog(catalog, '', 'solo').map(g => g.id), ['kart-party','phonedig','hotpot','starship-scramble','island-settlers','blockwild','kitchen-rush']);
  assert.deepEqual(filterCatalog(catalog, '', 'no-tv').map(g => g.id), ['kart-party','phonedig','hotpot','starship-scramble','island-settlers','blockwild','kitchen-rush']);
  assert.equal(filterCatalog(catalog, '', 'shared-screen').length, 7);
  assert.deepEqual(filterCatalog(catalog, '', 'in-progress').map(g => g.id), ['island-settlers','sky-clash']);
  assert.deepEqual(filterCatalog([{...catalog[0],status:'in-progress'}], '', 'in-progress').map(g=>g.id), ['kart-party']);
  assert.equal(filterCatalog(catalog, '', 'party').length, 9);
  assert.deepEqual(filterCatalog(catalog, '', 'co-op').map(g=>g.id).sort(), ['blockwild','kitchen-rush','phonedig','starship-scramble']);
});
test('search combines words with the selected filter and handles empty results', () => {
  assert.deepEqual(filterCatalog(catalog, '  COOKING teamwork ', 'co-op').map(g => g.id), ['kitchen-rush']);
  assert.deepEqual(filterCatalog(catalog, 'cooking', 'solo').map(g => g.id), ['kitchen-rush']);
  assert.equal(filterCatalog(catalog, '   ', 'all').length, 14);
});
test('seed metadata describes existing saves without promising offline or licensed downloads', () => {
  assert(catalog.every(game => game.creator?.name && game.detail && game.capabilities?.includes('browser-play')));
  assert.deepEqual(catalog.filter(game => game.capabilities?.includes('server-autosave')).map(game => game.id), ['starship-scramble','blockwild']);
  assert.deepEqual(catalog.filter(game => game.capabilities?.includes('host-browser-progress')).map(game => game.id), ['kitchen-rush']);
  assert(catalog.every(game => !game.capabilities?.some(value => /offline|download|remix|lan-only/.test(value))));
});
