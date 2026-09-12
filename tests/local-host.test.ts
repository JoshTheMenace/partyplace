import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { allowsLocalStop, authorizesLocalStop, createPartyApp } from '../apps/party-server/src/app';
import { freePort, layout, readInstance, resolveDataDir, runningInstance, startLocalHost, stopInstance, withStartupLock } from '../apps/party-server/src/local-host';
const delay = (ms: number) => new Promise(done => setTimeout(done, ms));
const temp = () => mkdtemp(join(tmpdir(), 'party-local-'));
const TOKEN = 'a'.repeat(48);
const request = (remoteAddress: string | undefined, headers: Record<string, string>) => ({ socket: { remoteAddress }, headers });

test('data directory follows the platform convention and the explicit override', () => {
  assert.equal(resolveDataDir({}, 'darwin', '/Users/pat'), '/Users/pat/Library/Application Support/PartyPlay');
  assert.equal(resolveDataDir({ XDG_DATA_HOME: '/data' }, 'linux', '/home/pat'), '/data/partyplay');
  assert.equal(resolveDataDir({}, 'linux', '/home/pat'), '/home/pat/.local/share/partyplay');
  assert.equal(resolveDataDir({ PARTY_DATA_DIR: 'relative/dir' }, 'darwin', '/Users/pat'), resolve('relative/dir'));
  assert.deepEqual(Object.keys(layout('/d')), ['saves', 'logs', 'instance', 'lock']);
});

test('stop authorization: loopback socket plus loopback Host, then same-origin browser or bearer token', () => {
  for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(allowsLocalStop(address), true, address);
  for (const address of ['192.168.1.20', '::ffff:192.168.1.20', '10.0.0.5', undefined, '']) assert.equal(allowsLocalStop(address), false, String(address));
  const ok = (remote: string, headers: Record<string, string>) => authorizesLocalStop(request(remote, headers), TOKEN);
  assert.equal(ok('127.0.0.1', { host: 'localhost:4350', origin: 'http://localhost:4350' }), true, 'browser on the host');
  assert.equal(ok('::1', { host: '[::1]:4350', origin: 'http://[::1]:4350' }), true, 'IPv6 loopback browser');
  assert.equal(ok('127.0.0.1', { host: '127.0.0.1:4350', authorization: `Bearer ${TOKEN}` }), true, 'CLI token without Origin');
  assert.equal(ok('192.168.1.20', { host: '192.168.1.5:4350', origin: 'http://192.168.1.5:4350' }), false, 'phone on the LAN');
  assert.equal(ok('192.168.1.20', { host: 'localhost:4350', authorization: `Bearer ${TOKEN}` }), false, 'token from the LAN');
  assert.equal(ok('127.0.0.1', { host: 'evil.example:4350', origin: 'http://evil.example:4350' }), false, 'DNS rebinding Host');
  assert.equal(ok('127.0.0.1', { host: 'localhost:4350', origin: 'http://evil.example' }), false, 'foreign Origin');
  assert.equal(ok('127.0.0.1', { host: 'localhost:4350', origin: 'http://localhost:9999' }), false, 'Origin port mismatch');
  assert.equal(ok('127.0.0.1', { host: 'localhost:4350', origin: 'not a url' }), false, 'malformed Origin');
  assert.equal(ok('127.0.0.1', { host: 'not a host', origin: 'http://localhost:4350' }), false, 'malformed Host');
  assert.equal(ok('127.0.0.1', { host: 'localhost:4350' }), false, 'no Origin and no token');
  assert.equal(ok('127.0.0.1', { host: 'localhost:4350', authorization: `Bearer ${'b'.repeat(48)}` }), false, 'wrong token');
  assert.equal(ok('127.0.0.1', { host: 'user@localhost:4350', origin: 'http://localhost:4350' }), false, 'credentials in Host');
});

