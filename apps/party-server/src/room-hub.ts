import { randomInt, randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { resolve } from 'node:path';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { CONTRACT_VERSION, MAX_MESSAGE_BYTES } from '../../../packages/party-contract/src/index';
import { assertSerializable, createRoomServer, MAX_ROOM_SOCKETS, type RegisteredGame } from './room-server';
import { createRecoveryStore } from './recovery-store';

type Room = ReturnType<typeof createRoomServer>;
/**
 * Hub bounds for one public Node process.
 * Rooms: 32, unchanged. An idle room is one timer and a few maps.
 * Connections: every room at the regularly tested size (32 rooms x 32 sockets). One room can hold at most MAX_ROOM_SOCKETS of
 * them, so about thirteen rooms fit at the 64-seat ceiling. Each socket may buffer up to 2 MiB before it is closed.
 * Upgrades per address per minute: one address is often a whole venue behind NAT, or everyone behind a tunnel or proxy.
 * A full room that joins and then reconnects once is MAX_ROOM_SOCKETS upgrades; allow that twice.
 */
export const MAX_HUB_ROOMS = 32, MAX_HUB_CONNECTIONS = 32 * 32, MAX_ADDRESS_UPGRADES_PER_MINUTE = 2 * MAX_ROOM_SOCKETS;
type Options = { saveRoot?: string; maxRooms?: number; maxConnections?: number; maxAddressUpgrades?: number; sweepMs?: number; roomOptions?: Parameters<typeof createRoomServer>[2] };

// Route the existing handshake so every game and client keeps its room protocol.
export function createRoomHub(server: Server, games: RegisteredGame[], options: Options = {}) {
  const rooms = new Map<string, Room>();
  const limits = new Map<string, { at: number; count: number }>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const retiring = new Set<Promise<void>>();
  const retire = (code: string, room: Room) => {
    rooms.delete(code);
    const pending = room.close().finally(() => retiring.delete(pending));
    retiring.add(pending);
  };
  const sweep = () => {
    for (const [code, room] of rooms) if (!room.roomView().id) retire(code, room);
    for (const [ip, limit] of limits) if (Date.now() - limit.at > 60000) limits.delete(ip);
  };
  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (request.url?.split('?')[0] !== '/ws') return;
    try { if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw Error(); }
    catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    const ip = request.socket.remoteAddress ?? 'unknown', now = Date.now();
    const limit = limits.get(ip);
    if (!limit || now - limit.at > 60000) limits.set(ip, { at: now, count: 1 });
    else limit.count++;
    if ((limits.get(ip)?.count ?? 0) > (options.maxAddressUpgrades ?? MAX_ADDRESS_UPGRADES_PER_MINUTE) || wss.clients.size >= (options.maxConnections ?? MAX_HUB_CONNECTIONS)) {
      socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return;
    }
    wss.handleUpgrade(request, socket, head, peer => wss.emit('connection', peer, request));
  };
  server.on('upgrade', upgrade);
  wss.on('connection', (socket, request) => {
    socket.on('error', () => {});
    const timeout = setTimeout(() => socket.close(1008, 'Create or join a room first'), 15000);
    socket.once('close', () => clearTimeout(timeout));
    let messages = 0;
    const send = (type: string, data: Record<string, unknown>) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ v: CONTRACT_VERSION, type, ...data })); };
    const route = (raw: RawData, binary: boolean) => {
      let type: unknown;
      try {
        if (++messages > 40) { socket.close(1008, 'Too many join attempts'); return; }
        if (binary) throw Error('Use JSON messages.');
        const message = JSON.parse(raw.toString()); assertSerializable(message);
        if (!message || typeof message !== 'object' || Array.isArray(message)) throw Error('Expected a message.');
        type = message.type;
        if (message.v !== CONTRACT_VERSION) throw Error('Refresh this browser to use the current collection.');
        if (type === 'clock.ping' && Number.isFinite(message.clientTime)) { send('clock.pong', { clientTime: message.clientTime, serverTime: Date.now() }); return; }
        let room: Room | undefined;
        if (type === 'room.create') {
          sweep();
          if (rooms.size >= (options.maxRooms ?? MAX_HUB_ROOMS)) throw Error('All game rooms are busy. Try again in a few minutes.');
          let code: string;
          do { code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(31)]).join(''); } while (rooms.has(code));
          room = createRoomServer(server, games, { ...options.roomOptions, managed: true, code,
            ...(options.saveRoot ? { recoveryStore: createRecoveryStore(resolve(options.saveRoot, randomUUID())) } : {}) });
          rooms.set(code, room);
        } else if (type === 'room.join' || type === 'room.rejoin') {
          room = typeof message.code === 'string' ? rooms.get(message.code) : undefined;
          if (!room?.roomView().id) throw Error(type === 'room.rejoin' ? 'Saved seat expired. Join a new room.' : 'Room code not found. Check the six characters.');
        } else throw Error('Create or join a room first.');
        clearTimeout(timeout); socket.off('message', route);
        room.wss.emit('connection', socket, request);
        socket.emit('message', raw, binary);
      } catch (error) { send('error', { code: type === 'room.rejoin' ? 'REJOIN' : 'REQUEST', reason: error instanceof Error ? error.message : 'Invalid request.' }); }
    };
    socket.on('message', route);
  });
  const timer = setInterval(sweep, options.sweepMs ?? 5000);
  return {
    roomForCode: (code: unknown) => typeof code === 'string' ? rooms.get(code) : undefined,
    roomCount: () => rooms.size,
    close: async () => {
      clearInterval(timer); server.off('upgrade', upgrade);
      for (const [code, room] of rooms) retire(code, room);
      for (const socket of wss.clients) socket.terminate();
      await Promise.all(retiring);
      await new Promise<void>(done => wss.close(() => done()));
    },
  };
}
