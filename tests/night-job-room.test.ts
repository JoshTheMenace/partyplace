import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { WebSocket } from 'ws';
import { games } from '../apps/party-server/src/registry';
import { createRoomServer } from '../apps/party-server/src/room-server';
import type { Choice, View } from '../packages/games/night-job/src/model';
import { decode, ownView, type Wire } from '../packages/games/night-job/src/wire';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Packet = Record<string, any>;
class Peer {
  packets: Packet[] = [];
  constructor(public socket: WebSocket) { socket.on('message', data => this.packets.push(JSON.parse(data.toString()))); socket.on('error', () => {}); }
  send(type: string, payload: Record<string, unknown> = {}) { this.socket.send(JSON.stringify({ v: '1.0', type, ...payload })); }
  async take(type: string, predicate: (packet: Packet) => boolean = () => true): Promise<Packet> {
    for (let attempt = 0; attempt < 600; attempt++) {
      const index = this.packets.findIndex(packet => packet.type === type && predicate(packet));
      if (index >= 0) return this.packets.splice(index, 1)[0];
      await delay(5);
    }
    throw Error(`Timed out waiting for ${type}: ${JSON.stringify(this.packets.filter(packet => packet.type === 'error'))}`);
  }
  async flush() { this.send('clock.ping', { clientTime: 42 }); await this.take('clock.pong', packet => packet.clientTime === 42); }
}

