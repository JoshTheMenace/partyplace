import type { IncomingMessage, ServerResponse } from 'node:http';
import { MAX_SAVE_BYTES } from '../../../packages/party-contract/src/index';
import type { createRoomServer } from './room-server';
type WorldStore = Pick<ReturnType<typeof createRoomServer>, 'authorizeSave' | 'exportSave' | 'loadSave' | 'authorizeRecovery' | 'recoveryMetadata' | 'exportRecovery' | 'restoreRecovery'>;
export async function serveWorldSave(request: IncomingMessage, response: ServerResponse, store: WorldStore) {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new Error('Use this server address.');
    const token = request.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const url = new URL(request.url ?? '/', 'http://localhost'), recovery = url.pathname === '/api/world/recovery';
    const roundId = request.headers['x-party-round'], gameId = url.searchParams.get('gameId') ?? '';
    if (!token || !recovery && typeof roundId !== 'string') { response.statusCode = 401; throw new Error('Host authentication required.'); }
    if (recovery) store.authorizeRecovery(token, gameId); else store.authorizeSave(token, roundId as string);
    const slot = (value: unknown) => { if (value !== 'latest' && value !== 'previous') throw new Error('Choose the latest or previous autosave.'); return value; };
    if (request.method === 'GET') { response.end(recovery ? url.searchParams.get('download') === '1' ? await store.exportRecovery(token, gameId, slot(url.searchParams.get('slot'))) : JSON.stringify(await store.recoveryMetadata(token, gameId)) : store.exportSave(token, roundId as string)); return; }
    if (request.method !== 'PUT') { response.statusCode = 405; throw new Error('Use GET or PUT.'); }
    if (request.headers['content-type']?.split(';')[0] !== 'application/json') { response.statusCode = 415; throw new Error('Choose a JSON world save.'); }
    let size = 0; const chunks: Buffer[] = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_SAVE_BYTES) { response.statusCode = 413; throw new Error('World save exceeds 256 KiB.'); }
      chunks.push(chunk);
    }
    let raw: unknown;
    try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('The file is not valid JSON.'); }
    response.end(JSON.stringify(recovery ? await store.restoreRecovery(token, gameId, slot((raw as { slot?: unknown })?.slot)) : store.loadSave(token, roundId as string, raw)));
  } catch (error) {
    if (!response.headersSent) { if (response.statusCode === 200) response.statusCode = 400; response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'World save failed.' })); }
  }
}
