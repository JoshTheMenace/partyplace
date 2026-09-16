import { resolve } from 'node:path';
import { createPartyApp } from './app';
import { discoverPartyAddresses, parsePublicOrigin } from './network-address';
/** Hosted entry: identical environment contract to before; the application itself lives in app.ts. */
const port = Number(process.env.PORT ?? 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const app = createPartyApp({ port, assetRoot: resolve(process.env.PARTY_ASSET_ROOT ?? 'dist/client'), saveRoot: resolve(process.env.PARTY_SAVE_ROOT ?? 'output/world-saves'), publicOrigin: parsePublicOrigin(process.env.PUBLIC_ORIGIN), qa: process.env.PARTY_QA === '1' });
app.server.on('error', error => { console.error(`Party server could not start: ${error.message}. If the port is occupied, run PORT=4318 npm start.`); process.exitCode = 1; void app.party.close(); });
app.server.listen(port, '0.0.0.0', () => { console.log(`Open the shared display: http://localhost:${port}`); const { urls } = discoverPartyAddresses(port); for (const url of urls) console.log(`Phones on the same Wi-Fi: ${url}`); if (!urls.length) console.log('No LAN address found. Connect this computer to Wi-Fi and reload the lobby.'); });
process.once('SIGINT', () => void app.close()); process.once('SIGTERM', () => void app.close());