for (const count of [1, 4]) test(`Night Job real room: ${count} phones and a dedicated display choose, prepare, move, release, reconnect and restart cleanly`, async () => {
  let now = 1000;
  const server = createServer(), room = createRoomServer(server, games.filter(game => ['night-job', 'kitchen-rush'].includes(game.manifest.id)), { now: () => now, tickMs: 5, startDelayMs: 0, prepareTimeoutMs: 20000 });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const connect = async () => {
    const peer = new Peer(new WebSocket(`ws://127.0.0.1:${address.port}/ws`));
    await new Promise<void>(resolve => peer.socket.once('open', resolve));
    return peer;
  };
  try {
    const host = await connect(); host.send('room.create');
    const created = await host.take('room.welcome'), seats: Peer[] = [], credentials: Packet[] = [];
    const select = async (gameId: string) => {
      const before = room.roomView().revision;
      host.send('game.select', { gameId, play: gameId === 'night-job' });
      const welcome = await host.take('room.welcome', packet => packet.room.revision > before && packet.room.gameId === gameId);
      assert.equal(welcome.playerId, null, 'the host must remain a dedicated display');
      return (await host.take('room.state', packet => packet.room.revision > before && packet.room.gameId === gameId && packet.room.phase === 'lobby')).room;
    };
    let lobby = await select('night-job');
    assert.equal(created.playerId, null);
    host.send('room.play', { play: true });
    assert.match((await host.take('error')).reason, /solo-capable game/);
    for (let index = 0; index < count; index++) {
      const phone = await connect(); phone.send('room.join', { code: created.room.code, name: `Thief0000000000${index}` });
      seats.push(phone); credentials.push(await phone.take('room.welcome'));
    }
    const ids = credentials.map(packet => packet.playerId), roles: Choice['role'][] = ['cracker', 'scout', 'magpie', 'ghost'];
    const prepare = async (nightJob: boolean) => {
      for (const [index, seat] of seats.entries()) {
        if (nightJob) seat.send('lobby.choice', { lobbyId: lobby.lobbyId, payload: { role: roles[index], tool: 'smoke' } });
        seat.send('room.ready', { ready: true, lobbyId: lobby.lobbyId });
      }
      await host.take('room.state', packet => packet.room.lobbyId === lobby.lobbyId && packet.room.players.length === count && packet.room.players.every((player: any) => player.ready));
      host.send('round.start'); const preparing = await host.take('round.prepare');
      const screens = [host, ...seats];
      // The display's scene and each phone's DOM readiness use the same round.ready barrier.
      for (const peer of screens.slice(0, -1)) peer.send('round.ready', { roundId: preparing.roundId });
      await Promise.all(screens.map(peer => peer.flush()));
      assert.equal(room.roomView().phase, 'preparing');
      screens.at(-1)!.send('round.ready', { roundId: preparing.roundId });
      return host.take('game.snapshot', packet => packet.roundId === preparing.roundId);
    };
    // What the TV draws from a snapshot: the public view, unpacked as the browser does. The roster rides only on a socket's first snapshot
    // (manifest snapshotCache), so later ones borrow it.
    let base: Wire['base'] | undefined;
    const shown = (packet: Packet) => { base ??= packet.publicView.base; return decode({ final: null, ...packet.publicView, base }).cast; };
    const first = await prepare(true), roundId = first.roundId, initial = shown(first);
    assert.deepEqual(initial.players.map(player => player.id), ids);
    assert.deepEqual(initial.players.map(player => player.role), roles.slice(0, count));
    assert.equal(initial.phase, 'infiltrate'); assert.equal(first.privateView, null, 'the display has no private view');
    const advance = async () => { now += 100; return shown(await host.take('game.snapshot', packet => packet.roundId === roundId && packet.serverTime === now)); };
    const player = (view: View) => view.players.find(value => value.id === ids[0])!;
    seats[0].send('input.state', { roundId, seq: 1, payload: { x: 1, y: 0, sneak: false } }); await seats[0].flush();
    const moved = await advance(); assert(player(moved).x > player(initial).x, 'held input must move the authoritative player');
    seats[0].send('input.release', { roundId, seq: 2 });
    seats[0].send('input.state', { roundId, seq: 1, payload: { x: 1, y: 0, sneak: false } }); await seats[0].flush();
    const stopped = await advance(); assert.equal(player(stopped).x, player(moved).x, 'release must stop movement and reject older input');
    const action = { roundId, actionId: 'smoke-once', payload: { type: 'tool', heistId: initial.heistId } };
    seats[0].send('game.action', action); assert.equal((await seats[0].take('action.ack', packet => packet.actionId === action.actionId)).accepted, true);
    seats[0].send('game.action', action); assert.equal((await seats[0].take('action.ack', packet => packet.actionId === action.actionId)).accepted, true);
    const smoked = await advance(); assert.equal(player(smoked).charges, player(initial).charges - 1); assert.equal(smoked.smoke.length, 1);
    seats[0].send('game.action', { roundId, actionId: 'old-heist', payload: { type: 'tool', heistId: 'obsolete-heist' } });
    assert.equal((await seats[0].take('action.ack', packet => packet.actionId === 'old-heist')).accepted, false);
    seats[0].send('input.state', { roundId, seq: 3, payload: { x: 1, y: 0, sneak: false } }); await seats[0].flush();
    const replacement = await connect(); replacement.send('room.rejoin', { code: created.room.code, token: credentials[0].token });
    const resumed = await replacement.take('room.welcome');
    assert.equal(resumed.playerId, ids[0]); assert.equal(resumed.room.players.length, count);
    assert.deepEqual(resumed.room.players.find((value: any) => value.id === ids[0]).lobbyChoice, { role: 'cracker', tool: 'smoke' });
    seats[0] = replacement;
    const rejoined = await replacement.take('game.snapshot', packet => packet.roundId === roundId), retained = shown(rejoined);
    assert.ok(rejoined.publicView.base, 'a rejoining socket is sent the roster again');
    assert.deepEqual(Object.keys(rejoined.privateView), ['hint', 'live']); assert.equal(rejoined.privateView.live, null, 'one crew: the shared screen already carries it');
    assert.equal(ownView({ final: null, ...rejoined.publicView }, rejoined.privateView, ids[0])!.players.find(value => value.id === ids[0])!.hint, rejoined.privateView.hint);
    assert.equal(player(retained).role, 'cracker'); assert.equal(player(retained).charges, player(smoked).charges);
    const reconnected = await advance(); assert.equal(player(reconnected).x, player(retained).x, 'reconnect must cancel held input');
    const abort = async (id: string) => {
      const revision = room.roomView().revision; host.send('round.abort', { roundId: id });
      return (await host.take('room.state', packet => packet.room.revision > revision && packet.room.phase === 'lobby' && packet.room.roundId === null)).room;
    };
    await abort(roundId);
    lobby = await select('kitchen-rush'); assert.deepEqual(lobby.players.map((value: any) => value.id), ids);
    const middle = await prepare(false); assert.notEqual(middle.roundId, roundId); await abort(middle.roundId);
    lobby = await select('night-job');
    assert(lobby.players.every((value: any) => !value.ready && value.lobbyChoice === undefined));
    base = undefined; const replay = await prepare(true), fresh = shown(replay);
    assert.notEqual(replay.roundId, roundId); assert.notEqual(fresh.heistId, initial.heistId);
    assert.deepEqual(fresh.players.map(value => value.id), ids); assert.equal(player(fresh).charges, player(initial).charges);
    assert.equal(fresh.collected, 0); assert.equal(fresh.objectiveTaken, false); assert.deepEqual(fresh.smoke, []);
    assert.equal(room.roomView().code, created.room.code); assert.equal(room.roomView().id, created.room.id);
    seats[0].send('game.action', { ...action, actionId: 'old-round' });
    const stale = await seats[0].take('action.ack', packet => packet.actionId === 'old-round');
    assert.equal(stale.accepted, false); assert.match(stale.reason, /old round/);
  } finally { await room.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('Night Job real room: nine phones play a crew night; each socket gets its own crew, the crew on the TV, and the roster once', async () => {
  let now = 1000;
  const server = createServer(), room = createRoomServer(server, games.filter(game => game.manifest.id === 'night-job'), { now: () => now, tickMs: 5, startDelayMs: 0, prepareTimeoutMs: 20000 });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const connect = async () => { const peer = new Peer(new WebSocket(`ws://127.0.0.1:${address.port}/ws`)); await new Promise<void>(resolve => peer.socket.once('open', resolve)); return peer; };
  try {
    const host = await connect(); host.send('room.create'); const created = await host.take('room.welcome');
    host.send('game.select', { gameId: 'night-job', play: true });
    const lobby = (await host.take('room.state', packet => packet.room.gameId === 'night-job' && packet.room.phase === 'lobby')).room, seats: Peer[] = [], ids: string[] = [];
    for (let index = 0; index < 9; index++) { const phone = await connect(); phone.send('room.join', { code: created.room.code, name: `Crewmate${index}` }); seats.push(phone); ids.push((await phone.take('room.welcome')).playerId); }
    for (const seat of seats) seat.send('room.ready', { ready: true, lobbyId: lobby.lobbyId });
    await host.take('room.state', packet => packet.room.players.length === 9 && packet.room.players.every((player: any) => player.ready));
    host.send('round.start'); const preparing = await host.take('round.prepare');
    for (const peer of [host, ...seats]) peer.send('round.ready', { roundId: preparing.roundId });
    const roundId = preparing.roundId, firsts = await Promise.all([host, ...seats].map(peer => peer.take('game.snapshot', packet => packet.roundId === roundId)));
    const wire = firsts[0].publicView as Wire, night = decode(wire);
    assert.deepEqual(night.crews, [[0, 1, 2], [3, 4, 5], [6, 7, 8]]); assert.equal(night.rival, true); assert.equal(wire.cast, 0); assert.equal(firsts[0].privateView, null);
    assert.deepEqual(wire.base.roster.map(entry => entry[0]), ids); assert.ok(wire.ends > wire.now, 'a crew night has a sunrise');
    firsts.slice(1).forEach((packet, seat) => {
      const crew = Math.floor(seat / 3), view = ownView(packet.publicView, packet.privateView, ids[seat])!;
      assert.ok(packet.publicView.base, 'every socket is sent the roster with its first snapshot');
      assert.equal(packet.privateView.live === null, crew === 0, 'the crew on the TV is not sent twice');
      assert.equal(view.crew, crew); assert.deepEqual(view.players.map(player => player.id), ids.slice(crew * 3, crew * 3 + 3)); assert.deepEqual(view.players.map(player => player.seat), [0, 1, 2].map(i => crew * 3 + i));
      assert.equal(view.heistId, `${roundId}:${crew}`);
    });
    // A thief in the third crew moves and uses its tool: only its own heist changes, and the next snapshots omit the roster.
    seats[7].send('input.state', { roundId, seq: 1, payload: { x: 1, y: 0, sneak: false } }); await seats[7].flush();
    seats[7].send('game.action', { roundId, actionId: 'wrong-crew', payload: { type: 'tool', heistId: `${roundId}:0` } });
    assert.equal((await seats[7].take('action.ack', packet => packet.actionId === 'wrong-crew')).accepted, false);
    seats[7].send('game.action', { roundId, actionId: 'own-crew', payload: { type: 'tool', heistId: `${roundId}:2` } });
    assert.equal((await seats[7].take('action.ack', packet => packet.actionId === 'own-crew')).accepted, true);
    now += 100;
    const [third, first] = await Promise.all([seats[7], seats[0]].map(peer => peer.take('game.snapshot', packet => packet.roundId === roundId && packet.serverTime === now)));
    assert.equal(third.publicView.base, undefined, 'the roster rides once per socket');
    const moved = ownView({ ...third.publicView, base: wire.base, final: null }, third.privateView, ids[7])!, still = ownView({ ...first.publicView, base: wire.base, final: null }, first.privateView, ids[0])!;
    assert.ok(moved.players[1].x > still.players[1].x, 'held input moved the right thief'); assert.equal(moved.smoke.length, 1); assert.equal(moved.players[1].charges, 1);
    assert.equal(still.smoke.length, 0); assert.ok(still.players.every(player => player.charges === 2));
    assert.equal(JSON.stringify(first).includes(String(moved.players[1].x)), false, 'the first crew is sent nothing of the third crew\'s positions');
  } finally { await room.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
