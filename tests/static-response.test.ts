import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveStaticFile } from '../apps/party-server/src/static-response';

test('static files support HEAD, byte ranges and unsatisfiable ranges', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'party-static-')), file = join(directory, 'track.mp3'), body = Buffer.from(Array.from({ length: 5000 }, (_, i) => i % 256));
  await writeFile(file, body);
  const server = createServer((req, res) => void serveStaticFile(req, res, file, 'audio/mpeg'));
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const head = await fetch(origin, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), '5000'); assert.equal(head.headers.get('accept-ranges'), 'bytes');
    const part = await fetch(origin, { headers: { range: 'bytes=100-199' } });
    assert.equal(part.status, 206); assert.equal(part.headers.get('content-range'), 'bytes 100-199/5000'); assert.deepEqual(Buffer.from(await part.arrayBuffer()), body.subarray(100, 200));
    const tail = await fetch(origin, { headers: { range: 'bytes=-10' } });
    assert.deepEqual(Buffer.from(await tail.arrayBuffer()), body.subarray(4990));
    const bad = await fetch(origin, { headers: { range: 'bytes=9000-' } });
    assert.equal(bad.status, 416); assert.equal(bad.headers.get('content-range'), 'bytes */5000');
    assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
  } finally { await new Promise<void>(done => server.close(() => done())); await rm(directory, { recursive: true, force: true }); }
});
