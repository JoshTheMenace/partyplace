import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createRoomHub } from '../apps/party-server/src/room-hub';
import { serveWorldSave } from '../apps/party-server/src/world-http';
import { parsePublicOrigin } from '../apps/party-server/src/network-address';
import type { RegisteredGame } from '../apps/party-server/src/room-server';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const game: RegisteredGame = {
  manifest: { contractVersion: '1.0', id: 'hub-test', title: 'Hub test', description: 'Test fixture', assetBase: '/games/hub-test/', modes: ['shared-display'], players: { min: 2, max: 10 }, orientation: { controller: 'any', personalView: 'any' }, timing: 'turn-based', input: ['action'], privatePlayerViews: true, supportsSolo: false, sessionControls: ['save'] },
  rules: {
    validateSettings: () => ({}), parseInput: () => null, neutralInput: () => null, parseAction: () => null,
    create: ctx => ({ count: 0, players: ctx.players.map(p => p.id) }), applyAction: state => { state.count++; },
    tick() {}, onPresenceChange() {}, dispose() {}, publicView: state => ({ count: state.count }), playerView: (_state, id) => ({ privateFor: id }),
    outcome: state => ({ complete: state.count >= 2, winners: [], rows: state.players.map((playerId: string) => ({ playerId, score: state.count })) }),
    exportSave: state => ({ count: state.count }), loadSave: (ctx, raw) => ({ state: { count: (raw as { count: number }).count, players: ctx.players.map(p => p.id) }, settings: {} }),
  },
};
class Peer {
  packets: any[] = [];
  constructor(public socket: WebSocket) { socket.on('message', raw => this.packets.push(JSON.parse(raw.toString()))); socket.on('error', () => {}); }
  send(type: string, data = {}) { this.socket.send(JSON.stringify({ v: '1.0', type, ...data })); }
  async take(type: string, predicate: (packet: any) => boolean = () => true) {
    for (let n = 0; n < 400; n++) { const i = this.packets.findIndex(p => p.type === type && predicate(p)); if (i >= 0) return this.packets.splice(i, 1)[0]; await delay(5); }
    throw Error(`Timed out: ${type}`);
  }
}
async function harness(maxRooms = 32) {
  const saveRoot = await mkdtemp(join(tmpdir(), 'party-hub-'));
  const server = createServer((req, res) => {
    const room = hub.roomForCode(req.headers['x-party-room']);
    if (!room) { res.writeHead(401).end(); return; }
    void serveWorldSave(req, res, room);
  });
  const hub = createRoomHub(server, [game], { saveRoot, maxRooms, sweepMs: 10, roomOptions: { tickMs: 5, startDelayMs: 5, hostGraceMs: 100 } });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  return {
    hub, url,
    async connect(origin?: string) { const socket = new WebSocket(url.replace('http:', 'ws:') + '/ws', origin ? { origin } : {}); const peer = new Peer(socket); await new Promise<void>((done, fail) => { socket.once('open', done); socket.once('error', fail); }); return peer; },
    async close() { await hub.close(); await new Promise<void>(done => server.close(() => done())); await rm(saveRoot, { recursive: true, force: true }); },
  };
}
async function party(h: Awaited<ReturnType<typeof harness>>, count = 2) {
  const host = await h.connect(); host.send('clock.ping', { clientTime: 1 }); await host.take('clock.pong'); host.send('room.create');
  const welcome = await host.take('room.welcome'), phones: Peer[] = [], seats: any[] = [];
  for (let i = 0; i < count; i++) { const peer = await h.connect(); peer.send('room.join', { code: welcome.room.code, name: `Player ${i}` }); seats.push(await peer.take('room.welcome')); phones.push(peer); }
  host.send('game.select', { gameId: game.manifest.id }); await host.take('room.state', p => p.room.phase === 'lobby');
  for (const peer of phones) peer.send('room.ready', { ready: true });
  await host.take('room.state', p => p.room.players.every((s: any) => s.ready));
  host.send('round.start'); const prepare = await host.take('round.prepare');
  for (const peer of [host, ...phones]) peer.send('round.ready', { roundId: prepare.roundId });
  await host.take('game.snapshot');
  return { host, welcome, phones, seats, roundId: prepare.roundId };
}

