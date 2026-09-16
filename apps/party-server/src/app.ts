import { serveStaticFile } from '../../../packages/games/kart-party/src/standalone-server/static-response';
import { serveWorldSave } from './world-http';
import { createServer } from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRoomHub } from './room-hub';
import { discoverPartyAddresses } from './network-address';
import { games } from './registry';
import { readCatalog } from './catalog';

/** One HTTP+WebSocket application for both the hosted service and the packaged local host. */
export type PartyAppOptions = {
  port: number; assetRoot: string; saveRoot: string; catalogPath?: string; publicOrigin?: string; qa?: boolean;
  /** Present only in the packaged local host: enables the loopback-only stop endpoint and labels responses. */
  local?: { instanceId: string; stopToken: string; onStop(): void };
};
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
/** Only the display running on the hosting computer may stop a local host; phones on the LAN cannot. */
export const allowsLocalStop = (remoteAddress: string | undefined) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddress ?? '');
const loopbackName = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname.toLowerCase());
/**
 * A stop request must come from a loopback socket AND either carry the instance's stop token (CLI) or be a same-origin
 * browser request whose Host and Origin both name this machine. A Host or Origin naming any other site is DNS rebinding.
 */
export function authorizesLocalStop(request: { socket: { remoteAddress?: string }; headers: { host?: string; origin?: string; authorization?: string } }, stopToken: string) {
  if (!allowsLocalStop(request.socket.remoteAddress)) return false;
  try {
    const host = new URL(`http://${request.headers.host ?? ''}`);
    if (!loopbackName(host.hostname) || host.pathname !== '/' || host.username) return false;
    if (request.headers.authorization === `Bearer ${stopToken}`) return true;
    if (request.headers.origin === undefined) return false;
    const origin = new URL(request.headers.origin);
    return origin.protocol === 'http:' && loopbackName(origin.hostname) && origin.host === host.host;
  } catch { return false; }
}
export function createPartyApp(options: PartyAppOptions) {
  const { port, assetRoot: root, publicOrigin, local } = options;
  const hostKind = local ? 'local' : 'hosted';
  const server = createServer((request, response) => {
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); } catch { response.writeHead(400).end('Invalid URL'); return; }
    if (pathname === '/kart-party' || pathname === '/kart-party/') { const query = new URL(request.url ?? '/', 'http://localhost').search; response.writeHead(302, { Location: query ? `/${query}` : '/games/kart-party' }).end(); return; }
    if (pathname === '/api/round/save' || pathname === '/api/world/recovery') {
      const room = party.roomForCode(request.headers['x-party-room']);
      if (!room) { response.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ error: 'Reconnect to your room before accessing world saves.' })); return; }
      void serveWorldSave(request, response, room); return;
    }
    if (pathname === '/api/local/stop') {
      response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      if (!local) { response.writeHead(404).end(JSON.stringify({ error: 'This server is not a local host.' })); return; }
      if (request.method !== 'POST') { response.writeHead(405).end(JSON.stringify({ error: 'Use POST.' })); return; }
      if (!authorizesLocalStop(request, local.stopToken)) { response.writeHead(403).end(JSON.stringify({ error: 'Stop PartyPlay from the browser on the hosting computer.' })); return; }
      response.end(JSON.stringify({ ok: true, stopping: true })); setTimeout(local.onStop, 50); return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end('Use GET'); return; }
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-cache');
    if (pathname === '/api/addresses') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ ...(publicOrigin ? { urls: [publicOrigin], preferredUrl: publicOrigin } : discoverPartyAddresses(port, undefined, request.headers.host, request.socket.localAddress, (server.address() as { address?: string } | null)?.address)), host: hostKind })); return; }
    if (pathname === '/api/catalog') {
      response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
      void readCatalog(options.catalogPath, new Set(games.map(game => game.manifest.id))).then(sources => response.end(JSON.stringify({ games: games.map(game => game.manifest), sources }))).catch(error => { console.error('Catalog unavailable:', error.message); response.writeHead(503).end(JSON.stringify({ error: 'Discover is temporarily unavailable. Please try again.' })); });
      return;
    }
    if (pathname === '/api/health') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ ok: true, games: games.map(game => game.manifest.id), host: hostKind, ...(local ? { instanceId: local.instanceId } : {}) })); return; }
    const candidate = resolve(root, `.${pathname}`);
    if (!candidate.startsWith(root + sep) && candidate !== root) { response.writeHead(403).end('Forbidden'); return; }
    const file = existsSync(candidate) && statSync(candidate).isFile() ? candidate : extname(pathname) ? null : resolve(root, 'index.html');
    if (!file || !existsSync(file)) { response.writeHead(404).end('Build the client first with npm run build.'); return; }
    void serveStaticFile(request, response, file, mime[extname(file)] ?? 'application/octet-stream').catch(() => { if (!response.headersSent) response.writeHead(500); response.end(); });
  });
  const party = createRoomHub(server, games, { saveRoot: options.saveRoot, roomOptions: options.qa ? { seed: () => 20260908 } : {} });
  server.on('upgrade', (request, socket) => { if (!['/ws'].includes(request.url?.split('?')[0] ?? '')) socket.destroy(); });
  return { server, party, games, async close() { await party.close(); await new Promise<void>(done => server.close(() => done())); } };
}
