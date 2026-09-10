import { spawn, spawnSync } from 'node:child_process';
import { mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { buildCollection } from './build-collection.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
process.chdir(repo);
const port = Number(process.env.PORT ?? 4361);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const root = resolve(process.env.PARTY_LAUNCHER_ROOT ?? 'output/dashboard-launcher');
const url = `http://localhost:${port}`;
const lockPath = resolve(root, 'startup.lock');
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function healthy() {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) });
    const data = await response.json();
    if (response.ok && data.ok && ['blockwild', 'kitchen-rush', 'kart-party'].every(id => data.games?.includes(id))) return true;
    throw new Error(`Port ${port} is being used by another app. Choose another PORT.`);
  } catch (error) {
    if (error.message.startsWith('Port ')) throw error;
    return false;
  }
}
async function lock() {
  for (let attempt = 0; attempt < 180; attempt++) {
    try {
      const file = await open(lockPath, 'wx', 0o600);
      await file.writeFile(String(process.pid)); await file.close();
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const pid = Number(await readFile(lockPath, 'utf8').catch(() => ''));
      if (pid > 0 && !alive(pid)) await unlink(lockPath).catch(() => {});
      await delay(1000);
    }
  }
  throw new Error('Another PartyPlay launch is still starting. Try again shortly.');
}

await mkdir(root, { recursive: true });
await lock();
try {
  if (!await healthy()) {
    const build = resolve(root, `build-${port}`);
    const recordPath = resolve(root, `server-${port}.json`);
    const previous = JSON.parse(await readFile(recordPath, 'utf8').catch(() => 'null'));
    if (previous && alive(previous.pid)) throw new Error(`PartyPlay is still starting or is unresponsive. See ${root}/server.log.`);
    console.log('Building PartyPlay…');
    buildCollection(build, { ...process.env, PARTY_QA: '0' });
    const log = await open(resolve(root, 'server.log'), 'a');
    const child = spawn(process.execPath, [resolve(build, 'server.mjs')], {
      cwd: repo, detached: true, stdio: ['ignore', log.fd, log.fd],
      env: { ...process.env, PORT: String(port), PARTY_ASSET_ROOT: resolve(build, 'client'), PARTY_SAVE_ROOT: process.env.PARTY_SAVE_ROOT ?? resolve(repo, 'output/world-saves'), PARTY_QA: '0' },
    });
    await new Promise((accept, reject) => { child.once('spawn', accept); child.once('error', reject); });
    child.unref(); await log.close();
    await writeFile(recordPath, JSON.stringify({ pid: child.pid, port, build, startedAt: new Date().toISOString() }) + '\n', { mode: 0o600 });
    let ready = false;
    for (let attempt = 0; attempt < 60 && alive(child.pid); attempt++) {
      if (await healthy()) { ready = true; break; }
      await delay(250);
    }
    if (!ready) throw new Error(`PartyPlay could not start. See ${root}/server.log.`);
  }
  console.log(`PartyPlay is ready: ${url}`);
  if (!process.argv.includes('--no-open')) {
    const result = spawnSync('/usr/bin/open', [url], { stdio: 'inherit' });
    if (result.error || result.status !== 0) throw result.error ?? new Error(`Open ${url} in your browser.`);
  }
} finally { await unlink(lockPath); }
