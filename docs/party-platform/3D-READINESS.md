# Building a 3D or continuous-input game

The shared prerequisites are implemented. Start from the [Scene Lab example](../../packages/games/scene-lab/README.md), which demonstrates one small server-authoritative arena with a shared 3D display and 2–10 phone controllers. It is a development fixture, available only in an explicit `--3d` build; the normal dashboard contains nine games. Current validation and device limits are in [the 3D QA report](../../output/3d-prerequisites/QA.md).

## Run the reference slice

From the repository root, choose a new run name and unused port:

```sh
npm run test:3d
npm run build:isolated -- my-3d-run --3d
npm run serve:isolated -- my-3d-run 4340
```

Open the printed URL on the shared display, choose **3D Scene Lab**, join 2–10 phones, and start. `--3d` enables both the example client and server registry entry; ordinary builds omit its client chunks. Every isolated run has its own immutable client directory and bundled server. Reusing a build name is rejected. `PARTY_ASSET_ROOT` is the server's explicit static-file root; `serve:isolated` sets it and the correct QA flag from `build.json`.

For the repeatable browser scenario, use a different unused port and the already-built run:

```sh
npm run qa:3d -- my-3d-run 4341
```

The runner starts its own room/server/browser, performs public UI flows, records reports/screenshots, and closes only its owned resources. It uses the installed Playwright CLI or `npx --package @playwright/cli`. `PARTY_PLAYWRIGHT_CLI` can point to a resolved CLI JavaScript entrypoint; do not commit a personal cache path. This is Chromium/emulated-touch evidence, not physical-device testing. QA seed injection is enabled only on the isolated example server; no reset, clock-skip, or hidden-state API is exposed to browsers.

## Implemented APIs

| Need | Use | Behavior |
| --- | --- | --- |
| Simulation | Manifest `simulation: {stepHz:60, snapshotHz:20, maxCatchUpSteps:6}` | Opt-in fixed steps; wall-clock deadlines advance across stalls, excess physics steps are discarded, retained steps use constant dt. Transport cadence has a separate monotonic clock. Existing games retain their 100 ms scheduling. |
| Held state | View `setInput(serializableState)` and `releaseInput()` | Latest state is coalesced and resent at up to 20 Hz. Release is immediate, schema-independent, sequence-checked, and maps to rules.neutralInput on the server. Reconnect, round changes, blur, hidden tab, unmount, and stale input clear holds. |
| Controllers | Shared `SteerPad`, `HoldButton`, `RotatePrompt` | Pointer capture, simultaneous thumbs, keyboard equivalents, cancellation, orientation fallback. Compose state in one ref; send the complete state, not partial fragments. Native focus changes clear keyboard holds without cancelling another touch pointer. |
| Readiness | Optional client `SceneView` with `SceneViewProps` | Shell mounts the display scene during preparation, waits for `onReady`, then retains it through play. `publicView` is null before rules.create. DOM-only clients retain the existing prepare + two-frame path. Default scene roles are display-only. A client may opt into `sceneRoles: ['display','controller']` for per-player 3D scenes; inactive late joiners do not mount a controller scene. |
| WebGL | `mountThreeScene` from `packages/party-3d/src` | Three.js renderer, shader compilation, first visible frame before ready, resize/camera callback, DPR cap (low 1 / balanced 2), context-loss failure, metrics, and renderer cleanup. Scene assets remain caller-owned. |
| Lifetime | `ResourceScope` from `party-runtime` | Abort signal, reverse-order idempotent disposal, owned disposables/listeners, immediate cleanup of late registrations. Use a child scope inside the scene effect. |
| Observation | `FrameMetrics`, `SnapshotBuffer<T>` | Bounded frame samples and delayed interpolation between authoritative snapshots; no extrapolation. Scene helper reports render calls, triangles, geometry/texture counts and load time. |

Source contracts: [manifest/rules/context](../../packages/party-contract/src/index.ts), [client module/scene props](../../packages/party-ui/src/index.ts), [round lifecycle](../../apps/party-client/src/round-runtime.tsx), [server scheduler](../../apps/party-server/src/room-server.ts), [Three helper](../../packages/party-3d/src/index.ts). Read actual exports before implementing. Both client and server need this platform version for new input/release and scene capabilities.

Simulation profiles accept integer step rates 15–120, snapshot rates 1–30 no greater than step rate, and catch-up caps 1–12. A game needing every physics step across a long stall must implement a different explicit policy; this bounded real-time loop intentionally prevents an unbounded catch-up spiral. Input is sampled at the server tick; do not decide hits, collision, score, laps, or winners in the renderer. Preserve the 80-message/second/socket and 256 reliable-actions/player/round limits. Repeated steering/fire belongs in held state, with game-owned rate limits, rather than a stream of reliable action IDs.

## Scene loading and lifetime

For per-device 3D, SceneViewProps includes playerId, viewRole, isHost, privateView, connected, setInput, releaseInput and sendAction. A controller SceneView uses the same first-frame barrier and lifetime as the display, while ControllerView supplies its playing HUD. Keep terrain/public preparation data in validated settings; the server-only round seed is deliberately unavailable before rules.create. Browser acceptance of a new per-device game is still required.

Use `prepare({role,signal,assetBase})` for abortable shared loading. For a heavy display, lazy-import its renderer from SceneView so controllers download only their controls. SceneView receives roster/settings during preparation and public snapshots during play. Keep setup in an effect keyed by round/signal; read changing snapshots and callbacks through refs. Do not rebuild the renderer on every snapshot.

