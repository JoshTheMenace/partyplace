import { test } from 'node:test';
import { games } from '../apps/party-server/src/registry';
import { assertSerializable } from '../apps/party-server/src/room-server';

// JSON.stringify silently drops undefined properties; the live transport intentionally rejects them.
for (const game of games) for (const count of new Set([game.manifest.players.min, game.manifest.players.max])) {
  test(`${game.manifest.id}: ${count}-player initial projections satisfy the live JSON contract`, () => {
    const settings = game.rules.validateSettings({}), nowMs = 1000;
    const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player000000000${i}`, color: '#ff5748' }));
    const state = game.rules.create({ roomId: 'contract-room', roundId: 'contract-round', seed: 1234, nowMs, players }, settings);
    try {
      assertSerializable(game.manifest); assertSerializable(settings);
      assertSerializable(game.rules.publicView(state, { nowMs, phase: 'playing' }));
      for (const player of players) assertSerializable(game.rules.playerView(state, player.id, { nowMs, phase: 'playing' }));
      assertSerializable(game.rules.outcome(state));
    } finally { game.rules.dispose(state); }
  });
}
