import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
function run(command, args) { return new Promise((resolveRun, reject) => { const child = spawn(command, args, { stdio: 'inherit' }); child.once('error', reject); child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`${command} exited ${code}`))); }); }
try { await run('npm', ['run', 'build']); await run(process.execPath, ['dist/server.mjs']); } catch (error) { console.error(error.message); process.exitCode = 1; }
