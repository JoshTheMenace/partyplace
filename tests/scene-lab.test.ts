import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rules } from '../packages/games/scene-lab/src/server';
import { ARENA } from '../packages/games/scene-lab/src/model';
const context = (count: number) => ({ roomId: 'room', roundId: 'round', nowMs: 1000, seed: 123, players: Array.from({ length: count }, (_, i) => ({ id: String(i), name: `Player ${i}`, color: '#ffcc44' })) });
for (const count of [2, 10]) test(`${count} players: deterministic spawns, bounds, pillar collision, collection, deadline and fresh replay`, () => {
  const a = rules.create(context(count), { seconds: 20 }), b = rules.create(context(count), { seconds: 20 }); assert.deepEqual(a, b);
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) assert(Math.hypot(a.players[i].x - a.players[j].x, a.players[i].z - a.players[j].z) > ARENA.radius * 2);
  const player = a.players[0]; a.stars[0] = { x: player.x, z: player.z }; rules.tick(a, new Map([['0', rules.neutralInput()]]), 1 / 60, 1017); assert.equal(player.score, 1);
  const projection = rules.publicView(a, { nowMs: 1017, phase: 'playing' }); projection.players[0].score = 99; assert.equal(player.score, 1);
  for (let i = 0; i < 500; i++) rules.tick(a, new Map([['0', { x: -1, y: 0, boost: true }]]), 1 / 60, 1100 + i * 16);
  assert(player.x >= ARENA.pillarRadius + ARENA.radius - 1e-6);
  for (let i = 0; i < 500; i++) rules.tick(a, new Map([['0', { x: 1, y: 1, boost: true }]]), 1 / 60, 1100 + i * 16);
  assert(player.x <= ARENA.halfX - ARENA.radius); assert(player.z <= ARENA.halfZ - ARENA.radius);
  rules.onPresenceChange(a, '0', false, 12000); const position = [player.x, player.z]; rules.tick(a, new Map([['0', { x: -1, y: -1, boost: true }]]), 1 / 60, 12017); assert.deepEqual([player.x, player.z], position);
  rules.tick(a, new Map(), 1 / 60, 21000); assert(rules.outcome(a).complete); assert.equal(rules.outcome(a).rows.length, count); assert.deepEqual(rules.create(context(count), { seconds: 20 }), b);
});
test('input parsing normalizes diagonals and rejects invalid controls', () => { const diagonal = rules.parseInput({ x: 1, y: 1, boost: false }); assert(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9); for (const input of [null, { x: NaN, y: 0, boost: true }, { x: 2, y: 0, boost: false }, { x: 0, y: 0, boost: 1 }]) assert.throws(() => rules.parseInput(input)); });
