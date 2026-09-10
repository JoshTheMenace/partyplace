import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRecoveryStore } from '../apps/party-server/src/recovery-store';
import { MAX_SAVE_BYTES } from '../packages/party-contract/src/index';
test('recovery checkpoints survive restart, retain the previous world and serialize updates into private atomic files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'party-recovery-'));
  try {
    const store = createRecoveryStore(root);
    await store.write('blockwild', 'world-a', '{"build":1}', 1);
    await store.write('blockwild', 'world-a', '{"build":2}', 2);
    await Promise.all([store.write('blockwild', 'world-b', '{"build":3}', 3), store.write('blockwild', 'world-b', '{"build":4}', 4)]);
    await store.flush();
    const restarted = createRecoveryStore(root);
    assert.deepEqual(await restarted.read('blockwild', 'latest'), { save: '{"build":4}', worldId: 'world-b' });
    assert.deepEqual(await restarted.read('blockwild', 'previous'), { save: '{"build":2}', worldId: 'world-a' });
    assert.deepEqual((await restarted.list('blockwild')).map(item => [item.slot, item.savedAt]), [['latest', 4], ['previous', 2]]);
    const files = await readdir(root); assert.equal(files.length, 2); assert(files.every(file => file.endsWith('.json')));
    for (const file of files) { assert.equal((await stat(join(root, file))).mode & 0o777, 0o600); assert.equal(JSON.parse(await readFile(join(root, file), 'utf8')).version, 1); }
    await assert.rejects(store.write('../escape', 'world-c', '{}', 5));
    await assert.rejects(store.write('blockwild', 'world-c', JSON.stringify({ data: 'x'.repeat(MAX_SAVE_BYTES) }), 5));
    assert.deepEqual(await store.read('blockwild', 'latest'), { save: '{"build":4}', worldId: 'world-b' });
    // A corrupt newest file must not hide or destroy the previous generation.
    await writeFile(join(root, 'blockwild.latest.json'), '{broken');
    assert.deepEqual((await restarted.list('blockwild')).map(item => item.slot), ['previous']);
    await assert.rejects(restarted.read('blockwild', 'latest'), /unavailable|invalid/i);
    assert.deepEqual(await restarted.read('blockwild', 'previous'), { save: '{"build":2}', worldId: 'world-a' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
