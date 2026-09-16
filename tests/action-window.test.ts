import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { ActionWindow } from '../apps/party-server/src/action-window';
import { createRoomServer, type RegisteredGame } from '../apps/party-server/src/room-server';
import { PartySession } from '../packages/party-client/src/session';

const accepted = () => ({ accepted: true });
test('bounded history continues beyond 4096 commands and never replays retired mutations', () => {
  const window = new ActionWindow(16); let applied = 0;
  for (let sequence = 1; sequence <= 10000; sequence++) {
    assert.equal(window.execute(String(sequence), Math.max(0, sequence - 16), '{}', () => { applied++; return accepted(); }).accepted, true);
    assert(window.entries.size <= 16);
  }
  assert.equal(applied, 10000); assert.equal(window.retiredThrough, 9984);
  assert.throws(() => window.execute('1', 0, '{}', () => { applied++; return accepted(); }), /retired/);
  assert.equal(window.execute('10000', 9999, '{}', () => { applied++; return accepted(); }).accepted, true);
  assert.match(window.execute('10000', 9999, '{"purchase":2}', accepted).reason!, /different payload/);
  assert.equal(applied, 10000);
});

test('gaps, reordered retries, rejected commands, and abandoned gaps have bounded semantics', () => {
  const window = new ActionWindow(16); let applied = 0;
  const apply = () => { applied++; return accepted(); };
  window.execute('2', 0, '{}', apply); window.execute('1', 0, '{}', apply);
  window.execute('16', 0, '{}', apply);
  assert.throws(() => window.execute('17', 0, '{}', apply), /window is full/);
  assert.throws(() => window.execute('100', 17, '{}', apply), /window is full/);
  assert.equal(window.retiredThrough, 0);
  assert.equal(window.execute('1', 0, '{}', apply).accepted, true);
  assert.equal(applied, 3);
  window.execute('17', 16, '{}', () => ({ accepted: false, reason: 'Insufficient funds' }));
  assert.equal(window.execute('17', 16, '{}', apply).reason, 'Insufficient funds');
  assert.throws(() => window.execute('3', 0, '{}', apply), /retired/);
  assert.equal(window.entries.size, 1); assert.equal(window.highestSequence, 17);
  for (const [id, floor] of [['01', 0], ['1.5', 0], ['-1', 0], ['9007199254740992', 0], ['18', 18], ['18', -1], ['18', undefined]] as const) assert.throws(() => window.execute(id, floor, '{}', apply), /Invalid action/);
  assert.equal(new ActionWindow(16).execute('1', 0, '{}', apply).accepted, true);
});

type Packet = Record<string, any>;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
class Peer {
  packets: Packet[] = [];
  constructor(readonly socket: WebSocket) { socket.on('message', raw => this.packets.push(JSON.parse(String(raw)))); socket.on('error', () => {}); }
  send(type: string, data: Packet = {}) { this.socket.send(JSON.stringify({ v: '1.0', type, ...data })); }
  async take(type: string, match: (packet: Packet) => boolean = () => true): Promise<Packet> {
    for (let i = 0; i < 400; i++) { const index = this.packets.findIndex(packet => packet.type === type && match(packet)); if (index >= 0) return this.packets.splice(index, 1)[0]; await delay(2); }
    throw new Error(`Missing ${type}`);
  }
}

