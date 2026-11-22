import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSerializable } from '../apps/party-server/src/room-server';
import { MAX_ROOM_PLAYERS } from '../packages/party-contract/src/index';
import { due, rules } from '../packages/games/ichi/src/server';
import { defaults, houseRules } from '../packages/games/ichi/src/types';

// One table at 2 and 10 players; several tables with rounds, bells and reseating at 32 and 64.
for (const count of [2, 10, 32, MAX_ROOM_PLAYERS]) test(`Ichi: ${count}-player projections stay serializable through timeouts, intermissions and results`, () => {
  const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player000000000${i}`, color: '#ff5748' }));
  const state = rules.create({ roomId: 'r', roundId: 'r1', nowMs: 0, seed: 412, players }, { ...defaults, ...Object.fromEntries(Object.keys(houseRules).map(k => [k, true])) });
  for (let step = 0; !rules.outcome(state).complete; step++) {
    assert.ok(step < 20000, 'timeouts alone must finish the match');
    const ctx = { nowMs: state.now, phase: 'playing' as const };
    assertSerializable(rules.publicView(state, ctx));
    for (const p of players) assertSerializable(rules.playerView(state, p.id, ctx));
    rules.tick(state, new Map(), 0, due(state));
  }
  assertSerializable(rules.outcome(state)); assertSerializable(rules.publicView(state, { nowMs: state.now, phase: 'results' }));
  assert.ok(rules.outcome(state).winners.length > 0);
});
