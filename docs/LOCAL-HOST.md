# PartyPlay Local Host

A downloadable folder that hosts the full PartyPlay library on one Mac: the shared display, the room server and all nine games, with a bundled runtime. Nothing needs to be installed first: no Node, npm, Git or checkout. Phones on the same Wi-Fi join exactly as they do with the hosted site.

Status, 2026-09-10: first slice. Produced and tested on this Apple silicon Mac only. Requires macOS 13.5 or later, the minimum for the bundled Node.js 24 runtime. It bundles the games compiled into the app; installing additional games or remixes into a local host is later work.

## What the user gets

`PartyPlay Local Host/`
- `PartyPlay.app`: double-click to start. Opens the browser at `http://localhost:4350` (or the next free port) and prints phone URLs to the log. Opening it again while running only reopens the browser; it never starts a second copy.
- `Stop PartyPlay.command`: double-click to stop the host from Finder.
- `README.txt`: the short version of this page.

Inside the app: `Contents/Resources/node` (Node.js runtime, thinned to this Mac's architecture), `Contents/Resources/app/` (`local-host.mjs`, `client/`, `catalog/sources.json`) and `Contents/Resources/LICENSES/` (Node.js license, bundled package licenses, notice for fonts and music).

User data never lives in the folder. Default location: `~/Library/Application Support/PartyPlay/` with `world-saves/` (per-room autosaves, same format as the hosted server), `logs/local-host.log`, `instance.json` (port, pid, a random instance id and a random stop token for the running host, mode 0600) and a transient `startup.lock`. Deleting or replacing the folder keeps saves. `PARTY_DATA_DIR` overrides the location.

## Stopping

Any of:
1. Connection help in the browser on the hosting Mac shows "Running on this computer" with **Stop hosting on this computer**. Phones see "Hosted on a computer on this network" and no button.
2. `Stop PartyPlay.command` in the downloaded folder.
3. Terminal: `PartyPlay.app/Contents/Resources/node PartyPlay.app/Contents/Resources/app/local-host.mjs --stop`.

Every path uses the same verified handshake and none of them signals a process id. The stop request must arrive on a loopback socket with a loopback `Host`, and must either be a same-origin browser request whose `Origin` also names this machine, or carry the recorded stop token as a bearer header. Any other site name in `Host` or `Origin` (DNS rebinding) and any LAN address is refused with 403; a hosted server answers 404. The command line first confirms through `/api/health` that the answering host reports the instance id in `instance.json`; if it does not, the record is treated as stale and removed without touching whatever is on that port. Stopping ends the room for everyone connected.

Two launches racing on the same data directory are serialized by `startup.lock`. Dead owners and incomplete locks abandoned for over 30 seconds are reclaimed; a live starter keeps its lock, and another launch gives up after 15 seconds. A freshly created, incomplete lock is allowed time to record its owner. A second launch reuses the running host only when health returns the same instance id.

## Building the distribution

From a checkout with dependencies installed, on macOS:

```sh
npm run package:local-host -- <unique-run-name>
```

Output under `output/local-host/<run>/` (ignored by Git): `PartyPlay Local Host/` folder, `PartyPlay-Local-Host-macos-<arch>.zip`, `build/` (the client and bundles it was made from) and `manifest.json` with SHA-256 hashes. The script refuses an existing run name. It copies the Node runtime that ran it, so build on the kind of Mac you are shipping to. The Node.js license text is fetched once from the Node.js repository and cached under `output/local-host/`; set `PARTY_NODE_LICENSE` to a local copy to build offline.

The same `npm run build` used for the hosted server now also emits `local-host.mjs`, so hosted and local use one build of one application. `apps/party-server/src/app.ts` is the shared application; `main.ts` is the hosted entry; `local-host.ts` is the packaged entry.

## Verifying a package

```sh
PARTY_LOCAL_HOST_APP="$PWD/output/local-host/<run>/PartyPlay Local Host/PartyPlay.app" node --import tsx --test tests/local-host.test.ts
```

The packaged test launches the app with no Node on `PATH` and a temporary `PARTY_DATA_DIR`, waits for `/api/health` to report `host: "local"` with nine games and the recorded instance id, fetches the catalog, the page and a bundled Kart asset, launches again and confirms reuse, runs `Stop PartyPlay.command` against a record with a forged identity and confirms the host is untouched, then runs it against the real record and confirms the process exits and the record is removed. It also checks the stop token never appears in the log. Without the variable the test is skipped. Unit tests cover the authorization matrix (malformed Origin and Host, foreign Origin, rebinding Host, LAN sockets, wrong token, hosted 404) and four concurrent launches on one data directory.

## Limits of this slice

- macOS 13.5 or later, Apple silicon build, tested only on the Mac that produced it. Intel Macs would need a package built on an Intel Mac. No Windows or Linux artifact exists.
- Ad-hoc signed, not notarized. Gatekeeper may block a copy downloaded from the internet; how a given macOS version lets the user allow it has not been tested here.
- Not tested on a clean machine or with the internet disconnected. The design needs no internet, but that is an untested claim until Codex or the user runs it.
- Phone URLs are plain HTTP on the LAN, as with `npm start`. Guest networks with client isolation, VPNs and firewalls can block joining. macOS may show a firewall prompt for `node` on first launch.
- No update mechanism: replace the folder with a new package. Saves are unaffected.
- The nine games are compiled in. Adding a game means a new package; remixes and installable releases are not part of this slice.
- Browser QA of the local host UI (Connection help wording on host and phone, stop button) is owned by Codex and recorded separately.
