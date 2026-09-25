import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { createRoomServer, validateManifest, assertSerializable } from '../apps/party-server/src/room-server';
import { games } from '../apps/party-server/src/registry';
import { rules as kart } from '../packages/games/kart-party/src/server';
import { botInput } from '../packages/games/kart-party/src/sim/ai';
import { TRACK_IDS } from '../packages/games/kart-party/src/tracks/index';
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));
class Peer {
  packets: any[] = [];
  constructor(public socket: WebSocket) { socket.on('message', raw => this.packets.push(JSON.parse(raw.toString()))); socket.on('error', () => {}); }
  send(type: string, data = {}) { this.socket.send(JSON.stringify({ v: '1.0', type, ...data })); }
  async take(type: string, predicate: (p: any) => boolean = () => true) { for (let i = 0; i < 400; i++) { const at = this.packets.findIndex(p => p.type === type && predicate(p)); if (at >= 0) return this.packets.splice(at,1)[0]; await delay(5); } throw Error(`No ${type}: ${JSON.stringify(this.packets.filter(p => p.type === 'error'))}`); }
}
test('one host plays all three solo games, reconnects and changes to Kart with the same room and seat', async () => {
  const server = createServer(), room = createRoomServer(server, games, { startDelayMs: 5, tickMs: 5 });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const connect = async () => { const socket = new WebSocket(`ws://127.0.0.1:${(server.address() as {port:number}).port}/ws`), peer = new Peer(socket); await new Promise<void>(done => socket.once('open', done)); return peer; };
  try {
    let host = await connect(); host.send('room.create'); const original = await host.take('room.welcome');
    for (const id of ['blockwild','kitchen-rush','kart-party','blockwild']) {
      host.send('game.select', { gameId:id, play:true }); const welcome = await host.take('room.welcome', p => p.room.gameId === id);
      assert.equal(welcome.room.code, original.room.code); assert.equal(welcome.room.id, original.room.id); assert.equal(welcome.playerId, original.clientId); assert.equal(welcome.token, original.token);
      assert.equal(welcome.room.players.length,1);
      if (welcome.room.lobbyId) { host.send('room.ready', { ready:true, lobbyId:welcome.room.lobbyId }); await host.take('room.state', p => p.room.players[0].ready); } else assert(welcome.room.players[0].ready);
      host.send('round.start'); const preparation = await host.take('round.prepare'); host.send('round.ready', {roundId:preparation.roundId});
      const snap = await host.take('game.snapshot', p => p.roundId === preparation.roundId);
      assert.equal((snap.publicView.players ?? snap.publicView.racers.filter((p:any) => !p.bot)).length,1);
      host.send('input.state', {roundId:preparation.roundId,seq:1,payload:id === 'kart-party' ? {steer:1} : {x:1,y:0}});
      if (id === 'blockwild') { host.send('round.finish', {roundId:preparation.roundId}); await host.take('room.state', p => p.room.phase === 'results'); }
      else { host.send('round.abort', {roundId:preparation.roundId}); await host.take('room.state', p => p.room.phase === 'lobby'); }
      const next = await connect(); next.send('room.rejoin', {code:original.room.code,token:original.token}); const resumed = await next.take('room.welcome'); assert.equal(resumed.playerId,original.clientId); host = next;
    }
    host.send('game.select', {gameId:'quip-clash'}); const party = await host.take('room.welcome', p => p.room.gameId === 'quip-clash'); assert.equal(party.playerId,null); assert.equal(party.room.code,original.room.code);
    host.send('room.play', {play:true}); await host.take('error'); assert.equal(room.roomView().players.length,0);
  } finally { await room.close(); await new Promise<void>(done => server.close(() => done())); }
});
test('ten phone seats survive Kitchen → Kart → Kitchen; a host cannot take an eleventh seat', async () => {
  const server = createServer(), room = createRoomServer(server,games,{startDelayMs:5,tickMs:5});
  await new Promise<void>(done => server.listen(0,'127.0.0.1',done));
  const connect = async () => { const ws = new WebSocket(`ws://127.0.0.1:${(server.address() as {port:number}).port}/ws`), peer = new Peer(ws); await new Promise<void>(done => ws.once('open',done)); return peer; };
  try {
    const host = await connect(); host.send('room.create'); const original = await host.take('room.welcome'), phones:Peer[] = [], ids:string[] = [];
    for (let i=0;i<10;i++) { const phone = await connect(); phone.send('room.join',{code:original.room.code,name:`Player ${i}`}); ids.push((await phone.take('room.welcome')).playerId); phones.push(phone); }
    for (const id of ['kitchen-rush','kart-party','kitchen-rush']) {
      host.send('game.select',{gameId:id}); const selected = await host.take('room.welcome',p => p.room.gameId === id); assert.equal(selected.room.code,original.room.code); assert.deepEqual(selected.room.players.map((p:any) => p.id),ids);
      host.send('room.play',{play:true}); await host.take('error'); assert.equal(room.roomView().players.length,10);
      phones[0].send('room.play',{play:false}); await phones[0].take('error');
      for (const phone of phones) phone.send('room.ready',{ready:true,lobbyId:selected.room.lobbyId}); await host.take('room.state',p => p.room.gameId === id && p.room.players.every((x:any) => x.ready));
      host.send('round.start'); const preparation = await host.take('round.prepare'); for (const peer of [host,...phones]) peer.send('round.ready',{roundId:preparation.roundId});
      const snap = await host.take('game.snapshot',p => p.roundId === preparation.roundId); assert.equal((snap.publicView.players ?? snap.publicView.racers).length,10);
      host.send('round.abort',{roundId:preparation.roundId}); await host.take('room.state',p => p.room.phase === 'lobby');
    }
  } finally { await room.close(); await new Promise<void>(done => server.close(() => done())); }
});
for (const count of [1,10]) for (const track of TRACK_IDS) test(`Kart adapter: ${count} players finish ${track} and replay`, () => {
  const settings = kart.validateSettings({track,laps:1,speedClass:200}), ctx = {roomId:'room',roundId:'race',nowMs:1000,seed:892,players:Array.from({length:count},(_,i) => ({id:`p${i}`,name:`Player${i}`,color:'#fff'}))};
  const race = kart.create(ctx,settings);
  for (let i=0;i<37000 && race.phase !== 'results';i++) kart.tick(race,new Map(race.racers.filter(p => !p.bot).map(p => [p.id,botInput(race,p)])),1/60,ctx.nowMs+i*1000/60);
  assert(kart.outcome(race).complete); assert.equal(kart.outcome(race).rows.length,count); assert(race.racers.some(p => !p.bot && p.finishTime !== null));
  const view = kart.publicView(race,{nowMs:1000000,phase:'results'}); assertSerializable(view); assert.equal(view.players.length,count);
  const replay = kart.create({...ctx,roundId:'again'},settings); assert.equal(replay.phase,'countdown'); assert(replay.racers.every(p => p.finishTime === null));
});
test('solo manifests require a one-player minimum', () => {
  const manifest = games.find(g => g.manifest.id === 'kitchen-rush')!.manifest;
  validateManifest(manifest); assert.throws(() => validateManifest({...manifest,players:{min:2,max:10}}));
});

test('a phone named like the seated host never takes over the host seat or its authority', async () => {
  const server = createServer(), room = createRoomServer(server, games, { startDelayMs: 5, tickMs: 5 });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const connect = async () => { const socket = new WebSocket(`ws://127.0.0.1:${(server.address() as {port:number}).port}/ws`), peer = new Peer(socket); await new Promise<void>(done => socket.once('open', done)); return peer; };
  try {
    const host = await connect(); host.send('room.create'); const original = await host.take('room.welcome');
    host.send('game.select', { gameId: 'blockwild', play: true }); await host.take('room.welcome', p => p.room.gameId === 'blockwild');
    host.socket.close(); await delay(30);
    const phone = await connect(); phone.send('room.join', { code: original.room.code, role: 'controller', name: 'host' });
    const welcome = await phone.take('room.welcome');
    assert.notEqual(welcome.clientId, original.clientId); assert.notEqual(welcome.room.hostId, welcome.clientId);
    assert.equal(room.roomView().players.length, 2);
  } finally { await room.close(); await new Promise<void>(done => server.close(() => done())); }
});
