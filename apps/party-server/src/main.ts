import { resolve } from 'node:path';
import { createPartyApp } from './app';
import { discoverPartyAddresses, parsePublicOrigin } from './network-address';
/** Hosted entry: identical environment contract to before; the application itself lives in app.ts. */
const port = Number(process.env.PORT ?? 4317);
const host = process.env.HOST?.trim() || '0.0.0.0';
const publicOrigin = parsePublicOrigin(process.env.PUBLIC_ORIGIN);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const app = createPartyApp({ port, assetRoot: resolve(process.env.PARTY_ASSET_ROOT ?? 'dist/client'), saveRoot: resolve(process.env.PARTY_SAVE_ROOT ?? 'output/world-saves'), publicOrigin, qa: process.env.PARTY_QA === '1' });
app.server.on('error', error => { console.error(`Party server could not start: ${error.message}. If the port is occupied, run PORT=4318 npm start.`); process.exitCode = 1; void app.party.close(); });
app.server.listen(port, host, () => {
  const address = (app.server.address() as { address: string }).address;
  const localHost = ['0.0.0.0', '::'].includes(address) ? 'localhost' : address.includes(':') ? `[${address}]` : address;
  console.log(`Open the shared display: ${publicOrigin ?? `http://${localHost}:${port}`}`);
  const { urls } = publicOrigin ? { urls: [publicOrigin] } : discoverPartyAddresses(port, undefined, undefined, undefined, address);
  for (const url of urls) console.log(`Phone join address: ${url}`);
  if (!urls.length) console.log('No phone-accessible address. Use PUBLIC_ORIGIN behind a reverse proxy, or bind to a LAN interface.');
});
process.once('SIGINT', () => void app.close()); process.once('SIGTERM', () => void app.close());
