import { serveStaticFile } from '../../../modules/kart-party/server/static-response';
import { serveWorldSave } from './world-http';
import { createServer } from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRoomHub } from './room-hub';
import { discoverPartyAddresses, parsePublicOrigin } from './network-address';
import { games } from './registry';
import { readCatalog } from './catalog';
const root = resolve(process.env.PARTY_ASSET_ROOT ?? 'dist/client');
const port = Number(process.env.PORT ?? 4317);
const host = process.env.HOST?.trim() || '0.0.0.0';
const publicOrigin = parsePublicOrigin(process.env.PUBLIC_ORIGIN);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = createServer((request, response) => {
  let pathname: string;
  try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); } catch { response.writeHead(400).end('Invalid URL'); return; }
  if (pathname === '/kart-party' || pathname === '/kart-party/') { const query = new URL(request.url ?? '/', 'http://localhost').search; response.writeHead(302, { Location: query ? `/${query}` : '/games/kart-party' }).end(); return; }
  if (pathname === '/api/round/save' || pathname === '/api/world/recovery') {
    const room = party.roomForCode(request.headers['x-party-room']);
    if (!room) { response.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ error: 'Reconnect to your room before accessing world saves.' })); return; }
    void serveWorldSave(request, response, room); return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end('Use GET'); return; }
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-cache');
  if (pathname === '/api/addresses') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(publicOrigin ? { urls: [publicOrigin], preferredUrl: publicOrigin } : discoverPartyAddresses(port, undefined, request.headers.host, request.socket.localAddress))); return; }
  if (pathname === '/api/catalog') {
    response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
    void readCatalog(undefined, new Set(games.map(game => game.manifest.id))).then(sources => response.end(JSON.stringify({ games: games.map(game => game.manifest), sources }))).catch(error => { console.error('Catalog unavailable:', error.message); response.writeHead(503).end(JSON.stringify({ error: 'Discover is temporarily unavailable. Please try again.' })); }); return;
  }
  if (pathname === '/api/health') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ ok: true, games: games.map(game => game.manifest.id) })); return; }
  const candidate = resolve(root, `.${pathname}`);
  if (!candidate.startsWith(root + sep) && candidate !== root) { response.writeHead(403).end('Forbidden'); return; }
  const file = existsSync(candidate) && statSync(candidate).isFile() ? candidate : extname(pathname) ? null : resolve(root, 'index.html');
  if (!file || !existsSync(file)) { response.writeHead(404).end('Build the client first with npm run build.'); return; }
  void serveStaticFile(request, response, file, mime[extname(file)] ?? 'application/octet-stream').catch(() => { if (!response.headersSent) response.writeHead(500); response.end(); });
});
const party = createRoomHub(server, games, { saveRoot: resolve(process.env.PARTY_SAVE_ROOT ?? 'output/world-saves'), roomOptions: process.env.PARTY_QA === '1' ? { seed: () => 20260908 } : {} });
server.on('upgrade', (request, socket) => { if (!['/ws'].includes(request.url?.split('?')[0] ?? '')) socket.destroy(); });
server.on('error', error => { console.error(`Party server could not start: ${error.message}. If the port is occupied, run PORT=4318 npm start.`); process.exitCode = 1; void party.close(); });
server.listen(port, host, () => { console.log(`Open the shared display: http://localhost:${port}`); const { urls } = discoverPartyAddresses(port); for (const url of urls) console.log(`Phones on the same Wi-Fi: ${url}`); if (!urls.length) console.log('No LAN address found. Connect this computer to Wi-Fi and reload the lobby.'); });
async function shutdown() { await party.close(); server.close(); }
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