Build scene, camera, and owned resources, then call `mountThreeScene`. Its `onReady` occurs only after `compileAsync` resolves and an actual nonzero, visible canvas frame renders. A loading screen is not readiness. The room waits for all required displays/controllers, then publishes a common future start; only then does rules.create run. A disconnected preparing screen must report ready again after reconnect. Failures/timeouts return the room to a visible retryable lobby.

The helper owns its animation loop, observer, renderer, and context. Register scene geometries, materials, textures, render targets, workers, timers and other resources in the game's scope. Honor loader aborts and use `scope.own` for resources that arrive late. Release only resources this scene owns. Do not close the room socket or dispose another game's shared assets. Context loss stops the round; retry creates a fresh renderer. Save-capable sandboxes retain a valid world at results after a graphics failure, with host controls to resume it through fresh scene preparation. Other interrupted rounds return to the lobby.

The shell disposes a round when its ID/module changes, it unmounts, or the connection resets. It stops held input with it. SceneView unmounts at results; results reconnect without constructing a world. Do not rely on cleanup running exactly once across browser reloads; make disposers idempotent.

Three.js is a rendering dependency, not a physics engine. The included arena uses simple tested circle/pillar/world-bound collisions. Choose another physics library only when the game needs it. The renderer helper uses the official [WebGLRenderer lifecycle and compileAsync API](https://threejs.org/docs/pages/WebGLRenderer.html).

## Contract for each new game

Prove one arena/track/room, one essential interaction, scoring, results and replay before expanding assets. In the [game brief](GAME-BRIEF.md), state:

- Axes, units, scale, world bounds, spawns, collision shapes, camera limits and any looping/tilted coordinate frame.
- Intended display hardware/browser, phone orientation, maximum players and rendered cameras, plus frame/input/load budgets.
- Disconnect, out-of-bounds, occupied-spawn, tie, checkpoint/order and missing-input behavior relevant to that game.

Test minimum and maximum rosters; inspect actual gameplay frames, readable silhouettes, occlusion, camera clipping, collisions, control cancellation, and multiple simultaneous events. Verify A → B → A, replay, aborted loading, and reconnect. Keep test fixtures separate from real network acceptance.

Measure frame-time distribution, slow frames, scene load time, input-to-visible response, network payload/cadence, and resources across repeated rounds. Include hardware/browser/settings/duration; draw calls alone do not prove performance. Test low graphics and reduced motion. Real phones, Wi-Fi contention, touch feel, thermal behavior, TV distance and group enjoyment require human playtests.

Shared-display play is implemented. Solo host-player views are implemented for Kart Party, Blockwild and Kitchen Rush. Kart reuses its existing split-screen renderer. Phones-only play, rigid-body physics, native builds and automatic asset pipelines remain game-specific work. Do not advertise them based on optional manifest fields. A shared camera is the default example, not a restriction on future games.


## Long sandbox sessions

Games may opt into manifest `sessionControls: ['save', 'finish']`. Rules provide `exportSave(state)` (versioned JSON with no credentials), `loadSave(ctx, raw, currentSettings)` (a validated fresh `{state, settings}` candidate), and `finish(state, nowMs)` (makes outcome complete). Import must not mutate live state on failure. The host Room menu offers Save world, file selection/confirmed replacement, and Finish session; authenticated GET/PUT `/api/round/save` caps JSON at 256 KiB. Save hooks own strict format/content validation. Loading starts a new round ID with retained seats, fresh inputs/actions and full scene preparation. Use imported seed/mode in returned settings so preparation generates the correct world. Play again starts a new world. The normal server also checkpoints save-capable worlds at startup, every 30 seconds and before normal teardown/shutdown. It stores private, atomic latest/previous-world files in `output/world-saves` (override with `PARTY_SAVE_ROOT`). A host can resume or download an autosave from the game lobby after everyone is connected and Ready. Recovery validates the same save format and creates a fresh round; resuming preserves the previous distinct world. Manual downloads remain the way to keep permanent copies. A crash may lose work since the last completed checkpoint. Storage failures are shown in the room. Isolated QA runs default to their own `world-saves` directory so fixtures cannot overwrite user backups.

For sparse world changes, `snapshotCache: {revisionField: 'revision', fields: ['edits']}` sends cached fields on first snapshot, every baseline revision change and reconnect. Unchanged revisions omit those fields on the wire; PartySession reconstructs the complete public view before rendering. Missing baselines request `snapshot.sync`. Keep revision monotonic for every edit-baseline change. This reduces repeated network payload, not simulation/projection CPU work. Private views are never cached this way. Avoid full-grid snapshots and bound distinct edited cells in game rules.


Large sparse pair arrays may additionally opt into `keyedPairsFields: ['edits']` inside `snapshotCache`. These fields contain unique `[nonnegativeIntegerKey, nonnegativeIntegerValue]` pairs. The transport diffs changed baselines per connection, sends insert/replace pairs and removed keys against an exact previous revision, and falls back to a full array for large rewrites. Client reconstruction preserves complete views; a missed base revision requests a full sync. Full reconnect baselines remain bounded by game world limits. Validate actual ten-player traffic and CPU work; this is not a general chunk streaming or interest-management system.


The server computes a public projection and terrain delta once per room revision/snapshot, then shares it across recipients. Each socket tracks its own baseline revision: current sockets receive the shared patch; fresh or lagging sockets receive the full baseline. Private projections remain per-player. This avoids rebuilding large edit maps separately for every phone.

Movement games use `orientation: { controller: 'landscape', personalView: 'landscape' }`. The shared round shell requires landscape on touch phones (coarse pointer, short side under 600px), releases held input and removes controller handlers while upright, and preserves the running scene/room. Keep movement at the left edge and actions at the right; show only immediate status between them. Lobbies, forms and results may remain portrait. The shared Kart Party module uses this gate too. Test rotation while holding movement and an action, then rotation back without phantom input.
