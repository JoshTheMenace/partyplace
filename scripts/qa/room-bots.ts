/**
 * Socket bots that fill a PartyPlay room. N synthetic phones with 16-character names join a room code, tap Ready, answer the
 * preparation barrier and stay connected; a dropped socket rejoins its seat. Node only, never imported by the client.
 *
 *   node --import tsx scripts/qa/room-bots.ts --port 4400 --code ABCDEF --players 32
 *     [--host localhost] [--offset 0] [--no-ready] [--hz 20] [--input '{"x":1,"y":0}'] [--hook path/to/hook.ts] [--stats 5] [--minutes 30]
 *
 * --offset N starts at the Nth name, so a second run can add seats to a room an earlier run already filled.
 * --input is a constant held input sent --hz times a second while the bot's round is playing.
 * --hook is a module whose default export is a BotHook (below): lobby picks for games with parseLobbyChoice, per-frame held
 * input, and actions sent in response to snapshots. --stats prints the roster and traffic every N seconds.
 * From a test or a game QA driver: `import { joinBots } from '<root>/scripts/qa/room-bots'`.
 */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { WebSocket } from 'ws';
import type { ActionResult, GameManifest } from '../../packages/party-contract/src/index';
import type { RoomView, Snapshot } from '../../packages/party-contract/src/protocol';
import { SnapshotDecoder } from '../../packages/party-contract/src/snapshot-cache';

export type Bot = {
  readonly index: number; readonly name: string; playerId: string; connected: boolean; room: RoomView | null;
  /** Latest decoded snapshot of the current round (game.snapshot or round.results). */
  snapshot: Snapshot | null;
  bytes: number; snapshots: number; errors: string[];
  /** Reliable game action. Resolves with the server's acknowledgement. */
  act(payload: unknown): Promise<ActionResult>;
  send(type: string, payload?: Record<string, unknown>): void;
  /** Cut the connection without a goodbye, as a phone losing Wi-Fi does. The bot rejoins its seat a second later. */
  drop(): void;
};
export type BotHook = {
  /** Draft for a game with parseLobbyChoice, sent before Ready. `room.players` shows what the other seats already picked. */
  lobbyChoice?(bot: Bot, room: RoomView): unknown;
  /** Held input for this frame, called `hz` times a second while the bot's round is playing. Return undefined to send nothing. */
  input?(bot: Bot): unknown;
  /** Every snapshot of the bot's round. Call `bot.act(...)` from here for turn-based play. */
  snapshot?(bot: Bot, snapshot: Snapshot): void;
};
export type BotOptions = { port: number | string; code: string; players: number; host?: string; offset?: number; ready?: boolean; hz?: number; input?: unknown; hook?: BotHook; log?(line: string): void };

const FIRST = ['Angelina', 'Benedict', 'Cordelia', 'Dominick', 'Evelynne', 'Fletcher', 'Gwynneth', 'Humphrey'], LAST = ['Appleby', 'Bramble', 'Crumpet', 'Dawdler', 'Everett', 'Fizzgig', 'Gumdrop', 'Hopwood'];
/** Sixty-four distinct names, each exactly the 16-character limit. */
export const botName = (index: number) => `${FIRST[index % 8]} ${LAST[(index >> 3) % 8]}`;

