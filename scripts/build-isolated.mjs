import { buildCollection } from './build-collection.mjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const name = process.argv[2];
if (!name || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(name)) throw new Error('Usage: npm run build:isolated -- unique-run-name [--3d]');
const root = resolve('output/builds', name), qa = process.argv.includes('--3d');
mkdirSync(resolve('output/builds'), { recursive: true }); mkdirSync(root); // Refuse an existing run; never mutate served assets.
const env = { ...process.env, VITE_PARTY_QA: qa ? '1' : '0' };
buildCollection(root, env);
const index = readFileSync(resolve(root, 'client/index.html'));
writeFileSync(resolve(root, 'build.json'), JSON.stringify({ name, qa, builtAt: new Date().toISOString(), indexSha256: createHash('sha256').update(index).digest('hex') }, null, 2));
console.log(`\nReady: npm run serve:isolated -- ${name} 4340`);
