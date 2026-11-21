import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { createRoomServer, type RegisteredGame } from '../apps/party-server/src/room-server';
import { botName, joinBots, type BotHook } from '../scripts/qa/room-bots';
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));
const until = async (check: () => boolean, label: string) => { for (let i = 0; i < 600; i++) { if (check()) return; await delay(10); } throw Error(`Timed out: ${label}`); };
type State = { seats: { id: string; pick: number; x: number; taps: number }[] };
// Realtime, per-seat lobby picks and windowed actions: every protocol branch the harness speaks.
const game: RegisteredGame = {
  manifest: { contractVersion: '1.0', id: 'bot-lab', title: 'Bot lab', description: 'Test fixture', assetBase: '/games/bot-lab/', modes: ['shared-display'], players: { min: 1, max: 64 }, orientation: { controller: 'any', personalView: 'any' }, timing: 'realtime', input: ['state', 'action'], privatePlayerViews: false, supportsSolo: false, simulation: { stepHz: 20, snapshotHz: 10, maxCatchUpSteps: 4 } },
  actionLimits: { perPlayer: 16, maxBytes: 64, history: 'window' },
  rules: {
    validateSettings: () => ({}), neutralInput: () => ({ x: 0 }), parseInput: raw => ({ x: Number((raw as { x: number }).x) }), parseAction: raw => raw, dispose() {}, onPresenceChange() {},
    parseLobbyChoice(raw, ready) { const pick = (raw as { pick?: number } | undefined)?.pick; if (ready && !Number.isInteger(pick)) throw Error('Pick a lane first.'); return { pick: pick ?? null }; },
    create: ctx => ({ seats: ctx.players.map(player => ({ id: player.id, pick: (player.lobbyChoice as { pick: number }).pick, x: 0, taps: 0 })) }) satisfies State,
    applyAction(state: State, id) { state.seats.find(seat => seat.id === id)!.taps++; },
    tick(state: State, inputs, dt) { for (const seat of state.seats) seat.x += (inputs.get(seat.id) as { x: number }).x * dt; },
    publicView: (state: State) => ({ seats: state.seats }), playerView: () => null, outcome: () => ({ complete: false, winners: [], rows: [] }),
  },
};

test('bot names are sixty-four distinct names at the 16-character limit', () => {
  const names = Array.from({ length: 64 }, (_, i) => botName(i));
  assert.equal(new Set(names.map(name => name.toLowerCase())).size, 64); assert(names.every(name => name.length === 16 && name === name.trim()));
});

test('socket bots fill a 64-seat room: pick, ready, load, hold input, act, and rejoin a dropped seat', async () => {
  const server = createServer(), party = createRoomServer(server, [game], { startDelayMs: 5 });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port, host = new WebSocket(`ws://127.0.0.1:${port}/ws`), say = (type: string, data = {}) => host.send(JSON.stringify({ v: '1.0', type, ...data }));
  host.on('message', raw => { const m = JSON.parse(String(raw)); if (m.type === 'round.prepare') say('round.ready', { roundId: m.roundId }); });
  const acks: boolean[] = [], tapped = new Set<number>();
  const hook: BotHook = { lobbyChoice: bot => ({ pick: bot.index }), input: bot => ({ x: bot.index % 2 ? 1 : -1 }), snapshot(bot) { if (!tapped.has(bot.index)) { tapped.add(bot.index); void bot.act({ tap: true }).then(ack => acks.push(ack.accepted)); } } };
  let run: Awaited<ReturnType<typeof joinBots>> | undefined;
  try {
    await new Promise(done => host.once('open', done)); say('room.create'); await until(() => !!party.roomView().code, 'room');
    say('game.select', { gameId: 'bot-lab' }); await until(() => party.roomView().phase === 'lobby', 'lobby');
    run = await joinBots({ host: '127.0.0.1', port, code: party.roomView().code, players: 64, hook, log() {} });
    await until(() => party.roomView().players.length === 64 && party.roomView().players.every(seat => seat.ready), 'ready bots');
    assert.deepEqual(party.roomView().players.map(seat => [seat.name, seat.lobbyChoice]), run.bots.map(bot => [botName(bot.index), { pick: bot.index }]));
    say('round.start'); await until(() => party.roomView().phase === 'playing', 'round');
    const seats = () => (run!.bots[0].snapshot?.publicView as State | undefined)?.seats ?? [];
    await until(() => seats().length === 64 && seats().every((seat, i) => seat.taps === 1 && seat.pick === i && (i % 2 ? seat.x > 0 : seat.x < 0)), 'input and actions from every bot');
    assert.deepEqual(acks, Array(64).fill(true)); assert(run.bots.every(bot => bot.connected && bot.bytes > 0 && !bot.errors.length));
    run.bots[7].drop(); await until(() => !party.roomView().players[7].connected, 'drop'); await until(() => party.roomView().players[7].connected, 'rejoin');
    assert.equal(party.roomView().players.length, 64);
  } finally { run?.close(); host.close(); await party.close(); await new Promise<void>(done => server.close(() => done())); }
});
