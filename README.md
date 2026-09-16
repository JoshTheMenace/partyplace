# Party Place

Discovery, My Library and shared-room play.

My Library starts empty; Discover offers curated sources and explicit Add actions. The nine original games live in the separate [partyplay-games repository](https://github.com/JoshTheMenace/partyplay-games), pinned here as the `game-modules` submodule. See [repository setup](docs/REPOSITORIES.md) and [catalog curation](catalog/README.md).

## Run

On this Mac, double-click **PartyPlay** on the Desktop. It starts the server in the background and opens the dashboard at port 4361. Opening it again reuses the running server; closing the browser leaves games available to phones. A fresh start rebuilds the games in an isolated launcher directory and retains Blockwild autosaves in `output/world-saves`. Startup logs are in `~/Library/Logs/PartyPlay/launcher.log`; server logs are in `output/dashboard-launcher/server.log`.

To install the shortcut on another Mac after installing dependencies, run `node scripts/install-desktop-launcher.mjs`. It points at this checkout, so reinstall it if you move the repository. From a terminal, `node scripts/launch-dashboard.mjs` provides the same launch behavior.

Requires Node 22.13+ and npm:

```sh
git clone --recurse-submodules https://github.com/JoshTheMenace/partyplace.git
cd partyplace
npm ci
npm start
```

The launcher builds the browser app and one Node server, then prints local and LAN addresses. It does not open additional browser windows. The default port is 4317; choose an unused port with `PORT=4360 npm start`. For existing live sessions, use an isolated build instead of replacing their assets:

```sh
npm run build:isolated -- my-library-build
npm run serve:isolated -- my-library-build 4360
```

Open the printed address. Choose a game directly, or host a room and invite phones with its QR/code. A shared screen can be a laptop or TV. Solo and no-TV filters currently match Kart Party; the other eight games require a shared display and at least two players.

## Local host download

`npm run package:local-host -- <run-name>` builds a self-contained macOS folder under `output/local-host/<run>/`: `PartyPlay.app` with the client, all nine games, the curated catalog and a bundled Node runtime, plus `Stop PartyPlay.command`. Double-click the app on a Mac with nothing installed; the browser opens the shared display and phones join over the same Wi-Fi. Saves live in `~/Library/Application Support/PartyPlay`. Hosted and local builds are one application: `/api/health` reports `host: "hosted"` or `"local"`, and only a local host offers the loopback-only stop endpoint. Details, verification and limits: [docs/LOCAL-HOST.md](docs/LOCAL-HOST.md).

## Games

| Game | Players | Play style | Status |
| --- | --- | --- | --- |
| Kart Party | 1–10 | Solo or party kart racing; keyboard, touch and phone controllers | Playable |
| Blockwild | 2–10 | Open-ended voxel sandbox; personal first-person views | Playable |
| Kitchen Rush | 2–10 | Cooperative cooking across ten stages | Playable |
| Quip Clash | 3–10 | Write punchlines and vote | Playable |
| Sketch Bluff | 3–10 | Draw, invent captions and find the truth | Playable |
| Tall Tales | 3–10 | Invent believable lies around unusual facts | Playable |
| Shirt Show | 3–10 | Draw art, write slogans and vote on shirts | Playable |
| Odd One In | 4–10 | Find the guest bluffing through the questions | Playable |
| Quiz Panic | 2–10 | Trivia under pressure | Playable |

Collection games share one room and preserve seats when switching games. Kart Party has its own race lobby and code on the same server at `/kart-party/`. Opening it from an existing collection room asks the host to close that room first. Its menu has an **All games** link back to the dashboard. The original external Kart Party checkout and its existing sessions remain untouched.

Phones need a network that can reach the laptop. Guest Wi-Fi isolation, VPNs and firewalls may block joining. Remote hosting is not provided. Saved seats support reconnect; a disconnected collection host has a two-minute grace period. Blockwild worlds autosave on the server every 30 seconds and before normal teardown. Latest and previous worlds can be resumed from the lobby after everyone taps Ready; host controls still download/import permanent copies. Files live in `output/world-saves`, or `PARTY_SAVE_ROOT` if set. Isolated QA builds use their own save directory unless explicitly overridden. Kitchen campaign stars are saved in the host browser.

## Structure

- `apps/party-client`: dashboard, catalog, shared room and round UI.
- `apps/party-server`: one HTTP server routing the collection and Kart Party protocols.
- `packages/games/<id>`: eight collection modules with manifest, rules, UI and tests.
- `packages/games/kart-party`: Kart Party adapter, racing engine, tests and public assets, together beside the other games.
- `packages/party-*`: shared contracts, transport, UI and 3D support.
- `public/games/kart-party`: existing Kart fonts/music; other game assets live in their own folders.

Catalog capabilities are derived from collection manifests and Kart's explicit entry. Search/filter logic stays separate from presentation. No game rules or hidden content are imported into the dashboard. The shared server dispatches WebSocket upgrades by exact route so both room systems can coexist.

## Validate

```sh
npm run typecheck
npm run lint
npm run test:all
npm run build
```

Never run Prettier. `npm test` runs collection tests; `npm run test:kart` runs 350 retained Kart checks. Dashboard/filter and mounted-server tests live under `tests/`. Current dashboard integration and browser evidence: [dashboard QA](output/dashboard/QA.md). Current Blockwild Survival rework: [gameplay](packages/games/blockwild/SURVIVAL.md) and [QA](output/blockwild/SURVIVAL-QA.md). Earlier independent Blockwild/Kitchen release evaluation: [current status](output/production-review/STATUS.md) and [final QA](output/production-review/QA.md).

Use one browser QA owner at a time, prefer headless, and keep at most three visible QA windows across the batch. Preserve user sessions and close only owned resources. Physical phones, Wi-Fi load, TV viewing distance, accessibility certification and human group playtests remain distinct from desktop browser emulation.

Kart's existing music is included. Music for the other games remains reserved for the user. No deployment, staging, commits or pushes are implied by local builds.

Project architecture and contribution guidance: [agent handbook](docs/party-platform/AGENT-HANDBOOK.md), [UI contract](.agents/skills/party-platform-ui/SKILL.md), [3D readiness](docs/party-platform/3D-READINESS.md), [Kart Party](packages/games/kart-party/README.md).