export async function joinBots({ port, code, players, host = 'localhost', offset = 0, ready = true, hz = 20, input, hook = {}, log = console.log }: BotOptions) {
  let closed = false;
  const bots: Bot[] = [], frames: (() => void)[] = [], sockets = new Set<WebSocket>();
  const timer = setInterval(() => { for (const frame of frames) frame(); }, 1000 / hz);
  const close = () => { closed = true; clearInterval(timer); for (const socket of sockets) socket.close(); };
  const join = (index: number) => new Promise<Bot>((seated, fail) => {
    const pending = new Map<string, (ack: ActionResult) => void>(), decoder = new SnapshotDecoder();
    let socket: WebSocket, token = '', games: GameManifest[] = [], round: string | null = null, sequence = 0, held = 0, asked = '', syncing = false;
    const bot: Bot = { index, name: botName(index), playerId: '', connected: false, room: null, snapshot: null, bytes: 0, snapshots: 0, errors: [],
      send(type, payload = {}) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ v: '1.0', type, ...payload })); },
      drop() { socket.terminate(); },
      act: payload => new Promise(done => {
        // Windowed games number their actions per round and retire everything below the lowest unanswered one.
        const windowed = !!bot.room?.actionWindow, actionId = windowed ? String(++sequence) : randomUUID();
        pending.set(actionId, done);
        bot.send('game.action', { roundId: round, actionId, payload, ...(windowed ? { retireThrough: Math.min(...[...pending.keys()].map(Number)) - 1 } : {}) });
      }) };
    const onRoom = (room: RoomView) => {
      bot.room = room;
      if (room.roundId !== round) { round = room.roundId; sequence = held = 0; bot.snapshot = null; syncing = false; decoder.reset(); for (const done of pending.values()) done({ accepted: false, reason: 'The round changed.' }); pending.clear(); }
      const me = room.players.find(player => player.id === bot.playerId), lobby = `${room.gameId}:${room.lobbyId}`;
      // Ask once per lobby: a refusal (a full round, an incomplete pick) must not turn into a retry loop.
      if (room.phase !== 'lobby' || me?.ready) asked = '';
      else if (ready && me && asked !== lobby) {
        asked = lobby;
        if (room.lobbyId && hook.lobbyChoice) bot.send('lobby.choice', { lobbyId: room.lobbyId, payload: hook.lobbyChoice(bot, room) });
        bot.send('room.ready', { ready: true, lobbyId: room.lobbyId });
      }
    };
    const connect = () => {
      const current = socket = new WebSocket(`ws://${host}:${port}/ws`); sockets.add(current);
      current.on('open', () => bot.send(token ? 'room.rejoin' : 'room.join', token ? { code, token } : { code, role: 'controller', name: bot.name }));
      current.on('message', data => {
        bot.bytes += (data as Buffer).byteLength;
        const m = JSON.parse(String(data));
        if (m.type === 'room.welcome') { bot.playerId = m.playerId; bot.connected = true; token = m.token; games = m.games; onRoom(m.room); sequence = Math.max(sequence, (m.nextActionSequence ?? 1) - 1); seated(bot); }
        else if (m.type === 'room.state') onRoom(m.room);
        else if (m.type === 'round.prepare') bot.send('round.ready', { roundId: m.roundId });
        else if ((m.type === 'game.snapshot' || m.type === 'round.results') && m.roundId === round) {
          const decoded = decoder.decode(m, games.find(game => game.id === bot.room?.gameId)?.snapshotCache);
          if (decoded) { syncing = false; bot.snapshot = decoded; bot.snapshots++; hook.snapshot?.(bot, decoded); }
          else if (!syncing) { syncing = true; bot.send('snapshot.sync', { roundId: m.roundId }); }
        }
        else if (m.type === 'action.ack') { pending.get(m.actionId)?.(m); pending.delete(m.actionId); }
        else if (m.type === 'error') { bot.errors.push(m.reason); log(`${bot.name}: ${m.reason}`); if (!token) fail(new Error(`${bot.name}: ${m.reason}`)); }
        else if (m.type === 'room.closed') close();
      });
      current.on('error', error => { if (!token) fail(error); });
      current.on('close', () => { sockets.delete(current); bot.connected = false; if (!closed && token) setTimeout(connect, 1000); });
    };
    frames.push(() => {
      if (!bot.connected || bot.room?.phase !== 'playing' || !bot.room.activePlayerIds.includes(bot.playerId)) return;
      const value = hook.input ? hook.input(bot) : input;
      if (value !== undefined) bot.send('input.state', { roundId: round, seq: ++held, payload: value });
    });
    connect();
  });
  try { for (let index = 0; index < players; index++) bots.push(await join(offset + index)); }
  catch (error) { close(); throw error; }
  return { bots, close };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { values: args } = parseArgs({ options: { port: { type: 'string' }, code: { type: 'string' }, players: { type: 'string' }, host: { type: 'string' }, offset: { type: 'string' }, 'no-ready': { type: 'boolean' }, hz: { type: 'string' }, input: { type: 'string' }, hook: { type: 'string' }, stats: { type: 'string' }, minutes: { type: 'string' } } });
  const count = Number(args.players), began = Date.now();
  if (!args.port || !args.code || !Number.isInteger(count) || count < 1) throw new Error('Usage: room-bots.ts --port <port> --code <ROOM> --players <n> [--host localhost] [--offset 0] [--no-ready] [--hz 20] [--input <json>] [--hook <module>] [--stats <seconds>] [--minutes <n>]');
  // A hook outside an ES module package loads as CommonJS, which nests the default export once more.
  const loaded = args.hook ? (await import(pathToFileURL(resolve(args.hook)).href)).default : undefined, hook: BotHook | undefined = loaded?.default ?? loaded;
  const run = await joinBots({ port: args.port, code: args.code.toUpperCase(), players: count, host: args.host, offset: Number(args.offset ?? 0), ready: !args['no-ready'], hz: Number(args.hz ?? 20), ...(args.input ? { input: JSON.parse(args.input) } : {}), hook });
  console.log(`${count} bots joined ${args.code.toUpperCase()}: ${run.bots[0].name} … ${run.bots.at(-1)!.name}. Ctrl+C to leave.`);
  let bytes = 0, snapshots = 0;
  const every = Number(args.stats ?? 0); if (every > 0) setInterval(() => {
    const total = run.bots.reduce((sum, bot) => sum + bot.bytes, 0), seen = run.bots.reduce((sum, bot) => sum + bot.snapshots, 0), room = run.bots.find(bot => bot.connected)?.room;
    console.log(`[${((Date.now() - began) / 1000).toFixed(0)}s] ${run.bots.filter(bot => bot.connected).length}/${count} connected · ${room?.players.filter(player => player.ready).length ?? 0}/${room?.players.length ?? 0} ready · ${room?.phase ?? 'no room'} · ${((total - bytes) / every / count / 1024).toFixed(1)} KiB/s and ${((seen - snapshots) / every / count).toFixed(1)} snapshots/s per bot`);
    bytes = total; snapshots = seen;
  }, every * 1000).unref();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, run.close);
  if (args.minutes) setTimeout(run.close, Number(args.minutes) * 60000).unref();
}
