import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [name, port] = process.argv.slice(2);
if (!name || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(name) || !port || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Usage: npm run serve:isolated -- run-name unused-port');
const root = resolve('output/builds', name), build = JSON.parse(readFileSync(resolve(root, 'build.json'), 'utf8'));
const child = spawn(process.execPath, [resolve(root, 'server.mjs')], { stdio: 'inherit', env: { ...process.env, PORT: port, PARTY_ASSET_ROOT: resolve(root, 'client'), PARTY_SAVE_ROOT: process.env.PARTY_SAVE_ROOT ?? resolve(root, 'world-saves'), PARTY_QA: build.qa ? '1' : '0' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', error => { console.error(error); process.exitCode = 1; }); child.once('exit', code => { process.exitCode = code ?? 1; });
