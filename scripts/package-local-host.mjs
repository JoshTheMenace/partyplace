import { buildCollection } from './build-collection.mjs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Packages the local host for the Mac that runs this script: prebuilt client, nine games, catalog,
 * bundled Node runtime, licenses, launcher and stop script. Output is immutable per run name under output/local-host/.
 */
const repo = fileURLToPath(new URL('..', import.meta.url)); process.chdir(repo);
const name = process.argv[2];
if (process.platform !== 'darwin') throw new Error('This packager produces a macOS app bundle and must run on macOS.');
if (!name || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(name)) throw new Error('Usage: node scripts/package-local-host.mjs unique-run-name');
const out = resolve('output/local-host', name), build = resolve(out, 'build'), folder = resolve(out, 'PartyPlay Local Host'), app = resolve(folder, 'PartyPlay.app');
const contents = resolve(app, 'Contents'), macos = resolve(contents, 'MacOS'), res = resolve(contents, 'Resources'), appRoot = resolve(res, 'app'), licenses = resolve(res, 'LICENSES');
mkdirSync(resolve('output/local-host'), { recursive: true }); mkdirSync(out); // Refuse an existing run.
const run = (command, args) => { const result = spawnSync(command, args, { stdio: 'inherit' }); if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} exited ${result.status}`); };
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/TOKEN|SECRET|KEY|PASSWORD/i.test(key)));

console.log('Building client and local host bundle…');
buildCollection(build, { ...env, VITE_PARTY_QA: '0', PARTY_QA: '0' });
for (const dir of [macos, appRoot, licenses]) mkdirSync(dir, { recursive: true });
cpSync(resolve(build, 'client'), resolve(appRoot, 'client'), { recursive: true, dereference: true });
cpSync(resolve(build, 'local-host.mjs'), resolve(appRoot, 'local-host.mjs'));
mkdirSync(resolve(appRoot, 'catalog')); cpSync(resolve('catalog/sources.json'), resolve(appRoot, 'catalog/sources.json'));

console.log('Bundling the Node runtime…');
const nodeSource = realpathSync(process.execPath), nodeTarget = resolve(res, 'node');
const archs = spawnSync('/usr/bin/lipo', ['-archs', nodeSource], { encoding: 'utf8' }).stdout?.trim().split(/\s+/) ?? [];
const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64';
if (archs.length > 1 && archs.includes(arch)) run('/usr/bin/lipo', [nodeSource, '-thin', arch, '-output', nodeTarget]); else cpSync(nodeSource, nodeTarget);
run('/bin/chmod', ['755', nodeTarget]);
const nodeVersion = process.versions.node;
const licensePath = process.env.PARTY_NODE_LICENSE ?? resolve('output/local-host', `node-v${nodeVersion}-LICENSE.txt`);
if (!existsSync(licensePath)) {
  console.log(`Fetching the Node.js v${nodeVersion} license text…`);
  const response = await fetch(`https://raw.githubusercontent.com/nodejs/node/v${nodeVersion}/LICENSE`);
  if (!response.ok || !(await response.clone().text()).includes('Node.js is licensed')) throw new Error(`Could not fetch the Node.js license (${response.status}). Set PARTY_NODE_LICENSE to a local copy.`);
  writeFileSync(licensePath, await response.text());
}
cpSync(licensePath, resolve(licenses, `Node.js-v${nodeVersion}-LICENSE.txt`));

console.log('Collecting third-party licenses…');
const seen = new Set(), parts = [];
function collect(pkg) {
  if (seen.has(pkg)) return; seen.add(pkg);
  const dir = resolve('node_modules', pkg); if (!existsSync(dir)) return;
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find(entry => /^(licen[cs]e|copying)/i.test(entry) && statSync(join(dir, entry)).isFile());
  parts.push(`${'='.repeat(78)}\n${meta.name} ${meta.version} — ${meta.license ?? 'see text'}${meta.homepage ? ` — ${meta.homepage}` : ''}\n${'='.repeat(78)}\n${file ? readFileSync(join(dir, file), 'utf8').trim() : `(no license file in package; declared license: ${meta.license ?? 'unknown'})`}\n`);
  for (const dependency of Object.keys(meta.dependencies ?? {})) collect(dependency);
}
for (const dependency of Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).dependencies)) collect(dependency);
writeFileSync(resolve(licenses, 'THIRD-PARTY-LICENSES.txt'), `Third-party packages bundled into PartyPlay Local Host (browser client and server).\nDeclared licenses and full texts follow. Fonts: see client/fonts/*-OFL.txt (SIL Open Font License 1.1).\n\n${parts.join('\n')}`);
writeFileSync(resolve(licenses, 'NOTICE.txt'), `PartyPlay Local Host\n\nThis folder contains the PartyPlay application, its nine bundled games, the curated catalog, and a copy of the Node.js runtime used to run it on this computer.\n\n- Node.js runtime: Node.js-v${nodeVersion}-LICENSE.txt (covers Node.js and the components it bundles).\n- Bundled JavaScript packages: THIRD-PARTY-LICENSES.txt.\n- Fonts (Lilita One, Nunito): SIL Open Font License 1.1, texts in app/client/fonts and app/client/games/kart-party/fonts.\n- Kart Party music (app/client/games/kart-party/music): recordings supplied by the PartyPlay project owner. No third-party license applies and separate redistribution terms have not been recorded; they are included for use with this application only.\n- PartyPlay application and game code: no open-source license has been declared. All rights reserved by the project owner.\n`);

