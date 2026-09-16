import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import WebSocket from 'ws';
import QRCode from 'qrcode';
import { createRoomHub } from '../apps/party-server/src/room-hub';
import { games } from '../apps/party-server/src/registry';
import { createPartyServer } from '../packages/games/kart-party/src/standalone-server/party-server';

test('collection and Kart sockets coexist on one server; Kart QR uses its mounted route', async () => {
  const server = createServer((req,res) => { void kart.handleRequest(req,res); });
  const kart = createPartyServer({port:0,mount:{server,basePath:'/kart-party'},networkInterfacesProvider:()=>({en0:[{address:'192.168.1.12',netmask:'255.255.255.0',family:'IPv4',mac:'00:00:00:00:00:00',internal:false,cidr:'192.168.1.12/24'}]})});
  const party = createRoomHub(server,games), sockets:WebSocket[]=[];
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const port=(server.address() as {port:number}).port;
  const request=async(path:string,message:unknown,type:string)=>{
    const socket=new WebSocket(`ws://127.0.0.1:${port}${path}`);sockets.push(socket);
    await once(socket,'open');
    const response=new Promise<any>((resolve,reject)=>{socket.on('message',data=>{const v=JSON.parse(String(data));if(v.type==='error')reject(Error(JSON.stringify(v)));else if(v.type===type)resolve(v);});socket.once('error',reject);});
    socket.send(JSON.stringify(message));return response;
  };
  try {
    const [collection,race]=await Promise.all([request('/ws',{v:'1.0',type:'room.create'},'room.welcome'),request('/kart-party/party',{type:'create',name:'Race host',play:false},'welcome')]);
    assert.equal(collection.room.phase,'picker');assert.equal(race.role,'host');assert.equal(race.room.hostPlays,false);
    const api=await (await fetch(`http://127.0.0.1:${port}/kart-party/api/party`)).json();assert.equal(api.preferredUrl,`http://192.168.1.12:${port}`);
    const qr=await (await fetch(`http://127.0.0.1:${port}/kart-party/api/party/qr.svg?join=ABC234`)).text();assert.equal(qr,await QRCode.toString(`http://192.168.1.12:${port}/kart-party/?join=ABC234`,{type:'svg'}));
    await kart.close();assert.equal(server.listening,true);
    assert.equal(sockets[0].readyState,WebSocket.OPEN);
  } finally {for(const socket of sockets)socket.terminate();await Promise.all([party.close(),kart.close()]);await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('hosted Kart invitations use the configured HTTPS origin instead of LAN addresses', async () => {
  const server = createServer((req, res) => { void kart.handleRequest(req, res); });
  const kart = createPartyServer({ port: 0, publicOrigin: 'https://play.example', mount: { server, basePath: '/kart-party' } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/kart-party/api/party`;
  try {
    const rejected = new WebSocket(url.replace('http:', 'ws:').replace('/api/party', '/party'), { origin: 'https://unrelated.example' });
    await assert.rejects(once(rejected, 'open'), /403/);
    const addresses = await (await fetch(url)).json(); assert.deepEqual(addresses.urls, ['https://play.example']);
    const qr = await (await fetch(url + '/qr.svg?join=ABC234')).text();
    assert.equal(qr, await QRCode.toString('https://play.example/kart-party/?join=ABC234', { type: 'svg' }));
  } finally { await kart.close(); await new Promise<void>(done => server.close(() => done())); }
});
