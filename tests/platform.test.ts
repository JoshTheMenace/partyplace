import { serveWorldSave } from '../apps/party-server/src/world-http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { createRoomServer, type RegisteredGame } from '../apps/party-server/src/room-server';
import { parseDrawing, DRAWING_COLORS, type GameRules } from '../packages/party-contract/src/index';
import { discoverPartyAddresses } from '../apps/party-server/src/network-address';
import { createRecoveryStore } from '../apps/party-server/src/recovery-store';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Packet = Record<string, any>;
class Peer {
  packets: Packet[] = [];
  constructor(public socket: WebSocket) { socket.on('message', data => this.packets.push(JSON.parse(data.toString()))); socket.on('error', () => {}); }
  send(type: string, payload: Record<string, unknown> = {}) { this.socket.send(JSON.stringify({ v: '1.0', type, ...payload })); }
  async take(type: string, predicate: (packet: Packet) => boolean = () => true) { for (let attempt = 0; attempt < 300; attempt++) { const index = this.packets.findIndex(packet => packet.type === type && predicate(packet)); if (index >= 0) return this.packets.splice(index, 1)[0]; await delay(5); } throw new Error(`Timed out waiting for ${type}; received ${this.packets.map(packet => packet.type).join(', ')}`); }
}
type State = { count: number; ids: string[]; secret: string; startedAt: number };
const rules: GameRules<State, null, { turnId: string; drawing?: unknown }, {}, { count: number }, { secret: string }> = {
  validateSettings(raw) { if (!raw || typeof raw !== 'object' || Object.keys(raw).length) throw new Error('Invalid settings'); return {}; },
  parseInput(raw) { if (raw !== null) throw new Error('No held input'); return null; },
  parseAction(raw) { const action = raw as { turnId: string; drawing?: unknown }; if (!action || typeof action.turnId !== 'string') throw new Error('Invalid action'); if (action.drawing) parseDrawing(action.drawing); return action; },
  create(ctx) { return { count: 0, ids: ctx.players.map(player => player.id), secret: 'SERVER_ONLY_ANSWER_KEY', startedAt: ctx.nowMs }; }, neutralInput: () => null,
  applyAction(state, id, action) { if (!state.ids.includes(id) || action.turnId !== 'turn-1') throw new Error('Wrong turn'); state.count++; },
  tick() {}, onPresenceChange() {}, publicView: state => ({ count: state.count }), playerView: (_state, id) => ({ secret: `private:${id}` }),
  outcome: state => ({ complete: state.count >= 2, winners: state.ids.slice(0, 1), rows: state.ids.map(playerId => ({ playerId, score: state.count })) }), dispose() {},
};
const makeGame = (id: string): RegisteredGame => ({ manifest: { contractVersion: '1.0', id, title: id, description: 'Test only', assetBase: `/games/${id}/`, modes: ['shared-display'], players: { min: 2, max: 10 }, orientation: { controller: 'portrait', personalView: 'any' }, timing: 'turn-based', input: ['action'], privatePlayerViews: true, supportsSolo: false }, rules });
async function harness(games = [makeGame('test-a'), makeGame('test-b')], opts = {}) {
  const server = createServer((request, response) => { void serveWorldSave(request, response, party); }); const party = createRoomServer(server, games, { tickMs: 5, startDelayMs: 5, prepareTimeoutMs: 500, ...opts });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); assert(address && typeof address !== 'string'); const peers: Peer[] = [];
  return { party, peers, url: `http://127.0.0.1:${address.port}`, async connect() { const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`); const peer = new Peer(socket); peers.push(peer); await new Promise<void>(resolve => socket.once('open', resolve)); return peer; }, async close() { await party.close(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
async function room(h: Awaited<ReturnType<typeof harness>>, count = 2) {
  const host = await h.connect(); host.send('room.create'); const hostWelcome = await host.take('room.welcome'); const phones: Peer[] = [], welcomes: Packet[] = [];
  for (let index = 0; index < count; index++) { const phone = await h.connect(); phone.send('room.join', { code: hostWelcome.room.code, role: 'controller', name: `Player ${index + 1}`, isHost: true, playerId: hostWelcome.clientId }); phones.push(phone); welcomes.push(await phone.take('room.welcome')); }
  return { host, hostWelcome, phones, welcomes };
}
async function start(h: Awaited<ReturnType<typeof harness>>, r: Awaited<ReturnType<typeof room>>, gameId = 'test-a') {
  const before = h.party.roomView().revision; r.host.send('game.select', { gameId, settings: {} }); const selected = await r.host.take('room.state', packet => packet.room.revision > before && packet.room.gameId === gameId && packet.room.phase === 'lobby');
  for (const phone of r.phones) phone.send('room.ready', { ready: true });
  await r.host.take('room.state', packet => packet.room.revision > selected.room.revision && packet.room.players.length === r.phones.length && packet.room.players.every((player: any) => player.ready));
  r.host.send('round.start'); const preparation = await r.host.take('round.prepare');
  for (const peer of [r.host, ...r.phones]) peer.send('round.ready', { roundId: preparation.roundId });
  const snapshot = await r.host.take('game.snapshot', packet => packet.roundId === preparation.roundId); assert.equal(h.party.roomView().phase, 'playing'); return snapshot.roundId as string;
}

test('long board-game sessions keep bounded payloads and deduplication beyond 256 actions', async () => {
  const game = makeGame('long-game'); game.actionLimits = { perPlayer: 260, maxBytes: 128 };
  game.rules = { ...rules, outcome: () => ({ complete: false, winners: [], rows: [] }) };
  const h = await harness([game]);
  try {
    const r = await room(h), roundId = await start(h, r, 'long-game'), phone = r.phones[0];
    for (let i = 0; i < 260; i++) { phone.send('game.action', { roundId, actionId: `a${i}`, payload: { turnId: 'turn-1' } }); assert.equal((await phone.take('action.ack')).accepted, true); await delay(14); }
    phone.send('game.action', { roundId, actionId: 'a0', payload: { turnId: 'turn-1' } }); assert.equal((await phone.take('action.ack')).accepted, true);
    phone.send('game.action', { roundId, actionId: 'over-count', payload: { turnId: 'turn-1' } }); assert.match((await phone.take('action.ack')).reason, /action limit/);
    r.phones[1].send('game.action', { roundId, actionId: 'over-bytes', payload: { turnId: 'turn-1', extra: 'x'.repeat(128) } }); assert.match((await r.phones[1].take('action.ack')).reason, /too large/);
    const latest = await phone.take('game.snapshot', packet => packet.publicView.count === 260); assert.equal(latest.publicView.count, 260);
  } finally { await h.close(); }
});

test('expanded action budgets cannot exceed the existing worst-case retained payload bound', () => {
  const game = makeGame('invalid-budget'); game.actionLimits = { perPlayer: 4096, maxBytes: 32768 };
  assert.throws(() => createRoomServer(createServer(), [game]), /action limits/);
});

test('late spectators cannot cancel the required screens common start by disconnecting or resuming',async()=>{
  let time=1000;const h=await harness(undefined,{now:()=>time,startDelayMs:100,prepareTimeoutMs:2000});
  try{
    const r=await room(h);r.host.send('game.select',{gameId:'test-a'});await r.host.take('room.state',p=>p.room.phase==='lobby');
    for(const phone of r.phones)phone.send('room.ready',{ready:true});await r.host.take('room.state',p=>p.room.players.every((a:any)=>a.ready));
    r.host.send('round.start');const preparation=await r.host.take('round.prepare');
    for(const peer of [r.host,...r.phones])peer.send('round.ready',{roundId:preparation.roundId});await r.host.take('round.begin');
    const late=await h.connect();late.send('room.join',{code:r.hostWelcome.room.code,name:'Late spectator'});const welcome=await late.take('room.welcome');
    late.socket.close();await r.host.take('room.state',p=>p.room.players.some((a:any)=>a.name==='Late spectator'&&!a.connected));
    assert.equal(h.party.roomView().startAt,1100);
    const resumed=await h.connect();resumed.send('room.rejoin',{code:r.hostWelcome.room.code,token:welcome.token});await resumed.take('room.welcome');
    assert.equal(h.party.roomView().startAt,1100);time=1200;
    await r.host.take('game.snapshot',p=>p.roundId===preparation.roundId);assert.equal(h.party.roomView().activePlayerIds.length,2);
  }finally{await h.close();}
});

test('unresponsive host sockets time out while idle peers answer heartbeats, then host grace closes the room', async () => {
  const h = await harness(undefined, { heartbeatIntervalMs: 20, heartbeatTimeoutMs: 30, hostGraceMs: 30 });
  try {
    const socket = new WebSocket(h.url.replace('http:', 'ws:') + '/ws', { autoPong: false }), host = new Peer(socket);
    await new Promise<void>(resolve => socket.once('open', resolve)); host.send('room.create'); const welcome = await host.take('room.welcome');
    const phone = await h.connect(); phone.send('room.join', { code: welcome.room.code, name: 'Idle phone' }); await phone.take('room.welcome');
    const absent = await phone.take('room.state', packet => !packet.room.hostConnected); assert.equal(absent.room.players[0].connected, true);
    assert.match((await phone.take('room.closed')).reason, /Host did not reconnect/);
  } finally { await h.close(); }
});

test('persistent room: spectator host, ten seats, authority, full-room reconnect, private projections, action dedupe and A → B → A', async () => {
  const h = await harness(); try {
    const r = await room(h, 10); assert.equal(r.hostWelcome.playerId, null); assert.equal(h.party.roomView().players.length, 10);
    const extra = await h.connect(); extra.send('room.join', { code: r.hostWelcome.room.code, name: 'Eleventh' }); assert.match((await extra.take('error')).reason, /ten seats/);
    r.phones[0].send('game.select', { gameId: 'test-a', isHost: true }); assert.match((await r.phones[0].take('error')).reason, /Only the room host/);
    const first = await start(h, r);
    const display = await r.host.take('game.snapshot', packet => packet.roundId === first); assert.equal(display.privateView, null); assert(!JSON.stringify(display).includes('SERVER_ONLY'));
    const privatePacket = await r.phones[0].take('game.snapshot', packet => packet.roundId === first); assert.equal(privatePacket.privateView.secret, `private:${r.welcomes[0].playerId}`); assert(!JSON.stringify(privatePacket).includes(`private:${r.welcomes[1].playerId}`));
    for (const peer of [r.host, ...r.phones]) for (const packet of peer.packets) if (packet.type !== 'room.welcome') assert(!JSON.stringify(packet).includes(r.welcomes[0].token));
    r.phones[0].send('game.action', { roundId: first, actionId: 'vote-1', payload: { turnId: 'turn-1' } }); assert.equal((await r.phones[0].take('action.ack')).accepted, true);
    r.phones[0].send('game.action', { roundId: first, actionId: 'vote-1', payload: { turnId: 'turn-1' } }); assert.equal((await r.phones[0].take('action.ack')).accepted, true);
    r.phones[0].send('game.action', { roundId: first, actionId: 'vote-1', payload: { turnId: 'turn-2' } }); assert.match((await r.phones[0].take('action.ack')).reason, /different payload/);
    r.phones[0].send('game.action', { roundId: first, actionId: 'late-turn', payload: { turnId: 'old-turn' } }); assert.match((await r.phones[0].take('action.ack')).reason, /Wrong turn/);
    const replacement = await h.connect(); replacement.send('room.rejoin', { code: r.hostWelcome.room.code, token: r.welcomes[0].token }); const resumed = await replacement.take('room.welcome'); assert.equal(resumed.playerId, r.welcomes[0].playerId); assert.equal(h.party.roomView().players.length, 10); r.phones[0] = replacement;
    replacement.send('game.action', { roundId: first, actionId: 'vote-1', payload: { turnId: 'turn-1' } }); assert.equal((await replacement.take('action.ack')).accepted, true);
    const after = await replacement.take('game.snapshot', packet => packet.publicView.count === 1); assert.equal(after.privateView.secret, `private:${resumed.playerId}`);
    replacement.send('game.action', { roundId: first, actionId: 'vote-2', payload: { turnId: 'turn-1' } }); await replacement.take('action.ack'); const results = await r.host.take('round.results'); assert.equal(results.outcome.rows.length, 10);
    r.host.send('room.returnToPicker'); await r.host.take('room.state', packet => packet.room.phase === 'picker'); const second = await start(h, r, 'test-b'); assert.notEqual(second, first);
    replacement.send('game.action', { roundId: first, actionId: 'old-round', payload: { turnId: 'turn-1' } }); assert.match((await replacement.take('action.ack', packet => packet.actionId === 'old-round')).reason, /old round/);
    r.host.send('round.abort', { roundId: second }); await r.host.take('room.state', packet => packet.room.phase === 'lobby' && packet.room.roundId === null);
    const third = await start(h, r, 'test-a'); assert.notEqual(third, first); assert.equal(h.party.roomView().code, r.hostWelcome.room.code); assert.equal(h.party.roomView().id, r.hostWelcome.room.id);
    const drawing = { strokes: [{ color: DRAWING_COLORS[0], width: 0.01, points: Array.from({ length: 480 }, (_, index) => ({ x: (index % 100) / 100, y: Math.floor(index / 100) / 10 })) }] };
    const envelope = { roundId: third, actionId: 'drawing', payload: { turnId: 'turn-1', drawing } }; assert(Buffer.byteLength(JSON.stringify(envelope)) > 4096); replacement.send('game.action', envelope); assert.equal((await replacement.take('action.ack', packet => packet.actionId === 'drawing')).accepted, true);
    replacement.socket.send('{"v":"1.0","type":"clock.ping","clientTime":1e999}'); assert.match((await replacement.take('error')).reason, /non-serializable/);
  } finally { await h.close(); }
});

test('preparation waits, times out with named screen, ignores stale ready; failed loading returns to lobby', async () => {
  const h = await harness(undefined, { prepareTimeoutMs: 60 }); try {
    const r = await room(h); r.host.send('game.select', { gameId: 'test-a' }); await r.host.take('room.state', packet => packet.room.phase === 'lobby');
    for (const phone of r.phones) phone.send('room.ready', { ready: true }); await r.host.take('room.state', packet => packet.room.players.every((player: any) => player.ready));
    r.host.send('round.start'); const prepare = await r.host.take('round.prepare'); r.host.send('round.ready', { roundId: prepare.roundId }); r.phones[0].send('round.ready', { roundId: prepare.roundId });
    const returned = await r.host.take('room.state', packet => packet.room.phase === 'lobby' && !!packet.room.notice); assert.match(returned.room.notice, /Player 2/); assert(!r.host.packets.some(packet => packet.type === 'game.snapshot'));
    r.phones[1].send('round.ready', { roundId: prepare.roundId }); r.phones[1].send('clock.ping', { clientTime: 1 }); await r.phones[1].take('clock.pong'); assert(!r.phones[1].packets.some(p => p.type === 'error')); assert.equal(h.party.roomView().phase, 'lobby');
  } finally { await h.close(); }
});

test('host credential takeover preserves authority; strangers cannot resume; oversized packets close only sender', async () => {
  const h = await harness(); try {
    const r = await room(h); const stranger = await h.connect(); stranger.send('room.rejoin', { code: r.hostWelcome.room.code, token: 'wrong-token' }); assert.match((await stranger.take('error')).reason, /Saved seat expired/);
    const replacement = await h.connect(); replacement.send('room.rejoin', { code: r.hostWelcome.room.code, token: r.hostWelcome.token }); const welcome = await replacement.take('room.welcome'); assert.equal(welcome.clientId, r.hostWelcome.clientId); assert.equal(welcome.playerId, null);
    replacement.send('game.select', { gameId: 'test-a' }); await replacement.take('room.state', packet => packet.room.phase === 'lobby');
    const closed = new Promise<number>(resolve => stranger.socket.once('close', code => resolve(code))); stranger.socket.send('x'.repeat(32769)); assert.equal(await closed, 1009);
    replacement.send('clock.ping', { clientTime: 10 }); assert.equal((await replacement.take('clock.pong')).clientTime, 10);
  } finally { await h.close(); }
});

test('drawing and LAN address boundaries', () => {
  assert.throws(() => parseDrawing({ strokes: [{ color: 'red', width: 0.01, points: [{ x: 0, y: 0 }] }] }));
  assert.throws(() => parseDrawing({ strokes: [{ color: DRAWING_COLORS[0], width: 0.01, points: [{ x: Infinity, y: 0 }] }] }));
  assert.throws(() => parseDrawing({ strokes: [{ color: DRAWING_COLORS[0], width: 0.01, points: Array.from({ length: 481 }, () => ({ x: 0, y: 0 })) }] }));
  assert.deepEqual(parseDrawing({ strokes: [] }), { strokes: [] });
  const addresses = discoverPartyAddresses(4317, () => ({ lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }], en0: [{ address: '192.168.1.12', family: 'IPv4', internal: false }] }) as any, 'evil.example');
  assert.equal(addresses.preferredUrl, 'http://192.168.1.12:4317'); assert(!JSON.stringify(addresses).includes('evil.example'));
});

test('all six real modules finish timeout-driven ten-player rounds; Quip → Sketch → Quip keeps sockets and drafts private', async () => {
  const { games } = await import('../apps/party-server/src/registry');
  let time = Date.now();
  const h = await harness(games, { now: () => time, startDelayMs: 0, prepareTimeoutMs: 20000 });
  try {
    const r = await room(h, 10);
    for (const gameId of ['quip-clash', 'sketch-bluff', 'quip-clash', 'tall-tales', 'shirt-show', 'odd-one-in', 'quiz-panic']) {
      const id = await start(h, r, gameId);
      const first = await r.phones[0].take('game.snapshot', packet => packet.roundId === id);
      if (gameId === 'quip-clash') {
        const payload = { type: 'draft', turnId: first.publicView.turnId, questionId: first.privateView.questions[0].id, text: 'PRIVATE_DRAFT_SOCKET_SENTINEL' };
        r.phones[0].send('game.action', { roundId: id, actionId: 'draft', payload }); assert.equal((await r.phones[0].take('action.ack', packet => packet.roundId === id)).accepted, true);
        const self = await r.phones[0].take('game.snapshot', packet => packet.roundId === id && JSON.stringify(packet.privateView).includes('PRIVATE_DRAFT_SOCKET_SENTINEL')); assert(self);
        const resumed = await h.connect(); resumed.send('room.rejoin', { code: r.hostWelcome.room.code, token: r.welcomes[0].token }); await resumed.take('room.welcome'); const restored = await resumed.take('game.snapshot', packet => packet.roundId === id); assert(JSON.stringify(restored.privateView).includes('PRIVATE_DRAFT_SOCKET_SENTINEL')); r.phones[0] = resumed;
        r.phones[0].send('game.action', { roundId: id, actionId: 'draft', payload }); assert.equal((await r.phones[0].take('action.ack', packet => packet.roundId === id)).accepted, true);
        for (const other of [r.host, ...r.phones.slice(1)]) for (const packet of other.packets) assert(!JSON.stringify(packet).includes('PRIVATE_DRAFT_SOCKET_SENTINEL'));
      }
      if (gameId === 'sketch-bluff') {
        const drawing = { strokes: [{ color: DRAWING_COLORS[0], width: 0.012, points: [{ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.8 }] }] };
        r.phones[0].send('game.action', { roundId: id, actionId: 'draw', payload: { type: 'drawing', turnId: first.publicView.turnId, drawing } }); assert.equal((await r.phones[0].take('action.ack', packet => packet.roundId === id)).accepted, true);
        assert(first.privateView.prompt); for (const packet of r.host.packets.filter(packet => packet.roundId === id)) assert(!JSON.stringify(packet).includes(first.privateView.prompt));
      }
      let transitions = 0;
      while (h.party.roomView().phase === 'playing' && transitions++ < 180) { time += 120000; await delay(8); }
      assert.equal(h.party.roomView().phase, 'results', `${gameId}: ${h.party.roomView().notice}`);
      const results = await r.host.take('round.results', packet => packet.roundId === id); assert.equal(results.outcome.rows.length, 10);
      assert.equal(results.privateView, null); assert.equal(h.party.roomView().code, r.hostWelcome.room.code);
      r.host.send('room.returnToPicker'); await r.host.take('room.state', packet => packet.room.phase === 'picker' && packet.room.revision > 0);
      // Bound test-side history too; the real client retains only its current snapshot.
      for (const peer of [r.host, ...r.phones]) peer.packets.length = 0;
    }
  } finally { await h.close(); }
});

test('start time is injected after preparation and host absence eventually closes the room', async () => {
  let time = 1000, createdAt: number | null = null;
  const game = makeGame('test-a'); game.rules = { ...rules, create(ctx, settings) { createdAt = ctx.nowMs; return rules.create(ctx, settings); } };
  const h = await harness([game], { now: () => time, startDelayMs: 100, hostGraceMs: 200 });
  try {
    const r = await room(h); r.host.send('game.select', { gameId: 'test-a' }); await r.host.take('room.state', packet => packet.room.phase === 'lobby');
    for (const phone of r.phones) phone.send('room.ready', { ready: true }); await r.host.take('room.state', packet => packet.room.players.every((player: any) => player.ready));
    r.host.send('round.start'); const preparing = await r.host.take('round.prepare'); assert.equal(createdAt, null);
    for (const peer of [r.host, ...r.phones]) peer.send('round.ready', { roundId: preparing.roundId }); const begin = await r.host.take('round.begin'); assert.equal(begin.startAt, 1100);
    time = 1099; await delay(10); assert.equal(createdAt, null); time = 1100; await r.host.take('game.snapshot'); assert.equal(createdAt, 1100);
    r.host.socket.close(); await r.phones[0].take('room.state', packet => !packet.room.hostConnected); time = 1301; const closed = await r.phones[0].take('room.closed'); assert.match(closed.reason, /Host did not reconnect/);
  } finally { await h.close(); }
});

test('realtime simulation runs fixed steps independently of snapshots; release, stale sequences and takeover neutralize controls', async () => {
  const { manifest } = await import('../packages/games/scene-lab/src/manifest');
  const { rules: arena } = await import('../packages/games/scene-lab/src/server');
  let time = 1000; const ticks: number[] = [];
  const game = { manifest, rules: { ...arena, tick(state: any, inputs: any, dt: number, now: number) { ticks.push(dt); arena.tick(state, inputs, dt, now); } } };
  const h = await harness([game], { now: () => time, seed: () => 123, startDelayMs: 0 });
  try {
    const r = await room(h); const id = await start(h, r, 'scene-lab'); const playerId = r.welcomes[0].playerId;
    const position = (packet: Packet) => packet.publicView.players.find((p: any) => p.id === playerId).x;
    const baseline = position(await r.phones[0].take('game.snapshot'));
    r.phones[0].send('input.state', { roundId: id, seq: 1, payload: { x: -1, y: 0, boost: true } }); await delay(10); time += 100; await delay(10);
    const moved = await r.host.take('game.snapshot', packet => position(packet) < baseline); assert.equal(ticks.length, 6); assert(ticks.every(dt => dt === 1 / 60));
    r.phones[0].send('input.release', { roundId: id, seq: 2 }); r.phones[0].send('input.state', { roundId: id, seq: 1, payload: { x: 1, y: 0, boost: true } }); await delay(10); time += 100;
    const stopped = await r.host.take('game.snapshot', packet => packet.serverTime === time); assert.equal(position(stopped), position(moved));
    r.phones[0].send('input.state', { roundId: id, seq: 3, payload: { x: -1, y: 0, boost: true } }); await delay(10);
    const resumed = await h.connect(); resumed.send('room.rejoin', { code: r.hostWelcome.room.code, token: r.welcomes[0].token }); await resumed.take('room.welcome'); time += 100;
    const takeover = await resumed.take('game.snapshot', packet => packet.serverTime === time); assert.equal(position(takeover), position(stopped));
    resumed.send('input.state', { roundId: id, seq: 0, payload: { x: -1, y: 0, boost: true } }); await delay(10); time += 1600;
    const stale = await resumed.take('game.snapshot', packet => packet.serverTime === time); assert.equal(position(stale), position(stopped)); assert.equal(ticks.length, 24);
    r.host.send('round.failed', { roundId: id }); const lobby = await r.host.take('room.state', packet => packet.room.phase === 'lobby' && !!packet.room.notice); assert.match(lobby.room.notice, /render/);
  } finally { await h.close(); }
});

test('preparation credential takeover invalidates old readiness and restarts the common countdown', async () => {
  let time = 1000; const h = await harness(undefined, { now: () => time, startDelayMs: 100, prepareTimeoutMs: 2000 });
  try {
    const r = await room(h); r.host.send('game.select', { gameId: 'test-a' }); await r.host.take('room.state', packet => packet.room.phase === 'lobby');
    for (const phone of r.phones) phone.send('room.ready', { ready: true }); await r.host.take('room.state', packet => packet.room.players.every((p: any) => p.ready));
    r.host.send('round.start'); const prepare = await r.host.take('round.prepare'); for (const peer of [r.host, ...r.phones]) peer.send('round.ready', { roundId: prepare.roundId }); await r.host.take('round.begin');
    const replacement = await h.connect(); replacement.send('room.rejoin', { code: r.hostWelcome.room.code, token: r.welcomes[0].token }); const welcome = await replacement.take('room.welcome'); assert.equal(welcome.room.startAt, null);
    time = 1200; await delay(20); assert.equal(h.party.roomView().phase, 'preparing'); assert(!replacement.packets.some(p => p.type === 'game.snapshot'));
    replacement.send('round.ready', { roundId: prepare.roundId }); const begin = await replacement.take('round.begin'); assert.equal(begin.startAt, 1300);
    time = 1299; await delay(10); assert.equal(h.party.roomView().phase, 'preparing'); time = 1300; await replacement.take('game.snapshot'); assert.equal(h.party.roomView().phase, 'playing');
  } finally { await h.close(); }
});


test('host world saves authenticate, validate atomically, reload through fresh preparation, and finish with results', async () => {
  let creates = 0, disposed = 0;
  const game = makeGame('world-test');
  game.manifest.sessionControls = ['save', 'finish'];
  game.manifest.snapshotCache = { revisionField: 'revision', fields: ['edits'], keyedPairsFields: ['edits'] };
  game.rules = { ...rules,
    create(ctx, settings) { creates++; return rules.create(ctx, settings); },
    publicView: state => ({ count: state.count, revision: state.count, edits: Array.from({ length: 100 }, (_, i) => [i, i ? 0 : state.count]) }),
    exportSave: state => ({ format: 'world-test', count: state.count }),
    loadSave(ctx, value, settings) { const raw = value as { format: string; count: number }; if (raw?.format !== 'world-test' || !Number.isInteger(raw.count) || raw.count < 0 || raw.count > 2) throw new Error('Invalid world file.'); return { state: { ...rules.create(ctx, {}), count: raw.count }, settings }; },
    finish(state) { state.count = 2; }, dispose() { disposed++; },
  };
  const h = await harness([game]);
  try {
    const r = await room(h), id = await start(h, r, 'world-test');
    const headers = (token = r.hostWelcome.token, roundId = id) => ({ Authorization: `Bearer ${token}`, 'X-Party-Round': roundId, 'Content-Type': 'application/json' });
    const save = (method = 'GET', body?: string, token = r.hostWelcome.token, roundId = id) => fetch(h.url + '/api/round/save', { method, headers: headers(token, roundId), ...(body !== undefined ? { body } : {}) });
    const cached = await r.host.take('game.snapshot', packet => packet.publicCache?.reused); assert(!Object.hasOwn(cached.publicView, 'edits'));
    r.host.send('snapshot.sync', { roundId: id }); assert.deepEqual((await r.host.take('game.snapshot', packet => packet.publicCache?.reused === false)).publicView.edits, Array.from({ length: 100 }, (_, i) => [i, 0]));
    const resumed = await h.connect(); resumed.send('room.rejoin', { code: r.hostWelcome.room.code, token: r.welcomes[0].token }); await resumed.take('room.welcome'); assert.equal((await resumed.take('game.snapshot')).publicCache.reused, false); r.phones[0] = resumed;
    assert.equal((await save('GET', undefined, 'a'.repeat(64))).ok, false);
    assert.equal((await save('GET', undefined, r.welcomes[0].token)).ok, false);
    assert.equal((await save('GET', undefined, r.hostWelcome.token, 'stale')).ok, false);
    const exported = await (await save()).json(); assert.deepEqual(exported, { format: 'world-test', count: 0 }); assert(!JSON.stringify(exported).includes('secret'));
    for (const body of ['{', '{"format":"wrong"}', JSON.stringify({ format: 'world-test', count: 0, padding: 'x'.repeat(262144) })]) {
      assert.equal((await save('PUT', body)).ok, false); assert.equal(h.party.roomView().roundId, id); assert.equal(h.party.roomView().phase, 'playing');
    }
    const imported = await (await save('PUT', JSON.stringify({ format: 'world-test', count: 1 }))).json();
    await r.host.take('round.prepare', packet => packet.roundId === imported.roundId); assert.notEqual(imported.roundId, id); assert.equal(h.party.roomView().phase, 'preparing'); assert.equal(creates, 1); assert.equal(disposed, 1);
    assert.equal((await save()).ok, false);
    r.host.send('round.ready', { roundId: id }); r.host.send('clock.ping', { clientTime: 2 }); await r.host.take('clock.pong'); assert(!r.host.packets.some(p => p.type === 'error')); assert.equal(h.party.roomView().startAt, null);
    for (const peer of [r.host, ...r.phones]) peer.send('round.ready', { roundId: imported.roundId });
    const loaded = await r.host.take('game.snapshot', packet => packet.roundId === imported.roundId); assert.equal(loaded.publicView.count, 1); assert.equal(loaded.publicCache.reused, false); assert.equal(creates, 1);
    r.phones[0].send('round.finish', { roundId: imported.roundId }); assert.match((await r.phones[0].take('error')).reason, /Only the room host/);
    r.host.send('round.finish', { roundId: imported.roundId }); const result = await r.host.take('round.results', packet => packet.roundId === imported.roundId); assert.equal(result.outcome.complete, true); assert.equal(result.outcome.rows.length, 2); assert.deepEqual(result.publicCache.patches.edits, { set: [[0, 2]], remove: [] });
    assert.equal((await save('GET', undefined, r.hostWelcome.token, imported.roundId)).ok, true);
    r.host.send('room.returnToPicker'); await r.host.take('room.state', packet => packet.room.phase === 'picker'); const replay = await start(h, r, 'world-test'); assert.notEqual(replay, imported.roundId); assert.equal(creates, 2);
  } finally { await h.close(); }
});

test('save-capable render failure retains the world in results and checkpoints initial, periodic and teardown state', async () => {
  const writes: { id: string; save: string }[] = [], game = makeGame('world-test');
  game.manifest.sessionControls = ['save', 'finish'];
  game.rules = { ...rules, exportSave: state => ({ count: state.count }), loadSave: () => { throw new Error('Not needed'); }, finish: state => { state.count = 2; } };
  const recoveryStore = { async write(_game: string, id: string, save: string) { writes.push({ id, save }); }, async list() { return []; }, async read() { return { save: '{}', worldId: 'test-world' }; }, async flush() {} };
  const h = await harness([game], { recoveryStore, recoveryIntervalMs: 20 });
  let closed = false;
  try {
    const r = await room(h), id = await start(h, r, 'world-test');
    assert.equal(writes.length, 1); assert.deepEqual(JSON.parse(writes[0].save), { count: 0 });
    r.phones[0].send('game.action', { roundId: id, actionId: 'edit', payload: { turnId: 'turn-1' } }); await r.phones[0].take('action.ack'); await delay(35);
    assert(writes.some(item => JSON.parse(item.save).count === 1));
    r.host.send('round.failed', { roundId: id }); const results = await r.host.take('round.results');
    assert.equal(results.roundId, id); assert.equal(results.outcome.complete, true); assert.match(h.party.roomView().notice!, /world.*(paused|saved|recover)/i);
    assert.deepEqual(JSON.parse(h.party.exportSave(r.hostWelcome.token, id)), { count: 2 });
    const beforeClose = writes.length; await h.close(); closed = true; assert(writes.length > beforeClose); assert(writes.every(item => item.id === writes[0].id));
  } finally { if (!closed) await h.close(); }
});

test('autosave survives server restart and restores only through authenticated ready lobby preparation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'party-world-restart-')), game = makeGame('world-test');
  game.manifest.sessionControls = ['save', 'finish'];
  game.rules = { ...rules, exportSave: state => ({ format: 'world-test', count: state.count }), loadSave(ctx, value) { const raw = value as { format: string; count: number }; if (raw?.format !== 'world-test' || !Number.isInteger(raw.count)) throw new Error('Invalid world.'); return { state: { ...rules.create(ctx, {}), count: raw.count }, settings: {} }; }, finish: state => { state.count = 2; } };
  let h = await harness([game], { recoveryStore: createRecoveryStore(root) });
  try {
    const old = await room(h), oldId = await start(h, old, 'world-test');
    old.phones[0].send('game.action', { roundId: oldId, actionId: 'edit', payload: { turnId: 'turn-1' } }); await old.phones[0].take('action.ack');
    await h.close(); h = await harness([game], { recoveryStore: createRecoveryStore(root) });
    const r = await room(h); r.host.send('game.select', { gameId: 'world-test' }); await r.host.take('room.state', packet => packet.room.phase === 'lobby');
    const api = (method = 'GET', token = r.hostWelcome.token, query = '', body?: string) => fetch(h.url + '/api/world/recovery?gameId=world-test' + query, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body } : {}) });
    assert.equal((await api('GET', r.welcomes[0].token)).ok, false);
    assert.equal((await api('GET', old.hostWelcome.token)).ok, false);
    const metadata = await (await api()).json(); assert.equal(metadata.checkpoints[0].slot, 'latest');
    assert.deepEqual(await (await api('GET', undefined, '&slot=latest&download=1')).json(), { format: 'world-test', count: 1 });
    assert.equal((await api('PUT', undefined, '', '{"slot":"latest"}')).ok, false);
    for (const phone of r.phones) phone.send('room.ready', { ready: true }); await r.host.take('room.state', packet => packet.room.players.every((player: any) => player.ready));
    const response = await api('PUT', undefined, '', '{"slot":"latest"}'); assert.equal(response.ok, true); const loaded = await response.json();
    assert.notEqual(loaded.roundId, oldId); assert.equal(h.party.roomView().phase, 'preparing');
    for (const peer of [r.host, ...r.phones]) peer.send('round.ready', { roundId: loaded.roundId });
    const snapshot = await r.host.take('game.snapshot', packet => packet.roundId === loaded.roundId); assert.equal(snapshot.publicView.count, 1);
    assert.equal((await api('PUT', undefined, '', '{"slot":"latest"}')).ok, false);
  } finally { await h.close(); await rm(root, { recursive: true, force: true }); }
});

test('storage errors keep play running and broken game projections preserve the last good checkpoint', async () => {
  let storageBroken = false, projectionBroken = false;
  const writes: string[] = [], game = makeGame('world-test'); game.manifest.sessionControls = ['save', 'finish'];
  game.rules = { ...rules, publicView(state) { if (projectionBroken) throw new Error('Projection failed'); return { count: state.count }; }, exportSave: state => ({ count: state.count }), loadSave: () => { throw new Error('Not needed'); }, finish: state => { state.count = 2; } };
  const recoveryStore = { async write(_game: string, _id: string, save: string) { if (storageBroken) throw new Error('Disk full'); writes.push(save); }, async list() { return []; }, async read() { return { save: '{}', worldId: 'test-world' }; }, async flush() {} };
  const h = await harness([game], { recoveryStore, recoveryIntervalMs: 20 });
  try {
    const r = await room(h), id = await start(h, r, 'world-test'); assert.equal(writes.length, 1);
    storageBroken = true;
    await r.host.take('room.state', packet => /Automatic world save failed: Disk full/.test(packet.room.notice ?? '')); assert.equal(h.party.roomView().phase, 'playing');
    r.phones[0].send('game.action', { roundId: id, actionId: 'edit', payload: { turnId: 'turn-1' } }); await r.phones[0].take('action.ack');
    projectionBroken = true;
    await r.host.take('room.state', packet => packet.room.phase === 'lobby' && /Projection failed/.test(packet.room.notice ?? ''));
    assert.match(h.party.roomView().notice!, /restore an available autosave/); assert.deepEqual(writes.map(save => JSON.parse(save)), [{ count: 0 }]);
    await delay(30); assert.equal(h.party.roomView().phase, 'lobby');
  } finally { await h.close(); }
});

test('healthy storage never receives a checkpoint whose public, private or outcome projection is invalid', async () => {
  for (const broken of ['public', 'private', 'outcome'] as const) {
    const writes: string[] = [], game = makeGame('world-test'); game.manifest.sessionControls = ['save', 'finish'];
    game.rules = { ...rules,
      publicView(state) { if (broken === 'public' && state.count === 1) throw new Error('Broken public projection'); return rules.publicView(state, { nowMs: 0, phase: 'playing' }); },
      playerView(state, id, ctx) { return broken === 'private' && state.count === 1 ? { secret: undefined as unknown as string } : rules.playerView(state, id, ctx); },
      outcome(state) { return broken === 'outcome' && state.count === 1 ? { complete: false, winners: [], rows: [{ playerId: state.ids[0], score: NaN }] } : rules.outcome(state); },
      exportSave: state => ({ count: state.count }), loadSave: () => { throw new Error('Not needed'); }, finish: state => { state.count = 2; },
    };
    const recoveryStore = { async write(_game: string, _id: string, save: string) { writes.push(save); }, async list() { return []; }, async read() { return { save: '{}', worldId: 'test-world' }; }, async flush() {} };
    const h = await harness([game], { recoveryStore, recoveryIntervalMs: 1 });
    try {
      const r = await room(h), id = await start(h, r, 'world-test');
      r.phones[0].send('game.action', { roundId: id, actionId: 'break-projection', payload: { turnId: 'turn-1' } }); await r.phones[0].take('action.ack');
      await r.host.take('room.state', packet => packet.room.phase === 'lobby' && /Round stopped/.test(packet.room.notice ?? ''));
      await delay(10); assert(writes.length > 0); assert(writes.every(save => JSON.parse(save).count === 0), `${broken}: invalid state reached healthy storage`);
      assert.match(h.party.roomView().notice!, /restore an available autosave from the lobby/);
    } finally { await h.close(); }
  }
});

test('restoring and resuming a world preserves its lineage and the previous world backup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'party-world-lineage-')), recoveryStore = createRecoveryStore(root), game = makeGame('world-test');
  game.manifest.sessionControls = ['save', 'finish'];
  game.rules = { ...rules, exportSave: state => ({ count: state.count }), loadSave(ctx, raw) { const value = raw as { count: number }; if (!Number.isInteger(value?.count)) throw new Error('Invalid save'); return { state: { ...rules.create(ctx, {}), count: value.count }, settings: {} }; }, finish: state => { state.secret = 'finished'; }, outcome: state => ({ ...rules.outcome(state), complete: state.secret === 'finished' }) };
  await recoveryStore.write('world-test', 'world-a', '{"count":10}', 1); await recoveryStore.write('world-test', 'world-b', '{"count":20}', 2);
  const h = await harness([game], { recoveryStore });
  try {
    const r = await room(h); r.host.send('game.select', { gameId: 'world-test' }); await r.host.take('room.state', packet => packet.room.phase === 'lobby');
    const restore = async () => {
      for (const phone of r.phones) phone.send('room.ready', { ready: true }); await r.host.take('room.state', packet => packet.room.phase === 'lobby' && packet.room.players.every((player: any) => player.ready));
      const loaded = await h.party.restoreRecovery(r.hostWelcome.token, 'world-test', 'latest');
      for (const peer of [r.host, ...r.phones]) peer.send('round.ready', { roundId: loaded.roundId });
      await r.host.take('game.snapshot', packet => packet.roundId === loaded.roundId); return loaded.roundId;
    };
    const previous = async () => JSON.parse(await h.party.exportRecovery(r.hostWelcome.token, 'world-test', 'previous'));
    const first = await restore(); assert.deepEqual(await previous(), { count: 10 });
    r.host.send('round.resume', { roundId: first }); assert.match((await r.host.take('error')).reason, /results/);
    r.host.send('round.finish', { roundId: first }); await r.host.take('round.results', packet => packet.roundId === first);
    r.phones[0].send('round.resume', { roundId: first }); assert.match((await r.phones[0].take('error')).reason, /Only the room host/);
    r.host.send('round.resume', { roundId: first }); const resumed = await r.host.take('round.prepare', packet => packet.roundId !== first); assert.notEqual(resumed.roundId, first);
    for (const peer of [r.host, ...r.phones]) peer.send('round.ready', { roundId: resumed.roundId });
    const view = await r.host.take('game.snapshot', packet => packet.roundId === resumed.roundId); assert.equal(view.publicView.count, 20); assert.deepEqual(await previous(), { count: 10 });
    for (let i = 0, id = resumed.roundId; i < 2; i++) {
      r.host.send('round.abort', { roundId: id }); await r.host.take('room.state', packet => packet.room.phase === 'lobby' && packet.room.roundId === null);
      id = await restore(); assert.deepEqual(await previous(), { count: 10 });
    }
  } finally { await h.close(); await rm(root, { recursive: true, force: true }); }
});

test('in-flight held input from a replaced round is discarded without warning or poisoning the new sequence',async()=>{
  const {manifest}=await import('../packages/games/scene-lab/src/manifest'),{rules:arena}=await import('../packages/games/scene-lab/src/server');
  let time=1000;const h=await harness([{manifest,rules:arena}],{now:()=>time,startDelayMs:0});
  try{const r=await room(h),old=await start(h,r,'scene-lab'),phone=r.phones[0];r.host.send('round.abort',{roundId:old});await r.host.take('room.state',p=>p.room.phase==='lobby');
    phone.send('input.release',{roundId:old,seq:999});const current=await start(h,r,'scene-lab');
    phone.send('input.state',{roundId:old,seq:1000,payload:{x:1,y:0,boost:true}});phone.send('input.release',{roundId:old,seq:1001});phone.send('clock.ping',{clientTime:123});await phone.take('clock.pong',p=>p.clientTime===123);
    assert.deepEqual(phone.packets.filter(p=>p.type==='error'),[]);const playerId=r.welcomes[0].playerId,position=(p:Packet)=>p.publicView.players.find((a:any)=>a.id===playerId).x,baseline=position(await phone.take('game.snapshot',p=>p.roundId===current));
    phone.send('input.state',{roundId:current,seq:1,payload:{x:-1,y:0,boost:false}});await delay(10);time+=100;const moved=await phone.take('game.snapshot',p=>p.roundId===current&&p.serverTime===time);assert(position(moved)<baseline);
    phone.send('game.action',{roundId:old,actionId:'still-reject-reliable',payload:{}});assert.match((await phone.take('action.ack',p=>p.actionId==='still-reject-reliable')).reason,/old round/);
  }finally{await h.close();}
});

test('cancelled-load readiness is silent and cannot ready a replacement round', async () => {
  const h = await harness(); try {
    const r = await room(h);
    r.host.send('game.select', { gameId: 'test-a' }); await r.host.take('room.state', p => p.room.phase === 'lobby');
    for (const phone of r.phones) phone.send('room.ready', { ready: true });
    await r.host.take('room.state', p => p.room.players.every((player: any) => player.ready));
    r.host.send('round.start'); const old = (await r.host.take('round.prepare')).roundId;
    r.phones[0].send('round.failed', { roundId: old }); await r.host.take('room.state', p => p.room.phase === 'lobby' && p.room.notice?.includes('could not load'));
    r.host.send('round.ready', { roundId: old }); r.host.send('clock.ping', { clientTime: 501 }); await r.host.take('clock.pong');
    assert(!r.host.packets.some(p => p.type === 'error'));
    for (const phone of r.phones) phone.send('room.ready', { ready: true });
    await r.host.take('room.state', p => p.room.players.every((player: any) => player.ready));
    r.host.send('round.start'); const fresh = (await r.host.take('round.prepare')).roundId;
    r.host.send('round.ready', { roundId: fresh }); r.phones[0].send('round.ready', { roundId: fresh });
    r.phones[1].send('round.ready', { roundId: old }); r.phones[1].send('clock.ping', { clientTime: 502 }); await r.phones[1].take('clock.pong');
    assert.equal(h.party.roomView().startAt, null); assert(!r.phones[1].packets.some(p => p.type === 'error'));
    r.phones[1].send('round.ready', { roundId: fresh }); await r.host.take('game.snapshot', p => p.roundId === fresh);
    r.host.send('round.ready', { roundId: fresh }); r.host.send('clock.ping', { clientTime: 503 }); await r.host.take('clock.pong');
    assert.equal(h.party.roomView().phase, 'playing'); assert(!r.host.packets.some(p => p.type === 'error'));
  } finally { await h.close(); }
});

test('per-seat lobby drafts validate readiness, retain reconnects/settings, reject stale edits and reset on replay/game switch', async () => {
  let created: unknown[]=[];
  const game=makeGame('lobby-game');game.rules={...rules,
    parseLobbyChoice(raw,ready){const p=raw as {pick:string|null};if(!p||Object.keys(p).length!==1||p.pick!==null&&!['red','blue'].includes(p.pick)||ready&&!p.pick)throw Error('Choose first');return {pick:p.pick};},
    create(ctx,settings){created=ctx.players.map(p=>p.lobbyChoice);return rules.create(ctx,settings);}};
  const h=await harness([game,makeGame('other')]);
  try {
    const r=await room(h);r.host.send('game.select',{gameId:'lobby-game'});let v=(await r.host.take('room.state',p=>p.room.phase==='lobby')).room;
    const choose=(peer:Peer,pick:string|null,id=v.lobbyId)=>peer.send('lobby.choice',{lobbyId:id,payload:{pick}});
    r.phones[0].send('room.ready',{ready:true,lobbyId:v.lobbyId});assert.match((await r.phones[0].take('error')).reason,/Choose first/);
    choose(r.host,'red');assert.match((await r.host.take('error')).reason,/no longer available/);
    choose(r.phones[0],null);await r.host.take('room.state',p=>p.room.players[0]?.lobbyChoice?.pick===null);
    choose(r.phones[0],'red');await r.host.take('room.state',p=>p.room.players[0]?.lobbyChoice?.pick==='red');
    r.phones[0].send('room.ready',{ready:true,lobbyId:v.lobbyId});await r.host.take('room.state',p=>p.room.players[0]?.ready);
    choose(r.phones[0],'blue');assert.match((await r.phones[0].take('error')).reason,/Not ready/);
    r.phones[0].socket.close();await r.host.take('room.state',p=>!p.room.players[0]?.connected);
    const resumed=await h.connect();resumed.send('room.rejoin',{code:r.hostWelcome.room.code,token:r.welcomes[0].token});const welcome=await resumed.take('room.welcome');assert.deepEqual(welcome.room.players[0]?.lobbyChoice,{pick:'red'});r.phones[0]=resumed;
    const oldId=v.lobbyId;r.host.send('game.select',{gameId:'lobby-game',settings:{}});v=(await r.host.take('room.state',p=>p.room.lobbyId&&p.room.lobbyId!==oldId)).room;assert.deepEqual(v.players[0]?.lobbyChoice,{pick:'red'});
    choose(resumed,'blue',oldId);assert.match((await resumed.take('error')).reason,/no longer available/);
    choose(r.phones[1],'blue');await r.host.take('room.state',p=>p.room.players[1]?.lobbyChoice?.pick==='blue');
    for(const p of r.phones)p.send('room.ready',{ready:true,lobbyId:v.lobbyId});await r.host.take('room.state',p=>p.room.players.length===2&&p.room.players.every((p:any)=>p.ready));
    r.host.send('round.start');const prep=await r.host.take('round.prepare');for(const p of [r.host,...r.phones])p.send('round.ready',{roundId:prep.roundId});await r.host.take('game.snapshot',p=>p.roundId===prep.roundId);assert.deepEqual(created,[{pick:'red'},{pick:'blue'}]);
    choose(resumed,'blue');assert.match((await resumed.take('error')).reason,/no longer available/);
    for(const [i,p] of r.phones.entries()){p.send('game.action',{roundId:prep.roundId,actionId:String(i),payload:{turnId:'turn-1'}});assert.equal((await p.take('action.ack')).accepted,true);}await r.host.take('round.results');
    let revision=h.party.roomView().revision;r.host.send('game.select',{gameId:'lobby-game'});await r.host.take('room.state',p=>p.room.revision>revision&&p.room.phase==='lobby'&&p.room.roundId===null);assert.ok(h.party.roomView().players.every(p=>p.lobbyChoice===undefined&&!p.ready));
    revision=h.party.roomView().revision;r.host.send('game.select',{gameId:'other'});await r.host.take('room.state',p=>p.room.revision>revision&&p.room.gameId==='other');assert.equal(h.party.roomView().lobbyId,undefined);
    revision=h.party.roomView().revision;r.host.send('game.select',{gameId:'lobby-game'});await r.host.take('room.state',p=>p.room.revision>revision&&p.room.gameId==='lobby-game');assert.ok(h.party.roomView().players.every(p=>p.lobbyChoice===undefined));
  }finally{await h.close();}
});
