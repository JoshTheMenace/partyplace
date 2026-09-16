import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, openSync, closeSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createPartyApp } from './app';
import { discoverPartyAddresses } from './network-address';

/**
 * Packaged local host entry. Runs from a prebuilt app folder next to a bundled Node runtime:
 * durable saves outside any checkout, one instance per data directory, opens the shared display in the system browser.
 * Stopping never signals a PID: the record holds a random instance id and stop token, and every stop goes through
 * the verified HTTP handshake, so a stale record can never terminate another process.
 */
export type LocalHostEnv = Record<string, string | undefined>;
export const DEFAULT_LOCAL_PORT = 4350;
export type Instance = { pid: number; port: number; instanceId: string; stopToken: string; startedAt: string };
export function resolveDataDir(env: LocalHostEnv, platform = process.platform, home = homedir()) {
  if (env.PARTY_DATA_DIR) return resolve(env.PARTY_DATA_DIR);
  if (platform === 'darwin') return resolve(home, 'Library/Application Support/PartyPlay');
  if (platform === 'win32') return resolve(env.LOCALAPPDATA ?? resolve(home, 'AppData/Local'), 'PartyPlay');
  return resolve(env.XDG_DATA_HOME ?? resolve(home, '.local/share'), 'partyplay');
}
export const layout = (dataDir: string) => ({ saves: resolve(dataDir, 'world-saves'), logs: resolve(dataDir, 'logs'), instance: resolve(dataDir, 'instance.json'), lock: resolve(dataDir, 'startup.lock') });
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));
export function readInstance(path: string): Instance | null {
  try { const value = JSON.parse(readFileSync(path, 'utf8')) as Instance; return Number.isInteger(value.pid) && Number.isInteger(value.port) && typeof value.instanceId === 'string' && typeof value.stopToken === 'string' ? value : null; } catch { return null; }
}
/** A record is trusted only when the port answers as a local host with the same random instance id. PID liveness alone proves nothing. */
export async function runningInstance(path: string): Promise<Instance | null> {
  const instance = readInstance(path);
  if (!instance) return null;
  try {
    const response = await fetch(`http://127.0.0.1:${instance.port}/api/health`, { signal: AbortSignal.timeout(1500) });
    const health = await response.json() as { ok?: boolean; host?: string; instanceId?: string };
    return response.ok && health.ok && health.host === 'local' && health.instanceId === instance.instanceId ? instance : null;
  } catch { return null; }
}
/** Verified stop for the CLI: confirm identity through health, then present the token. Returns what happened; never signals a process. */
export async function stopInstance(path: string): Promise<'stopped' | 'not-running' | 'stale'> {
  const instance = await runningInstance(path);
  if (!instance) { if (readInstance(path)) { rmSync(path, { force: true }); return 'stale'; } return 'not-running'; }
  const response = await fetch(`http://127.0.0.1:${instance.port}/api/local/stop`, { method: 'POST', headers: { authorization: `Bearer ${instance.stopToken}` }, signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Local host refused to stop (${response.status}).`);
  return 'stopped';
}
/** Wait for live starters; reclaim dead owners or abandoned, incomplete lock files. */
export async function withStartupLock<T>(path: string, work: () => Promise<T>, { waitMs = 15000, staleMs = 30000 } = {}): Promise<T> {
  const deadline = Date.now() + waitMs, owner = JSON.stringify({ pid: process.pid, id: randomUUID() });
  for (;;) {
    try { const file = openSync(path, 'wx', 0o600); try { writeFileSync(file, owner); } finally { closeSync(file); } break; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      let holder: { pid?: number } = {}, age = 0;
      try { age = Date.now() - statSync(path).mtimeMs; holder = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; }
      const hasOwner = Number.isInteger(holder.pid) && holder.pid! > 0;
      if (hasOwner ? !alive(holder.pid!) : age > staleMs) { rmSync(path, { force: true }); continue; }
      if (Date.now() > deadline) throw new Error('Another PartyPlay launch is still starting. Try again shortly.');
      await delay(150);
    }
  }
  try { return await work(); } finally { try { if (readFileSync(path, 'utf8') === owner) rmSync(path, { force: true }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Could not release startup lock:', error); } }
}
export function openBrowser(url: string, platform = process.platform) {
  const [command, args] = platform === 'darwin' ? ['/usr/bin/open', [url]] : platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  const child = spawn(command, args, { stdio: 'ignore', detached: true }); child.on('error', () => console.log(`Open ${url} in your browser.`)); child.unref();
}
const canBind = (port: number) => new Promise<boolean>(done => { const probe = createServer(); probe.once('error', () => done(false)); probe.listen(port, '0.0.0.0', () => probe.close(() => done(true))); });
/** The preferred port may belong to another app or a hosted preview; step upward instead of failing. */
export async function freePort(first: number, attempts = 20) { for (let port = first; port < first + attempts; port++) if (await canBind(port)) return port; throw new Error(`No free port between ${first} and ${first + attempts - 1}.`); }
export async function startLocalHost(env: LocalHostEnv = process.env, appRoot = resolve(dirname(process.argv[1] ?? '.'))) {
  const dataDir = resolveDataDir(env), paths = layout(dataDir);
  mkdirSync(paths.saves, { recursive: true, mode: 0o700 }); mkdirSync(paths.logs, { recursive: true });
  const open = env.PARTY_NO_OPEN !== '1';
  return withStartupLock(paths.lock, async () => {
    const existing = await runningInstance(paths.instance);
    if (existing) { console.log(`PartyPlay is already running: http://localhost:${existing.port}`); if (open) openBrowser(`http://localhost:${existing.port}`); return { reused: true, port: existing.port, instanceId: existing.instanceId, close: async () => {} }; }
    const preferred = Number(env.PORT ?? DEFAULT_LOCAL_PORT);
    if (!Number.isInteger(preferred) || preferred < 1 || preferred > 65535) throw new Error('PORT must be between 1 and 65535.');
    const instanceId = randomUUID(), stopToken = randomBytes(24).toString('hex');
    let closing: Promise<void> | null = null;
    const port = await freePort(preferred);
    const app = createPartyApp({ port, assetRoot: resolve(appRoot, 'client'), saveRoot: paths.saves, catalogPath: resolve(appRoot, 'catalog/sources.json'), local: { instanceId, stopToken, onStop: () => void stop() } });
    await new Promise<void>((done, fail) => { app.server.once('error', fail); app.server.listen(port, '0.0.0.0', done); });
    writeFileSync(paths.instance, JSON.stringify({ pid: process.pid, port, instanceId, stopToken, startedAt: new Date().toISOString() } satisfies Instance) + '\n', { mode: 0o600 });
    async function stop() { if (closing) return closing; closing = app.close().finally(() => { if (readInstance(paths.instance)?.instanceId === instanceId) rmSync(paths.instance, { force: true }); console.log('PartyPlay stopped.'); }); return closing; }
    process.once('SIGINT', () => void stop()); process.once('SIGTERM', () => void stop());
    console.log(`PartyPlay local host ${new Date().toISOString()}\nShared display: http://localhost:${port}\nSaves: ${paths.saves}`);
    for (const url of discoverPartyAddresses(port).urls) console.log(`Phones on the same Wi-Fi: ${url}`);
    if (open) openBrowser(`http://localhost:${port}`);
    return { reused: false, port, instanceId, close: stop };
  });
}
const entry = process.argv[1] ?? '';
if (/local-host\.[cm]?js$/.test(entry)) {
  const command = process.argv[2] === '--stop' ? stopInstance(layout(resolveDataDir(process.env)).instance).then(result => console.log({ stopped: 'PartyPlay stopped.', 'not-running': 'PartyPlay is not running.', stale: 'PartyPlay was not running; cleared its stale record.' }[result])) : startLocalHost();
  command.catch(error => { console.error(`PartyPlay could not ${process.argv[2] === '--stop' ? 'stop' : 'start'}: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
}