test('socket window supports 4200 commands, authenticated reconnect, payload limits, and a fresh round', async () => {
  let now = 1000;
  const game: RegisteredGame = {
    manifest: { contractVersion: '1.0', id: 'window-test', title: 'Window test', description: 'Test', assetBase: '/games/window-test/', modes: ['shared-display'], players: { min: 1, max: 10 }, orientation: { controller: 'portrait', personalView: 'any' }, timing: 'turn-based', input: ['action'], privatePlayerViews: false, supportsSolo: true },
    actionLimits: { perPlayer: 64, maxBytes: 128, history: 'window' },
    rules: { validateSettings: () => ({}), parseInput: () => null, neutralInput: () => null, parseAction: raw => { if ((raw as any)?.type !== 'purchase') throw new Error('Invalid purchase'); return raw; }, create: () => ({ count: 0 }), applyAction: state => { state.count++; }, tick() {}, onPresenceChange() {}, publicView: state => ({ count: state.count }), playerView: () => null, outcome: () => ({ complete: false, winners: [], rows: [] }), dispose() {} },
  };
  const server = createServer(), party = createRoomServer(server, [game], { now: () => now, tickMs: 2, startDelayMs: 0 });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); assert(address && typeof address !== 'string');
  const connect = async () => { const peer = new Peer(new WebSocket(`ws://127.0.0.1:${address.port}/ws`)); await new Promise<void>(resolve => peer.socket.once('open', resolve)); return peer; };
  try {
    const host = await connect(); host.send('room.create'); const created = await host.take('room.welcome');
    let phone = await connect(); phone.send('room.join', { code: created.room.code, name: 'Captain' }); const joined = await phone.take('room.welcome');
    host.send('game.select', { gameId: game.manifest.id }); await host.take('room.state', p => p.room.phase === 'lobby');
    const start = async () => { phone.send('room.ready', { ready: true }); await host.take('room.state', p => p.room.players.every((player: any) => player.ready)); host.send('round.start'); const prepare = await host.take('round.prepare'); for (const peer of [host, phone]) peer.send('round.ready', { roundId: prepare.roundId }); await phone.take('game.snapshot', p => p.roundId === prepare.roundId); return prepare.roundId as string; };
    const roundId = await start(); assert.equal(party.roomView().actionWindow, 64);
    for (let base = 1; base <= 4200; base += 50) {
      now += 1000;
      for (let sequence = base; sequence < base + 50; sequence++) phone.send('game.action', { roundId, actionId: String(sequence), retireThrough: base - 1, payload: { type: 'purchase' } });
      for (let sequence = base; sequence < base + 50; sequence++) assert.equal((await phone.take('action.ack', p => p.actionId === String(sequence))).accepted, true);
      phone.packets.length = 0; host.packets.length = 0;
    }
    now += 1000;
    phone = await connect(); phone.send('room.rejoin', { code: created.room.code, token: joined.token }); const rejoined = await phone.take('room.welcome');
    assert.equal(rejoined.playerId, joined.playerId); assert.equal(rejoined.nextActionSequence, 4201);
    const send = async (actionId: string, retireThrough: number, payload: unknown = { type: 'purchase' }) => { phone.send('game.action', { roundId, actionId, retireThrough, payload }); return phone.take('action.ack', p => p.actionId === actionId); };
    assert.equal((await send('4200', 4150)).accepted, true);
    assert.match((await send('4200', 4150, { type: 'purchase', extra: true })).reason, /different payload/);
    assert.match((await send('1', 0)).reason, /retired/);
    assert.match((await send('4201', 4200, { type: 'purchase', extra: 'x'.repeat(128) })).reason, /too large/);
    assert.equal((await send('4201', 4200)).accepted, true);
    assert.equal((await phone.take('game.snapshot', p => p.publicView.count === 4201)).publicView.count, 4201);
    host.send('round.abort', { roundId }); await host.take('room.state', p => p.room.phase === 'lobby' && p.room.roundId === null);
    const nextRound = await start(); assert.notEqual(nextRound, roundId);
    assert.match((await send('4202', 4201)).reason, /old round/);
    phone.send('game.action', { roundId: nextRound, actionId: '1', retireThrough: 0, payload: { type: 'purchase' } }); assert.equal((await phone.take('action.ack', p => p.roundId === nextRound)).accepted, true);
  } finally { await party.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('client preserves retry IDs and payloads, caps pending at 16, and retires only settled gaps', async () => {
  const globals = ['WebSocket', 'location', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const sockets: FakeSocket[] = [];
  class FakeSocket {
    static OPEN = 1; readyState = 1; sent: Packet[] = []; onopen?: () => void; onmessage?: (event: { data: string }) => void;
    constructor() { sockets.push(this); }
    send(raw: string) { this.sent.push(JSON.parse(raw)); }
    close() { this.readyState = 3; }
    receive(type: string, data: Packet) { this.onmessage?.({ data: JSON.stringify({ v: '1.0', type, ...data }) }); }
  }
  for (const [key, value] of Object.entries({ WebSocket: FakeSocket, location: { protocol: 'http:', host: 'localhost' }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const session = new PartySession();
  try {
    const socket = sockets[0]; socket.onopen?.();
    const room = { id: 'room', code: 'ABCDEF', revision: 1, phase: 'playing', hostId: 'host', hostConnected: true, players: [], gameId: 'window-test', settings: {}, roundId: 'first', activePlayerIds: [], startAt: 0, preparationDeadline: null, notice: null, actionWindow: 64 };
    socket.receive('room.welcome', { clientId: 'player', playerId: 'player', token: 'token', room, games: [], nextActionSequence: 1 });
    const payload = { type: 'purchase', amount: 1 }, pending = [session.sendAction(payload)]; payload.amount = 99;
    for (let i = 1; i < 16; i++) pending.push(session.sendAction({ type: 'purchase' }));
    assert.match((await session.sendAction({})).reason!, /Too many pending/);
    socket.receive('action.ack', { roundId: 'first', actionId: '2', accepted: true }); await pending[1];
    pending.push(session.sendAction({ type: 'purchase' })); assert.equal(socket.sent.at(-1)?.retireThrough, 0);
    // A rejoin welcome advances new IDs while unresolved IDs remain unchanged.
    socket.receive('room.welcome', { clientId: 'player', playerId: 'player', token: 'token', room, games: [], nextActionSequence: 18 });
    await delay(1600);
    const retries = socket.sent.filter(packet => packet.type === 'game.action' && packet.actionId === '1');
    assert(retries.length >= 2); assert.deepEqual(retries.at(-1)?.payload, { type: 'purchase', amount: 1 }); assert.equal(retries.at(-1)?.retireThrough, 0);
    socket.receive('action.ack', { roundId: 'first', actionId: '1', accepted: true }); await pending[0];
    pending.push(session.sendAction({ type: 'purchase' })); assert.equal(socket.sent.at(-1)?.actionId, '18'); assert.equal(socket.sent.at(-1)?.retireThrough, 2);
    socket.receive('room.state', { room: { ...room, revision: 2, roundId: 'second' } });
    await Promise.all(pending);
    const next = session.sendAction({ type: 'purchase' }); assert.equal(socket.sent.at(-1)?.actionId, '1'); assert.equal(socket.sent.at(-1)?.retireThrough, 0);
    socket.receive('action.ack', { roundId: 'first', actionId: '1', accepted: true });
    socket.receive('action.ack', { roundId: 'second', actionId: '1', accepted: true }); assert.equal((await next).accepted, true);
    const abandoned = session.sendAction({ type: 'purchase' });
    for (const action of (session as unknown as { pending: Map<string, { expires: number }> }).pending.values()) action.expires = 0;
    assert.match((await abandoned).reason!, /expired/);
    const afterGap = session.sendAction({ type: 'purchase' }); assert.equal(socket.sent.at(-1)?.actionId, '3'); assert.equal(socket.sent.at(-1)?.retireThrough, 2);
    socket.receive('action.ack', { roundId: 'second', actionId: '3', accepted: true }); await afterGap;
  } finally { session.dispose(); for (const [key, descriptor] of globals) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});
