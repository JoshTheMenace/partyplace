import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const cwd = new URL('../modules/kart-party/', import.meta.url);
const tests = readdirSync(new URL('tests/', cwd)).filter(name => name.endsWith('.test.ts')).map(name => `tests/${name}`);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...tests], { cwd, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
