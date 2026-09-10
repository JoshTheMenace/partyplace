import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('The desktop app installer requires macOS.');
const app = resolve(homedir(), 'Desktop/PartyPlay.app');
await mkdir(app); // Never replace an existing app.
const contents = resolve(app, 'Contents');
await mkdir(resolve(contents, 'MacOS'), { recursive: true });
await writeFile(resolve(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>PartyPlay</string>
<key>CFBundleDisplayName</key><string>PartyPlay</string>
<key>CFBundleIdentifier</key><string>local.partyplay.launcher</string>
<key>CFBundleExecutable</key><string>PartyPlay</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSUIElement</key><true/>
</dict></plist>\n`);
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
await writeFile(resolve(contents, 'MacOS/PartyPlay'), `#!/bin/zsh
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p "$HOME/Library/Logs/PartyPlay"
if ! ${quote(process.execPath)} ${quote(fileURLToPath(new URL('./launch-dashboard.mjs', import.meta.url)))} "$@" >> "$HOME/Library/Logs/PartyPlay/launcher.log" 2>&1; then
  /usr/bin/osascript -e 'display alert "PartyPlay could not start" message "Details are in Library/Logs/PartyPlay/launcher.log in your home folder." as critical'
  exit 1
fi
`, { mode: 0o755 });
console.log(`Installed ${app}`);
