import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function buildCollection(directory = 'dist', env = process.env) {
  const root = resolve(directory);
  const steps = [
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', resolve(root, 'client')],
    ['node_modules/esbuild/bin/esbuild', 'apps/party-server/src/main.ts', '--bundle', '--platform=node', '--format=esm', '--packages=external', `--outfile=${root}/server.mjs`],
  ];
  for (const [command, ...args] of steps) {
    const native = command.includes('esbuild');
    const result = spawnSync(native ? command : process.execPath, native ? args : [command, ...args], { stdio: 'inherit', env });
    if (result.error || result.status !== 0) throw result.error ?? new Error(`Build exited ${result.status}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildCollection();