test('hosted app has no stop endpoint; local app survives malformed headers and stops once when authorized', async () => {
  const dir = await temp();
  try {
    const hosted = createPartyApp({ port: 0, assetRoot: dir, saveRoot: join(dir, 'saves') });
    await new Promise<void>(done => hosted.server.listen(0, '127.0.0.1', done));
    const hostedPort = (hosted.server.address() as { port: number }).port;
    assert.equal((await fetch(`http://127.0.0.1:${hostedPort}/api/local/stop`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` } })).status, 404);
    const hostedHealth = await (await fetch(`http://127.0.0.1:${hostedPort}/api/health`)).json() as { host: string; instanceId?: string };
    assert.equal(hostedHealth.host, 'hosted'); assert.equal(hostedHealth.instanceId, undefined);
    await hosted.close();
    let stops = 0;
    const local = createPartyApp({ port: 0, assetRoot: dir, saveRoot: join(dir, 'saves'), local: { instanceId: 'id-1', stopToken: TOKEN, onStop: () => { stops++; } } });
    await new Promise<void>(done => local.server.listen(0, '127.0.0.1', done));
    const port = (local.server.address() as { port: number }).port, base = `http://127.0.0.1:${port}`;
    assert.equal(((await (await fetch(`${base}/api/addresses`)).json()) as { host: string }).host, 'local');
    assert.equal(((await (await fetch(`${base}/api/health`)).json()) as { instanceId: string }).instanceId, 'id-1');
    assert.equal((await fetch(`${base}/api/local/stop`)).status, 405);
    for (const headers of <Record<string, string>[]>[{ origin: 'not a url' }, { origin: 'http://evil.example' }, { host: 'evil.example:80', origin: 'http://evil.example:80' }, { host: 'bad' }, { authorization: 'Bearer nope' }, {}]) {
      assert.equal((await fetch(`${base}/api/local/stop`, { method: 'POST', headers })).status, 403, JSON.stringify(headers));
    }
    assert.equal((await fetch(`${base}/api/health`)).status, 200, 'server still serving after malformed headers');
    assert.equal(stops, 0);
    const ok = await fetch(`${base}/api/local/stop`, { method: 'POST', headers: { origin: base } });
    assert.deepEqual(await ok.json(), { ok: true, stopping: true });
    await delay(120); assert.equal(stops, 1);
    await local.close();
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('startLocalHost records a random identity, reuses only a verified instance, ignores stale or foreign records, and clears its own on stop', async () => {
  const dir = await temp(), appRoot = join(dir, 'app'), port = await freePort(4900);
  try {
    const env = { PARTY_DATA_DIR: join(dir, 'data'), PORT: String(port), PARTY_NO_OPEN: '1' }, paths = layout(join(dir, 'data'));
    const first = await startLocalHost(env, appRoot);
    assert.equal(first.reused, false); assert.equal(first.port, port);
    const record = readInstance(paths.instance)!;
    assert.equal(record.pid, process.pid); assert.equal(record.port, port); assert.equal(record.instanceId, first.instanceId);
    assert.match(record.stopToken, /^[0-9a-f]{48}$/); assert.equal((await stat(paths.instance)).mode & 0o777, 0o600);
    assert.equal((await stat(paths.saves)).isDirectory(), true); assert.equal(existsSync(paths.lock), false, 'startup lock released');
    const second = await startLocalHost(env, appRoot);
    assert.equal(second.reused, true); assert.equal(second.instanceId, first.instanceId);
    // A record pointing at a live port but with a different identity is never trusted or stopped.
    await writeFile(paths.instance, JSON.stringify({ ...record, instanceId: 'someone-else' }));
    assert.equal(await runningInstance(paths.instance), null);
    assert.equal(await stopInstance(paths.instance), 'stale', 'foreign record is cleared, nothing is signalled');
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200, 'the real host kept running');
    await writeFile(paths.instance, JSON.stringify(record));
    assert.equal(await stopInstance(paths.instance), 'stopped');
    await first.close(); await delay(50);
    assert.equal(existsSync(paths.instance), false, 'instance record removed after stop');
    assert.equal(await stopInstance(paths.instance), 'not-running');
    await writeFile(paths.instance, JSON.stringify({ ...record, pid: process.pid }));
    assert.equal(await runningInstance(paths.instance), null, 'a live pid with no answering host is not an instance');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('concurrent launches yield one host; live and newly created locks are not stolen', async () => {
  const dir = await temp(), appRoot = join(dir, 'app'), port = await freePort(4920);
  try {
    const env = { PARTY_DATA_DIR: join(dir, 'data'), PORT: String(port), PARTY_NO_OPEN: '1' }, paths = layout(join(dir, 'data'));
    const results = await Promise.all([1, 2, 3, 4].map(() => startLocalHost(env, appRoot)));
    assert.equal(results.filter(result => !result.reused).length, 1, 'exactly one start');
    assert.equal(new Set(results.map(result => result.instanceId)).size, 1); assert.equal(new Set(results.map(result => result.port)).size, 1);
    assert.equal(existsSync(paths.lock), false);
    await Promise.all(results.map(result => result.close()));
    await writeFile(paths.lock, JSON.stringify({ pid: 2 ** 22 + 7, at: Date.now() }));
    assert.equal(await withStartupLock(paths.lock, async () => 'ran'), 'ran', 'dead holder reclaimed');
    await writeFile(paths.lock, JSON.stringify({ pid: process.pid, at: Date.now() - 60000 }));
    await assert.rejects(withStartupLock(paths.lock, async () => 'ran', { waitMs: 300 }), /still starting/, 'a slow live holder is not stolen');
    assert.equal(existsSync(paths.lock), true, 'someone else’s live lock is left alone');
    await writeFile(paths.lock, ''); // Another process can observe the file between exclusive creation and writing its owner.
    await assert.rejects(withStartupLock(paths.lock, async () => 'ran', { waitMs: 300 }), /still starting/, 'fresh incomplete lock is respected');
    const old = new Date(Date.now() - 60000); await utimes(paths.lock, old, old);
    assert.equal(await withStartupLock(paths.lock, async () => 'ran'), 'ran', 'abandoned incomplete lock is reclaimed');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

const app = process.env.PARTY_LOCAL_HOST_APP;
test('packaged app launches from its bundled runtime, serves games and catalog, reuses itself, refuses foreign stops, and stops through the handshake', { skip: !app && 'set PARTY_LOCAL_HOST_APP to a packaged PartyPlay.app' }, async () => {
  const dir = await temp(), port = await freePort(4950);
  const launcher = resolve(app!, 'Contents/MacOS/PartyPlay'), stopper = resolve(app!, '../Stop PartyPlay.command');
  const env = { PATH: '/usr/bin:/bin', PARTY_DATA_DIR: join(dir, 'data'), PORT: String(port), PARTY_NO_OPEN: '1' }; // No Node, npm or repo on PATH; data isolated by PARTY_DATA_DIR.
  const child = spawn(launcher, [], { env, stdio: 'ignore' });
  try {
    let health: { ok?: boolean; host?: string; games?: string[]; instanceId?: string } | null = null;
    for (let attempt = 0; attempt < 80 && !health; attempt++) { await delay(250); health = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(500) }).then(r => r.json() as Promise<typeof health>).catch(() => null); }
    assert.ok(health?.ok, 'packaged host answered health'); assert.equal(health!.host, 'local'); assert.equal(health!.games!.length, 9, 'nine bundled games');
    const catalog = await (await fetch(`http://127.0.0.1:${port}/api/catalog`)).json() as { sources: { games: unknown[] }[] };
    assert.ok(catalog.sources.length >= 1 && catalog.sources[0].games.length >= 9, 'catalog served from the app folder');
    const index = await fetch(`http://127.0.0.1:${port}/`); assert.equal(index.status, 200); assert.match(await index.text(), /<div id="root">/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/games/kart-party/music/rainbow-lap-rush.mp3`, { method: 'HEAD' })).status, 200, 'bundled game asset');
    const paths = layout(join(dir, 'data'));
    const record = readInstance(paths.instance)!; assert.equal(record.port, port); assert.equal(record.instanceId, health!.instanceId);
    const log = await readFile(join(dir, 'data/logs/local-host.log'), 'utf8'); assert.match(log, /Shared display: http:\/\/localhost:/); assert.doesNotMatch(log, new RegExp(record.stopToken), 'token never logged');
    const again = spawn(launcher, [], { env, stdio: 'ignore' });
    assert.equal(await new Promise<number | null>(done => again.once('exit', done)), 0); assert.equal(readInstance(paths.instance)?.instanceId, record.instanceId, 'same instance kept');
    // The stop script refuses to act on a record whose identity does not match the running host, and the host stays up.
    await writeFile(paths.instance, JSON.stringify({ ...record, instanceId: 'stale-identity' }));
    const stale = spawn(stopper, [], { env }); let staleOut = ''; stale.stdout.on('data', chunk => { staleOut += chunk; });
    assert.equal(await new Promise<number | null>(done => stale.once('exit', done)), 0); assert.match(staleOut, /stale/i);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200, 'host untouched by stale stop');
    await writeFile(paths.instance, JSON.stringify(record));
    const stop = spawn(stopper, [], { env }); let stopOut = ''; stop.stdout.on('data', chunk => { stopOut += chunk; });
    assert.equal(await new Promise<number | null>(done => stop.once('exit', done)), 0); assert.match(stopOut, /stopped/i);
    const exit = await Promise.race([new Promise<string>(done => child.once('exit', () => done('exited'))), delay(5000).then(() => 'timeout')]);
    assert.equal(exit, 'exited', 'process ended after verified stop'); assert.equal(existsSync(paths.instance), false);
  } finally { if (child.exitCode === null) child.kill('SIGKILL'); await rm(dir, { recursive: true, force: true }); }
});
