# Building games in this collection

Current workflow, 2026-09-08. This replaces the pre-implementation Kart Party proposal. Read [IMPLEMENTATION.md](IMPLEMENTATION.md) for current capabilities and [the UI skill](../../.agents/skills/party-platform-ui/SKILL.md) for visual and controller requirements. [The retrospective](RETROSPECTIVE.md) explains the observed failures behind this workflow; it is optional background.

## Establish the boundary

The authoritative interfaces are [party-contract](../../packages/party-contract/src/index.ts), [protocol](../../packages/party-contract/src/protocol.ts), and [React client exports](../../packages/party-ui/src/index.ts). Read those exports rather than copying a neighboring game's assumptions. There is no required local GAME-CONTRACT.md, AGENT-BRIEF.md, theme.reference.json, split-screen.ts, or racing controller API. Use [GAME-BRIEF.md](GAME-BRIEF.md) for assignments.

| Owner | Files and responsibility |
| --- | --- |
| Game owner | `packages/games/<id>/`: manifest, rules, content, public/private views, client, art, tests, README; scoped QA evidence |
| Platform/integration owner | `apps/`, shared `packages/party-*`, root configuration/dependencies, both explicit registries, launcher art/catalogue, shared builds and runtime |
| Coordinator, when assigned | Briefs, stable build handoff, independent acceptance, consolidated status; route shared defects to their owner |

For a solo assignment one agent may fill these roles. With concurrent agents, reserve ownership before edits and send one explicit `editing → source ready → built → verified` handoff per batch. Source-ready freezes that owner's files through the coordinated build and QA window until the builder explicitly releases the batch. To edit sooner, cancel readiness and wait for the builder to acknowledge cancellation before editing; an asynchronous withdrawal during a build is too late. Include the file, observed failure, viewport/state, and evidence path in repair requests. Avoid repeated near-identical status messages or declarations that a queued change is already built.

## Build a playable slice first

1. State the core action, round loop, target pacing, advertised modes/roster, input type, privacy needs, and orientation. Decide whether all-submitted phases advance after a readable minimum or intentionally use the full deadline; prove active play as well as timeout completion. Use the shared watching host and portrait controllers unless another mode is actually implemented.
2. Implement one complete round: join, ready, load, action, authoritative result, replay. Prove switching A → B → A preserves seats and clears old game state before treating a new platform feature as reusable.
3. Test rules with controlled time/seeds: valid/invalid actions, duplicate and stale submissions, score ties, disconnect policy, and public/private projections. Never runtime-import answer banks or server rules into browser code. The Vite import-graph guard is an additional check, not a replacement for correct projections.
4. Build the densest representative UI before expanding content or decorative work. Use every advertised seat, 16-character names, maximum input length, maximum distinct options including decoys, tied winners, and many voters on one result. Minimum-player success is not maximum-player acceptance.
5. Add content and game-specific art; preserve the shared interaction family. Run real browser flows and inspect renders, then repair observed issues. Music is currently reserved for the user.

The registry contract test checks initial public/private/outcome projections at every registered game’s minimum and maximum roster. Add game-owned coverage for later phases and optional data. Use the actual `assertSerializable` transport check: `JSON.stringify` alone silently drops undefined properties and will miss runtime rejections. Omit absent optional properties rather than assigning undefined.

The existing six games use reliable actions and server deadlines. A game owns its turn ID as well as the platform's round ID. Save unfinished inputs deliberately and scope drafts to player/round/turn; an accepted action must stay locked after reload. Use current shared drawing normalization/limits, not a second drawing protocol.

## Build and QA ownership

Current root commands are `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:platform`, `npm run test:kart`, and `npm run build`. Inspect package scripts before running them; none may invoke Prettier. Focus game tests with `node --import tsx --test packages/games/<id>/tests/*.test.ts` after replacing the ID. Run a full integration build/check when shared contracts or integration change, not repeatedly for unchanged rules after every CSS adjustment.

`npm start` always builds before launching; `npm run dev` watches the backend source but does not rebuild browser assets. For an existing built bundle, an isolated QA server uses `PORT=<reserved-port> node dist/server.mjs`. Do not restart the user's server just to refresh client files. Server changes require a planned restart; this loses its in-memory room.