console.log('Writing launcher…');
writeFileSync(resolve(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>PartyPlay</string>
<key>CFBundleDisplayName</key><string>PartyPlay</string>
<key>CFBundleIdentifier</key><string>place.party.localhost</string>
<key>CFBundleExecutable</key><string>PartyPlay</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>${new Date().toISOString().replace(/\D/g, '').slice(0, 12)}</string>
<key>LSMinimumSystemVersion</key><string>13.5</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
`);
writeFileSync(resolve(macos, 'PartyPlay'), `#!/bin/zsh
# PartyPlay local host launcher. Uses the bundled runtime only; nothing else needs to be installed.
HERE="\${0:A:h}"
DATA="\${PARTY_DATA_DIR:-$HOME/Library/Application Support/PartyPlay}"
mkdir -p "$DATA/logs" || { /usr/bin/osascript -e 'display alert "PartyPlay could not start" message "The PartyPlay data folder could not be created in Application Support." as critical'; exit 1; }
export PARTY_DATA_DIR="$DATA"
exec "$HERE/../Resources/node" "$HERE/../Resources/app/local-host.mjs" >> "$DATA/logs/local-host.log" 2>&1
`, { mode: 0o755 });
writeFileSync(resolve(folder, 'Stop PartyPlay.command'), `#!/bin/zsh
# Stops the PartyPlay local host started from PartyPlay.app through its verified stop handshake.
# It never signals a process id: the host must answer with the recorded instance identity and accept its stop token.
HERE="\${0:A:h}"
export PARTY_DATA_DIR="\${PARTY_DATA_DIR:-$HOME/Library/Application Support/PartyPlay}"
exec "$HERE/PartyPlay.app/Contents/Resources/node" "$HERE/PartyPlay.app/Contents/Resources/app/local-host.mjs" --stop
`, { mode: 0o755 });
writeFileSync(resolve(folder, 'README.txt'), `PartyPlay Local Host (macOS ${arch}, requires macOS 13.5 or later)

1. Double-click PartyPlay.app. Your browser opens the shared display at http://localhost:4350
   (or the next free port). Put that window on the TV or laptop everyone can see.
2. Phones on the same Wi-Fi scan the room QR code or open the address shown under "Phones on the same Wi-Fi".
3. Opening PartyPlay.app again while it is running only reopens the browser; it never starts a second copy.
4. To stop: Connection help in the browser on this Mac → "Stop hosting on this computer", or double-click
   "Stop PartyPlay.command". Stopping ends the room for everyone connected.

Game saves and logs live in ~/Library/Application Support/PartyPlay (world-saves/, logs/local-host.log).
They stay there if you delete or replace this folder.

Phones need the same Wi-Fi as this Mac; guest networks that isolate devices, VPNs and firewalls can block joining.
macOS may ask to allow incoming connections for "node" the first time.

This app is ad-hoc signed and not notarized. It was built and tested on the Mac that produced it; a copy downloaded
from the internet may be blocked by Gatekeeper until you allow it in System Settings → Privacy & Security.
Play without internet has not been tested yet.

Licenses for the bundled runtime, packages and fonts: PartyPlay.app/Contents/Resources/LICENSES/.
`);
const sign = spawnSync('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', app], { encoding: 'utf8' });
if (sign.status !== 0) console.warn(`Ad-hoc signing skipped: ${sign.stderr.trim()}`);

console.log('Zipping…');
const zip = resolve(out, `PartyPlay-Local-Host-macos-${arch}.zip`);
run('/usr/bin/ditto', ['-c', '-k', '--keepParent', folder, zip]);
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const bytes = walk(folder).reduce((sum, file) => sum + statSync(file).size, 0);
const manifest = { name, builtAt: new Date().toISOString(), platform: `macos-${arch}`, nodeVersion, app, zip, zipSha256: sha256(zip), zipBytes: statSync(zip).size, folderBytes: bytes, indexSha256: sha256(resolve(appRoot, 'client/index.html')), localHostSha256: sha256(resolve(appRoot, 'local-host.mjs')), publicGameAssets: readdirSync(resolve(appRoot, 'client/games')), signed: sign.status === 0 };
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nPackaged: ${app}\nZip: ${zip} (${(manifest.zipBytes / 1048576).toFixed(1)} MB, sha256 ${manifest.zipSha256.slice(0, 16)}…)\nVerify with: PARTY_LOCAL_HOST_APP="${app}" node --import tsx --test tests/local-host.test.ts`);
