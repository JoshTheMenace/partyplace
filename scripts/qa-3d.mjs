import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
const [name, port] = process.argv.slice(2);
if (!name || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(name) || !/^\d+$/.test(port ?? '') || Number(port) < 1 || Number(port) > 65535) throw new Error('Usage: npm run qa:3d -- built-3d-run unused-port');
const build = JSON.parse(readFileSync(resolve('output/builds', name, 'build.json'), 'utf8'));
if (!build.qa) throw new Error('Build this run with --3d first.');
const probe = createServer(); await new Promise((ok, fail) => { probe.once('error', fail); probe.listen(Number(port), '0.0.0.0', ok); }); await new Promise(ok => probe.close(ok));
const session = `scene-${Date.now().toString(36)}`, evidence = resolve('output/playwright', session); mkdirSync(evidence, { recursive: true }); mkdirSync('output/playwright/scene-lab', { recursive: true });
const cliPath = process.env.PARTY_PLAYWRIGHT_CLI;
if (cliPath && !existsSync(cliPath)) throw new Error('PARTY_PLAYWRIGHT_CLI must point to an installed CLI JavaScript entrypoint.');
function cli(args, label, allowFailure = false) {
  const command = cliPath ? process.execPath : 'npx', prefix = cliPath ? [cliPath] : ['--yes', '--package', '@playwright/cli', 'playwright-cli'];
  const result = spawnSync(command, [...prefix, `-s=${session}`, ...args], { encoding: 'utf8', timeout: 120000, maxBuffer: 5 * 1024 * 1024 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`; writeFileSync(resolve(evidence, `${label}.txt`), output);
  if (!allowFailure && (result.error || result.status !== 0 || output.includes('### Error'))) throw result.error ?? new Error(`${label} failed; see ${evidence}/${label}.txt`);
  const line = output.split('### Result\n')[1]?.split('\n')[0]; if (line) writeFileSync(resolve(evidence, `${label}.json`), JSON.stringify(JSON.parse(line), null, 2));
}
const server = spawn(process.execPath, ['scripts/serve-isolated.mjs', name, port], { stdio: 'inherit' });
let exited = false; server.once('exit', () => { exited = true; }); server.once('error', () => { exited = true; });
try {
  let healthy = false;
  for (let i = 0; i < 50 && !exited; i++) { try { const response = await fetch(`http://localhost:${port}/api/health`); healthy = response.ok && (await response.json()).games.includes('scene-lab'); } catch { /* Await this owned server. */ } if (healthy) break; await new Promise(ok => setTimeout(ok, 100)); }
  if (!healthy || exited) throw new Error('The owned 3D QA server did not start.');
  cli(['open', `http://localhost:${port}`, '--headed'], 'open');
  cli(['run-code', '--filename', 'scripts/qa/scene-lab-flow.js'], 'flow');
  cli(['run-code', '--filename', 'scripts/qa/scene-lab-lifecycle.js'], 'lifecycle');
  cpSync('output/playwright/scene-lab', resolve(evidence, 'screenshots'), { recursive: true });
  writeFileSync(resolve(evidence, 'build.json'), JSON.stringify({ ...build, port: Number(port), session }, null, 2));
  console.log(`3D browser QA passed. Reports: ${evidence}. Screenshots are saved with those reports.`);
} finally { cli(['close'], 'close', true); server.kill('SIGTERM'); }
