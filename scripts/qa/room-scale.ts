/**
 * Room cost at scale: a synthetic 20 Hz realtime game on the real room server, filled over real sockets by room-bots.ts in a
 * child process so bot work stays off the server's event loop. Prints server CPU per snapshot and per second, and traffic,
 * for each roster size.
 *
 *   node --import tsx scripts/qa/room-scale.ts [--players 10,32,64] [--seconds 10]
 *
 * The game is Crowd Lab (apps/party-server/src/crowd-lab.ts): racer-sized public state and a small private view.
 * Numbers are relative: compare rows from one run on one machine.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { parseArgs } from 'node:util';
import { WebSocket } from 'ws';
import { manifest, rules } from '../../apps/party-server/src/crowd-lab';
import { createRoomServer, type RegisteredGame } from '../../apps/party-server/src/room-server';

// One span per server callback: opened by the first rules hook it calls, closed by a microtask once the callback returns.
// Spans are CPU time, so a busy machine that deschedules this process does not inflate them.
const cpuMs = () => { const { user, system } = process.cpuUsage(); return (user + system) / 1000; };
let open = false, began = 0, fanout = false, spans: number[] = [], fanouts: number[] = [];
const timed = <T extends (...args: any[]) => any>(hook: T, snapshot = false) => ((...args: any[]) => {
  if (!open) { open = true; fanout = false; began = cpuMs(); queueMicrotask(() => { open = false; (fanout ? fanouts : spans).push(cpuMs() - began); }); }
  fanout ||= snapshot; return hook(...args);
}) as T;
const game: RegisteredGame = { manifest, rules: { ...rules, tick: timed(rules.tick), outcome: timed(rules.outcome), publicView: timed(rules.publicView, true), playerView: timed(rules.playerView, true) } };

const { values: args } = parseArgs({ options: { players: { type: 'string', default: '10,32,64' }, seconds: { type: 'string', default: '10' } } });
const seconds = Number(args.seconds), delay = (ms: number) => new Promise(done => setTimeout(done, ms));
const until = async (check: () => boolean, label: string) => { for (let i = 0; i < 1200; i++) { if (check()) return; await delay(50); } throw new Error(`Timed out waiting for ${label}`); };
const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))] ?? 0;
const sent = (party: ReturnType<typeof createRoomServer>) => [...party.wss.clients].reduce((sum, client) => sum + ((client as unknown as { _socket: { bytesWritten: number } })._socket?.bytesWritten ?? 0), 0);
const rows: Record<string, string | number>[] = [];
for (const count of args.players!.split(',').map(Number)) {
  const server = createServer(), party = createRoomServer(server, [game]);
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const port = (server.address() as { port: number }).port, host = new WebSocket(`ws://127.0.0.1:${port}/ws`), say = (type: string, data = {}) => host.send(JSON.stringify({ v: '1.0', type, ...data }));
  // The host display stays in this process, so it skips parsing snapshots and adds almost nothing to the measured loop.
  host.on('message', data => { const text = String(data); if (text.startsWith('{"v":"1.0","type":"game.snapshot"')) return; const m = JSON.parse(text); if (m.type === 'round.prepare') say('round.ready', { roundId: m.roundId }); if (m.type === 'error') console.error('host:', m.reason); });
  await new Promise(done => host.once('open', done)); say('room.create');
  await until(() => !!party.roomView().code, 'the room'); say('game.select', { gameId: manifest.id, settings: { seconds: 3600 } });
  const bots = spawn(process.execPath, ['--import', 'tsx', 'scripts/qa/room-bots.ts', '--port', String(port), '--code', party.roomView().code, '--players', String(count), '--input', '{"x":0.7,"y":1}'], { stdio: ['ignore', 'ignore', 'inherit'] });
  try {
    await until(() => party.roomView().players.length === count && party.roomView().players.every(player => player.ready), `${count} ready bots`); say('round.start');
    await until(() => party.roomView().phase === 'playing', 'the round'); await delay(2000);
    spans = []; fanouts = []; const cpu = process.cpuUsage(), bytes = sent(party), sockets = party.wss.clients.size; await delay(seconds * 1000);
    const used = process.cpuUsage(cpu), out = sent(party) - bytes;
    rows.push({ players: count, sockets, 'snapshots/s': +(fanouts.length / seconds).toFixed(1), 'snapshot CPU ms (median)': +quantile(fanouts, .5).toFixed(2), 'snapshot CPU ms (p95)': +quantile(fanouts, .95).toFixed(2), 'tick+snapshot CPU ms/s': +((fanouts.reduce((a, b) => a + b, 0) + spans.reduce((a, b) => a + b, 0)) / seconds).toFixed(1), 'process CPU ms/s': +((used.user + used.system) / 1000 / seconds).toFixed(0), 'KiB/s per socket': +(out / seconds / sockets / 1024).toFixed(1), 'MiB/s total': +(out / seconds / 1048576).toFixed(2), 'KiB per snapshot': +(out / Math.max(1, fanouts.length) / sockets / 1024).toFixed(2) });
  } finally { bots.kill('SIGTERM'); host.close(); await party.close(); await new Promise(done => server.close(done)); }
}
console.table(rows);
