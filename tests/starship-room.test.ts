/** The real room server: phones join, launch, vote and jump over WebSockets; the host saves mid-run and loads it back for new seats. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { MAX_MESSAGE_BYTES } from '../packages/party-contract/src/index';
import { games } from '../apps/party-server/src/registry';
import { createRoomServer } from '../apps/party-server/src/room-server';
import type { PublicView } from '../packages/games/starship-scramble/src/contracts';

type Packet = Record<string, any>;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
class Peer {
  packets: Packet[] = []; seq = 0; biggest = 0;
  constructor(public socket: WebSocket) { socket.on('message', data => { this.biggest = Math.max(this.biggest, data.toString().length); this.packets.push(JSON.parse(data.toString())); }); socket.on('error', () => {}); }
  send(type: string, payload: Record<string, unknown> = {}) { this.socket.send(JSON.stringify({ v: '1.0', type, ...payload })); }
  async take(type: string, predicate: (packet: Packet) => boolean = () => true): Promise<Packet> {
    for (let attempt = 0; attempt < 800; attempt++) {
      const index = this.packets.findIndex(packet => packet.type === type && predicate(packet));
      if (index >= 0) return this.packets.splice(index, 1)[0];
      await delay(5);
    }
    throw Error(`Timed out waiting for ${type}: ${JSON.stringify(this.packets.filter(packet => packet.type === 'error'))}`);
  }
  async act(roundId: string, payload: Record<string, unknown>) {
    const actionId = String(++this.seq);
    this.send('game.action', { roundId, actionId, retireThrough: this.seq - 1, payload });
    return this.take('action.ack', packet => packet.actionId === actionId);
  }
}

test('Starship Scramble real room: two phones launch, vote, jump, save and reload into new seats', async () => {
  let now = 1000;
  const server = createServer(), room = createRoomServer(server, games.filter(game => game.manifest.id === 'starship-scramble'), { now: () => now, tickMs: 5, startDelayMs: 0, prepareTimeoutMs: 20000 });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const connect = async () => { const peer = new Peer(new WebSocket(`ws://127.0.0.1:${address.port}/ws`)); await new Promise<void>(resolve => peer.socket.once('open', resolve)); return peer; };
  try {
    const host = await connect(); host.send('room.create');
    const created = await host.take('room.welcome');
    host.send('game.select', { gameId: 'starship-scramble', play: false });
    const lobby = (await host.take('room.state', packet => packet.room.gameId === 'starship-scramble' && packet.room.phase === 'lobby')).room;
    const phones = [await connect(), await connect()];
    for (const [i, phone] of phones.entries()) { phone.send('room.join', { code: created.room.code, name: ['Mira', 'Oskar'][i] }); await phone.take('room.welcome'); phone.send('room.ready', { ready: true, lobbyId: lobby.lobbyId }); }
    await host.take('room.state', packet => packet.room.players.length === 2 && packet.room.players.every((p: any) => p.ready));
    const begin = async () => {
      const preparing = await host.take('round.prepare');
      for (const peer of [host, ...phones]) peer.send('round.ready', { roundId: preparing.roundId });
      return (await host.take('game.snapshot', packet => packet.roundId === preparing.roundId)).roundId as string;
    };
    host.send('round.start');
    const roundId = await begin();
    const view = async (predicate: (v: PublicView) => boolean) => {
      for (let i = 0; i < 400; i++) { now += 100; const packet = await host.take('game.snapshot', p => p.roundId === roundId && p.serverTime === now); if (predicate(packet.publicView)) return packet.publicView as PublicView; }
      throw Error('view never matched');
    };
    let v = await view(() => true);
    assert.equal(v.phase, 'hangar');
    const turn = () => v.turn;
    assert.equal((await phones[0].act(roundId, { type: 'hangar', hullId: 'corsair', name: 'Ember Queen', paint: '#b58aff', turn: turn() })).accepted, true);
    assert.equal((await phones[1].act(roundId, { type: 'ready', ready: true, turn: turn() })).reason, 'Pick a hull first.');
    assert.equal((await phones[1].act(roundId, { type: 'hangar', hullId: 'halcyon', name: '', paint: '#ffd24a', turn: turn() })).accepted, true);
    for (const phone of phones) assert.equal((await phone.act(roundId, { type: 'ready', ready: true, turn: turn() })).accepted, true);
    v = await view(x => x.phase === 'map');
    assert.deepEqual(v.ships.map(s => s.name), ['Ember Queen', "Oskar's Halcyon"]);
    assert.equal((await phones[0].act(roundId, { type: 'vote', nodeId: v.map.currentId, turn: v.turn - 1 })).reason, 'That moment has passed.');
    const link = v.map.nodes.find(n => n.id === v.map.currentId)!.links[0];
    for (const phone of phones) assert.equal((await phone.act(roundId, { type: 'vote', nodeId: link, turn: v.turn })).accepted, true);
    v = await view(x => x.phase !== 'map' || x.map.currentId === link);
    assert.equal(v.map.currentId, link); assert.equal(v.fleetStats.jumps, 1);
    const save = JSON.parse(room.exportSave(created.token, roundId));
    assert.equal(save.v, 1);
    // Reload the world: the same two phones take the saved seats in roster order.
    const loaded = room.loadSave(created.token, roundId, save);
    void loaded;
    const reloaded = await begin(), restored = (await host.take('game.snapshot', p => p.roundId === reloaded)).publicView as PublicView;
    assert.notEqual(reloaded, roundId);
    assert.equal(restored.map.currentId, link); assert.deepEqual(restored.ships.map(s => s.name), ['Ember Queen', "Oskar's Halcyon"]);
    assert.deepEqual(restored.captains.map(c => c.connected), [true, true]);
    assert(Math.max(host.biggest, ...phones.map(p => p.biggest)) < MAX_MESSAGE_BYTES);
  } finally { await room.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