Different ports isolate rooms, **not assets**. The default `dist/client` is still mutable and Vite empties it on rebuild. Use the implemented isolated build/serve commands below whenever a live session must remain protected. `PARTY_ASSET_ROOT` selects the server's independent static tree. Never rebuild a run's assets while its pages are active; the isolated builder refuses existing run names.

During concurrent work:

- One integration owner announces and owns the build/QA window, then builds only after every editing owner reports coherent saved source and freezes its files.
- Publish the client entry hash and exact included fixes. Freeze builds during timed browser scenarios; queue subsequent repairs for one batch.
- At a safe boundary, deliberately reload the host and phones, verify the new hash and retained seats, then run the scenario. Use the visible Refresh and reconnect recovery if old chunks fail. Never reload a user's live round automatically.
- Record source-ready, built, and browser-verified separately. Finish with one current-state report; keep earlier failures in a history section.


### Isolated QA build

From the repository root, choose a unique run name and an unused port:

```sh
npm run build:isolated -- unique-run
npm run serve:isolated -- unique-run 4335
```

Add `--3d` to the build command to enable the development Scene Lab. Each run has its own `output/builds/<run>/client`, server bundle and build.json fingerprint. The serve command sets the asset root and matching registry flag. Use `npm run qa:3d -- <3d-run> <unused-port>` for the repeatable browser scenario. Keep these directories inside the repo so external server packages resolve correctly. Promotion or a live backend restart is a separate integration step and discards the in-memory room.

## Reliable browser checks

Use the available browser automation skill/tool. Record a unique session name, reserved port, owned server/daemon PID or exec session, room, build hash, and evidence directory. Check port availability without killing its owner. Never run global browser close/reset/kill commands while other tasks may be active.

The cached Playwright CLI used in this batch unlinked a session socket after any connection failure, including sandbox EPERM. A global `list` could affect other sessions. Run scoped CLI commands only with permissions that can reach that socket; obey the current execution policy (do not supply escalation flags when prohibited). If a session vanishes, inspect its recorded process before stopping only that process. Do not infer an app crash from a lost automation socket. Resolve the installed CLI path once per run; do not hardcode a personal npx cache path into project guidance.

A fresh browser may have lost its room credentials while the server still owns the old room. Resume with the retained profile, close an owned room through UI, or restart only the isolated QA server. Do not create a new shared-platform bug from test-session loss.

Keep at most three visible QA windows across concurrent tasks: one active owner, one host and two phones. Reuse that small set, and close owned browser sessions when the owner returns to source work. Run maximum-roster scenarios headlessly so ten phones do not create ten visible windows; still inspect screenshots and label hardware/emulation limits. Coordinate browser ownership separately from source ownership. Never close user windows or use global browser cleanup.

Use actual UI joins, readiness, submissions, votes, and replay for acceptance. Split timing-sensitive checks into bounded scripts that capture the phase and act immediately; inspect screenshots afterward. Do not pause for image review until the voting deadline expires and then call the timeout a gameplay defect. A deterministic fixture/clock can support isolated rule or layout tests, but label it as such and still prove a real end-to-end round without hidden-state injection.

Capture layout metrics and representative screenshots together. Inspect screenshots; document height alone can miss clipped descendants, overlapping cards, animation blanks, or a misplaced canvas hit area. Count accepted submissions/votes so a zero-vote timeout game is not described as a fully voted game. Retest the affected state after a repair; do not repeat an unrelated ten-minute game when focused evidence plus the prior complete flow suffices.

## Handoff

Report the current build and implementation status first, important decisions, run commands, actual tested roster/content/viewports, scoring/replay evidence, and remaining device/performance limits. Link one game README and one current QA report rather than scattering contradictory completion claims. Close only owned test rooms/browsers/servers; preserve the user's runtime. No git publication without its separate authorization.

For 3D or continuous-input work, apply [3D-READINESS.md](3D-READINESS.md) before committing to an engine, timing model, or ten-camera scene. Kart Party was rebuilt from scratch: its deterministic simulation (`src/sim`), courses (`src/tracks`), prediction/interpolation (`src/net`), renderer (`src/render`) and UI (`src/ui`) are described in `packages/games/kart-party/DESIGN.md`, with a local render sandbox in `dev/`. All nine games use the same room and `/ws` connection. The `/kart-party/` landing route redirects into PartyPlay. The old standalone reference is historical only; use the current module and its tests for racing behavior.