test('two groups independently play, save, reconnect, finish and replay on the same server', async () => {
  const h = await harness();
  try {
    const a = await party(h, 10), b = await party(h);
    assert.notEqual(a.welcome.room.code, b.welcome.room.code);
    assert.notEqual(a.welcome.room.id, b.welcome.room.id);
    a.phones[0].send('game.action', { roundId: a.roundId, actionId: 'one', payload: null });
    assert.equal((await a.phones[0].take('action.ack')).accepted, true);
    assert.equal((await a.host.take('game.snapshot', p => p.publicView.count === 1)).privateView, null);
    const own = await b.phones[0].take('game.snapshot'); assert.equal(own.publicView.count, 0); assert.equal(own.privateView.privateFor, b.seats[0].playerId);
    b.phones[0].send('game.action', { roundId: a.roundId, actionId: 'cross-room', payload: null });
    assert.equal((await b.phones[0].take('action.ack')).accepted, false);
    const saved = await fetch(h.url + '/api/round/save', { headers: { 'X-Party-Room': a.welcome.room.code, 'X-Party-Round': a.roundId, Authorization: `Bearer ${a.welcome.token}` } });
    assert.equal(saved.status, 200); assert.deepEqual(await saved.json(), { count: 1 });
    const wrongRoom = await fetch(h.url + '/api/round/save', { headers: { 'X-Party-Room': b.welcome.room.code, 'X-Party-Round': b.roundId, Authorization: `Bearer ${a.welcome.token}` } });
    assert.equal(wrongRoom.status, 400);
    const stranger = await h.connect(); stranger.send('room.rejoin', { code: b.welcome.room.code, token: a.welcome.token });
    assert.equal((await stranger.take('error')).code, 'REJOIN');
    const resumed = await h.connect(); resumed.send('room.rejoin', { code: a.welcome.room.code, token: a.seats[0].token });
    assert.equal((await resumed.take('room.welcome')).playerId, a.seats[0].playerId);
    resumed.send('game.action', { roundId: a.roundId, actionId: 'two', payload: null });
    await a.host.take('round.results');
    assert.equal(h.hub.roomForCode(b.welcome.room.code)?.roomView().phase, 'playing');
    const revision = h.hub.roomForCode(a.welcome.room.code)!.roomView().revision;
    a.host.send('game.select', { gameId: game.manifest.id }); const selected = await a.host.take('room.state', p => p.room.phase === 'lobby' && p.room.revision > revision);
    for (const phone of [resumed, ...a.phones.slice(1)]) phone.send('room.ready', { ready: true });
    await a.host.take('room.state', p => p.room.phase === 'lobby' && p.room.revision > selected.room.revision && p.room.players.every((s: any) => s.ready));
    a.host.send('round.start'); const replay = await a.host.take('round.prepare'); assert.notEqual(replay.roundId, a.roundId);
    for (const peer of [a.host, resumed, ...a.phones.slice(1)]) peer.send('round.ready', { roundId: replay.roundId });
    assert.equal((await a.host.take('game.snapshot', p => p.roundId === replay.roundId)).publicView.count, 0);
    const metadata = await h.hub.roomForCode(b.welcome.room.code)!.recoveryMetadata(b.welcome.token, game.manifest.id);
    const aMetadata = await h.hub.roomForCode(a.welcome.room.code)!.recoveryMetadata(a.welcome.token, game.manifest.id);
    assert(metadata.checkpoints.length); assert(aMetadata.checkpoints.length);
    assert.equal(metadata.checkpoints.length, 1); assert.equal(aMetadata.checkpoints.length, 2);
    assert.deepEqual(JSON.parse(await h.hub.roomForCode(b.welcome.room.code)!.exportRecovery(b.welcome.token, game.manifest.id, 'latest')), { count: 0 });
    assert.deepEqual(JSON.parse(await h.hub.roomForCode(a.welcome.room.code)!.exportRecovery(a.welcome.token, game.manifest.id, 'previous')), { count: 2 });
    a.host.send('room.close'); await resumed.take('room.closed');
    b.host.send('clock.ping', { clientTime: 99 }); assert.equal((await b.host.take('clock.pong')).clientTime, 99);
  } finally { await h.close(); }
});

test('capacity, bad room codes, origin rejection, and expired-room cleanup leave existing rooms usable', async () => {
  const h = await harness(1);
  try {
    await assert.rejects(h.connect('https://unrelated.example'), /403/);
    const host = await h.connect(); host.send('room.create'); const welcome = await host.take('room.welcome');
    const extra = await h.connect(); extra.send('room.create'); assert.match((await extra.take('error')).reason, /busy/);
    extra.send('room.join', { code: 'ABCDEF', name: 'Bad code' }); assert.match((await extra.take('error')).reason, /not found/);
    host.socket.close(); await delay(180);
    assert.equal(h.hub.roomCount(), 0);
    extra.send('room.rejoin', { code: welcome.room.code, token: welcome.token }); assert.equal((await extra.take('error')).code, 'REJOIN');
    extra.send('room.create'); assert((await extra.take('room.welcome')).room.id);
  } finally { await h.close(); }
});

test('public invite origins preserve HTTPS and reject paths and credentials', () => {
  assert.equal(parsePublicOrigin('https://play.example/'), 'https://play.example');
  assert.equal(parsePublicOrigin(), undefined);
  for (const value of ['https://play.example/path', 'https://user:pass@play.example', 'javascript:alert(1)', 'https://play.example/?join=ABCDEF']) assert.throws(() => parsePublicOrigin(value));
});
