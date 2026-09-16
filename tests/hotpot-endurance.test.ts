import assert from 'node:assert/strict';
import test from 'node:test';
import { games } from '../apps/party-server/src/registry';
import { ActionWindow } from '../apps/party-server/src/action-window';
import { rules } from '../packages/games/hotpot/src/server';

test('Hotpot keeps accepting real draw/discard turns beyond the old per-player cap', () => {
  const registration = games.find(game => game.manifest.id === 'hotpot')!;
  assert.equal(registration.actionLimits?.history, 'window');
  const state = rules.create({ roomId: 'endurance', roundId: 'round', seed: 17, nowMs: 0, players: Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, color: '#abcdef' })) }, {});
  // Eight different colours cannot win with a ninth card; every turn stays legal.
  state.hands = state.hands.map(() => [1, 4, 7, 10, 13, 16, 19, 22]);
  const windows = state.seats.map(() => new ActionWindow(registration.actionLimits!.perPlayer)), sequences = [0, 0, 0, 0];
  for (let turn = 0; turn < 1200; turn++) {
    const seat = state.current, id = state.seats[seat].id!;
    for (const type of ['draw', 'discard'] as const) {
      const sequence = ++sequences[seat];
      const action = rules.parseAction(type === 'draw' ? { type, turnId: state.turnId, from: 'deck' } : { type, turnId: state.turnId, card: state.drawn });
      const result = windows[seat].execute(String(sequence), sequence - 1, JSON.stringify(action), () => { rules.applyAction(state, id, action, turn); return { accepted: true }; });
      assert.equal(result.accepted, true);
    }
  }
  assert.deepEqual(sequences, [600, 600, 600, 600]);
  assert.equal(state.phase, 'draw');
  assert(windows.every(window => window.entries.size === 1));
});
