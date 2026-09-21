# Night Job: Monaco-style cooperative heists

2026-09-20 · Original design plan, now implemented; acceptance evidence is tracked in [the QA report](../verification/night-job.md). Working title and module ID: `Night Job` / `night-job`. [Research and sources](../party-platform/MONACO-RESEARCH.md).

Build a close-feeling adaptation of the 2013 Monaco: top-down pixel environments, schematic darkness, colorful sight reveals, simple specialists, and recoverable heist chaos. Author new levels, sprites, characters, dialogue, and effects. The user requested research followed by a plan, and authorized Claude Fable consultation for presentation, architecture, and complicated code. The design below records the planning decisions; the final implementation and tested limits are documented in the game README and QA report.

## Product decisions

| Area | Proposed default |
| --- | --- |
| Players | 1–4 cooperative phone players; one phone is supported; the host uses no seat. |
| Devices | Dedicated TV/laptop map and landscape phone controllers. Phones show controls and status only. |
| Main loop | Select mission and specialist → ready → enter → steal objective and optional loot → evade/rescue → escape → results → replay. |
| Pacing | Approximately 4–8 minutes per job after learning it; stopwatch, not an automatic failure countdown. |
| Initial release scope | Three authored heists, eight specialist equivalents, meaningful security and tool choices, results and replay. |
| First development milestone | One finished job with four roles, smoke, guards, locks, sight, loot, rescue, escape, and replay. This is a development gate, not the finished content scope. |
| Graphics | 2D pixel sprites and cached Canvas layers; accessible React menus and controller UI. |
| Visibility | Team-shared sight on the TV. Hidden NPC state stays on the server. |
| Music | User-supplied later; implement sound effects and audio-state hooks. |

The user clarified during implementation that the main host/TV must show the map and each phone must be the controller. This supersedes the original seated-host and phone close-up proposal. Other design defaults were inferred from the requested fidelity and this platform. Prioritize sight, motion, and chase recovery before expanding content.

## The first heist

**The Velvet Ledger:** steal a casino annex's accounting ledger and reach the getaway van. The main route passes a staffed reception and a locked counting room. A service passage offers a longer, quieter route. The cashier's office holds optional money near a patrol, and a small courtyard provides a place to lose pursuit. A teammate can hold a route open while another risks the safe.

Start with Cracker, Scout, Magpie, and Ghost, mirroring the functions of the original starting quartet. Everyone can open the required locks, use smoke, collect the ledger, and escape. Specialists make different routes attractive. Taking the ledger changes the objective to escape; detection raises pressure without ending the run.

Acceptance example: four real clients join and choose roles, one player opens the counting room, another takes optional money, a guard detects the crew, smoke breaks sight, one teammate is revived, and everyone escapes. The result shows the collected objective, loot, elapsed time, and team success; Play again starts a clean round with the same seats.

Later locations:

- **Glasshouse Exchange:** an auction conservatory with glass sightlines, camera circuits, valuable side rooms, and a service passage.
- **Last Ferry:** a waterfront customs house with exposed quays, a records vault, and a boat escape.

Add multi-floor transitions only after single-floor acceptance. The crew must gather at the same transition; carry health, equipment, and collected loot forward and persist each floor's changed state. Never move a player into a floor another required teammate cannot reach.

## Art and presentation contract

Use a true overhead camera. Build an original atlas with floor materials, thick readable walls, doors, window frames, furniture, signs, plants, safes, terminals, loot, crew, and guards. Start with 16-pixel tiles as an experiment, not a claim about Monaco's original resolution. Put pixel edges on integer positions and disable image smoothing.

Render layers in a deliberate order: muted schematic floor plan; colored world clipped to team sight; visible actors and hazards; authorized intelligence markers; bounded effects; crisp labels and HUD. Unseen architecture can remain known, but current hidden guard positions cannot. The Scout's marker is a separate intentional information channel, not full world reveal. Known static objectives and remembered architecture must be distinguished from current dynamic information.

For the first job, author a compact floor around 32×18 tiles and target a 640×360 logical composition on a 1280×720 display. Reserve space around the map for the HUD. At 2× scale a 16-pixel tile is 32 screen pixels. Prove that four bodies, narrow doorways, suspicion symbols, progress rings, and loot remain distinguishable before fixing the dimensions. Provide an integer-scale fallback with letterboxing for other display sizes.

Use one shared full-floor camera. Players may separate without tethering or losing their character offscreen. Phones show movement, tools, and personal status, with no map or per-device canvas. A one-player run still uses one phone plus the host display. The host is never a thief seat. Integer backing pixels and nearest-neighbor presentation fit the full floor into the available HUD gap at 1280×720.

Most of the screen belongs to the heist. A compact roster carries crew identity, health, and downed state; the mission objective, stopwatch, and loot are readable at a glance. Put interaction progress next to its actor. Color pairs with a role icon and seat number. The shared shell retains room controls and joining; gameplay art gets its own identity without replacing the platform's accessible control primitives or font tokens.

Animation must explain state: short walk cycles, a working pose and progress ring at locks, loot movement into a bag, suspicion filling, a sharp detection pulse, smoke growth and dissipation, a rescue indicator, and an escape tally. Reduced motion removes camera shakes and decorative loops while preserving all state cues. No long intro before replay.

Blender is optional for a complicated vehicle or prop baked into the atlas. Hand-authored 2D sprites are the default. A live 3D camera and model pipeline would add work without improving the targeted overhead look.

## Controls and interaction rules

- Phone: left movement pad, right large Tool button, smaller held Sneak control, compact health/tool/role information between them. Contextual work begins by pushing toward its target. Minimum 48px action targets where space permits.
- Host: dedicated map, room controls, settings, start, and replay. No character controls. Phone movement pads retain the shared keyboard equivalents for accessibility on a controller browser.
- Input is one complete `{x, y, sneak}` held state. Normalize diagonals and validate finite values. Neutral is `{x: 0, y: 0, sneak: false}`. `releaseInput()` handles cancellation; do not assume `null` releases movement.
- Tool use is an acknowledged action with the current game-owned `heistId`. Block another press while pending. The server validates life state, equipment, charges, phase, and cooldown; retries cannot consume another charge.
- Tranquilizer and shotgun use drag-to-aim/release on the right, with the shared map showing facing. Normalize the screen-space drag to a world direction; the overhead map has no camera rotation.
- Interaction targets are chosen by a short forward contact test with stable tie-breaking. Work cancels on movement away, incapacitation, or invalidation. First version: no stacking several workers to multiply speed; each thief works independently and the first completion wins atomically.
- Lock duration starts at three seconds, one for Cracker; these are tunable reference-informed values. Never let the renderer complete a door, grant loot, revive someone, or decide detection.

Use shared `SteerPad` and `HoldButton` where their behavior fits. A game-owned input composer must preserve simultaneous thumbs and clear state on pointer cancellation, lost capture, blur, hidden tab, orientation gate, disconnect, and unmount.

## Rules and failure recovery

The simulation owns collision, visibility, guard knowledge, noise, interaction progress, loot, charges, health, and results. Map units are tiles; x increases right and y down. Actors move continuously, not in grid steps, and are circles smaller than a doorway. Walls and solid props use tile collision, players do not block each other, and spawns are validated walkable cells. Clamp movement within the map and normalize diagonal speed. Separate sight-blocking, movement-blocking, and sound behavior: glass passes sight while blocking movement; closed doors differ from open doors; breaking glass makes noise. Use one tested geometry/visibility definition rather than unrelated server and renderer approximations.

Guards move through patrol, investigate, suspicious, chase, search, and return states. Randomized destinations come from the round seed. A guard remembers a last seen or heard position, never a permanently tracked player coordinate. Hearing sends guards to a noise event's location; it does not grant sight. Smoke, hiding, doors, and corners must allow recovery. A discovered hiding place remains unsafe while that pursuer has evidence.

A downed connected teammate needs a timed rescue before team extraction. All connected active thieves must be alive and in the escape zone with the objective secured. An all-downed crew loses; solo uses a clean retry rather than an invented automated rescuer. This solo policy is an explicit adaptation pending original-game comparison.

Disconnect immediately clears input. Keep the body vulnerable for a proposed 15-second reconnect grace. After grace, suspend the absent body, return any unique mission item to a validated reachable cell, and exclude that seat from extraction requirements. Reconnecting before completion returns the same role and inventory without restoring health; after completion it shows results. A downed state remains downed, and suspension never grants vision. If every player disconnects, freeze game-owned progress and retain the round for reconnect; do not grant automatic victory. The shared scheduler keeps running, so track suspended time explicitly for the stopwatch and game deadlines. The room closes after its host has been absent for two minutes; this game does not extend that lifetime. New seats during a round spectate until the next round.

The full release adds Breacher, Impostor, Wire, and Face. Every released mission has a viable path for every role; no objective requires a particular specialist. Allow duplicate roles initially because the current per-seat lobby parser cannot arbitrate cross-seat exclusivity. Distinguish duplicates with seat number/name. Unique-role selection would require a separately tested cross-roster rule.

Team loot determines the shared result, while personal pickup totals replenish that player's equipped tool every ten coins. Author coin trails as route guidance, with tempting branches into risky rooms. Each loot object is consumed once, with deterministic same-tick tie-breaking. Companion pickups credit their owner. Tool swaps and reconnects cannot create free charges; floor transitions preserve charge and pickup counters. Full-clear is optional. Start adjusted scoring at elapsed seconds plus ten per missed ordinary loot unit; display the breakdown and label it a proposed rule until reference verification. All teammates share success; contribution statistics do not rank a teammate above the crew.

## Runtime architecture, checked against source

The pinned game submodule was initialized to `cb766b4572aaae5df3da0b1b2f48c7a9c33faf8f` for this review. Actual registries contain fourteen normal games; older handbook counts of nine are stale. Treat current TypeScript exports as authoritative.

Use `GameRules` from `packages/party-contract/src/index.ts` and `GameClientModule` from `packages/party-ui/src/index.ts`. Register a `shared-display` game with one to four phone seats and landscape play; disable the platform’s seated-host solo mode. Proposed simulation profile: 30 steps/second, 20 snapshots/second, four maximum catch-up steps. These are starting budgets to measure, not achieved performance.

Use simulation dt for movement and authoritative timestamps for timed work, suspicion recovery, and smoke expiry. The runtime drops excess physics steps after stalls; counting steps for deadlines would make elapsed time inconsistent. Apply the explicit all-absent pause offset to game deadlines.

Use the existing `parseLobbyChoice` and `LobbyView` for specialist choice and the shared Ready lifecycle. Mission selection belongs in validated settings. `create()` runs only after the existing preparation barrier and common start. Settings must accept `{}` and return defaults.

Mount the 2D renderer through `SceneView`; the interface does not require Three.js. Only the dedicated host display renders the world. Use the default display-only scene role; phones remain DOM controllers throughout. This remains shared-display play, not a new phones-only platform mode. Prepare the selected public map/atlas before start, show a real first canvas frame, then invoke `onReady`. During preparation `publicView` is null and the round seed is unavailable. Keep public preparation data in validated settings or an explicitly safe client map module.

Inspect `packages/games/phonedig/src/camera.ts` and `light.ts` as the closest existing Canvas precedents: camera state per instance, resets on world/level changes, pixel quantization, reusable offscreen buffers, and cached glow sprites. Reuse these patterns, not the digging game's coordinates or soft lighting mask as our authoritative sight mask. Sharp occlusion and optional low-resolution glow are separate passes.

`DisplayView` supplies the shared HUD; `ControllerView` supplies phone controls; `ResultsView` presents the team outcome. Reuse `ResourceScope` for animation frames, observers, listeners, and assets. The Night Job manifest disables seated-host play; the host remains a display. Use host/display ownership to prevent duplicate audio.

Important transport constraint: every socket receives the same `publicView`. It must contain only shared team knowledge: crew state, visible entities, permitted static map data, collected/changed objects, objective status, and explicit Scout markers. Full guard state, destinations, future patrol choices, and unseen dynamic events remain server-only. `playerView` may be null for the initial shared-information game. Rendering a full enemy list behind CSS or a fog mask is insufficient.

Separate geometry, visibility, navigation, simulation, and presentation without building a general-purpose engine:

| Game-owned file/group | Responsibility |
| --- | --- |
| `manifest.ts`, `types.ts`, `settings.ts` | Standalone metadata, wire types, public settings and constants |
| `maps/` | Authored floor geometry, objects, circuits, spawn and route validation |
| `geometry.ts`, `visibility.ts`, `navigation.ts` | Collision/occlusion rules and bounded pathfinding |
| `simulation.ts`, `server.ts` | Pure game steps, AI and mechanics; thin lifecycle adapter and projections |
| `render/` | Atlas, canvas layers, camera, visibility presentation, effects and snapshot presentation |
| `client.tsx`, `controls.tsx`, `style.css`, `audio.ts` | Shell integration, lobby, HUD, controls, results and effects audio |
| `tests/`, `README.md`, `assets/` | Rule/transport coverage, run instructions, authored art and provenance |

Only create separate files when responsibilities warrant them. Safe geometry helpers and known floor plans may be shared with clients; separate them from server-only NPC placements, patrol choices, and unrevealed content. Server rules and hidden content may not be runtime-imported by client code.

Cache static art. Send bounded dynamic data, not full grids every snapshot. Use snapshot caching for a static layout only if needed, with an explicit monotonic revision. If discovery memory needs a bitset, bound it by the authored floor size. A cache revision must advance for every cached field change, including doors and loot, not just new discovery. Start with a maximum of 24 NPCs, 256 ordinary loot units, and 64 interactive objects per floor; validate authored content and increase caps only after profiling. Target a full reconnect snapshot below 16 KiB and measure the actual result. The platform's 32 KiB incoming-message limit is not evidence of a universal outgoing snapshot limit.

Reuse bounded snapshot interpolation. Do not interpolate a newly visible guard backward through a wall or keep drawing one after visibility is revoked. Group visibility and actor transforms from a coherent snapshot. Snap at teleport/floor/discontinuity boundaries. Client collision prediction is optional only after measurement, and may not predict sight, loot, or detection. There is no assumed generic prediction/reconciliation API.

## Build order and acceptance gates

1. **Reference and visual prototype.** Render one richly furnished room, corridor, and courtyard with the four-player maximum and readable sight boundaries at 1280×720. Compare with the linked original imagery. Resolve pixel scale and HUD density before producing more assets.
2. **Complete first job.** Implement authoritative movement, push interactions, locks, loot, smoke, guards, detection/recovery, downing/rescue, objective, escape, results, and replay. Prove one-phone and four-phone join-to-results flows through the real room UI. Bring the visual prototype into this playable slice.
3. **Hard cases and feel.** Validate dedicated phone controls with the TV map. Test split-up crew, competing interactions, wall corners, smoke boundaries, pending actions, disconnects, reloads, held-input cancellation, and A → another game → A. Measure touch-to-visible response, not just frame rate. Have Fable review the tricky visibility/AI code and actual screenshots.
4. **Expand systems.** Add circuits, cameras, lasers, hacking, destructible eligible walls, disguise, distraction, remaining roles, and a compact tool set: smoke, medical kit, tranquilizer, wrench, EMP, and a noisy weapon. Add one system at a time with a mission use and a solo route.
5. **Expand content and finish.** Build the other two jobs, multi-floor state where useful, original briefings, effects, original catalog art, settings/instructions, and full results. Replay and mission selection stay in the shared room lifecycle. Record any deferred features explicitly.

Focus tests on invalid/nonfinite input, stale/duplicate tool actions, simultaneous pickups, completed interactions, occlusion at corners/doors/smoke, guard memory, role abilities, revised navigation after wall changes, downed/disconnected extraction, solo loss, score calculation, and serializable projections. Assert hidden enemies and AI state are absent from transport. Use the actual `assertSerializable` helper.

Every new mission needs a complete real playthrough and replay, plus maximum-roster coverage and route checks for every role. Test role duplicates, 16-character names, maximum legal entity counts, crowded doors, simultaneous smoke/rescue/alarm, and results with equal team outcomes.

Relevant checks, after inspecting scripts for forbidden formatters:

```sh
node --import tsx --test packages/games/night-job/tests/*.test.ts
npm run typecheck
npm run lint
npm run test:platform
npm run build:isolated -- night-job-<unique-run>
npm run serve:isolated -- night-job-<unique-run> <unused-port>
```

Run the broader relevant suite for integration changes. Never run Prettier. Search for and use the requested code-golf skill after implementation changes; it was not found in the installed skill locations during planning. If still unavailable, report that and perform a manual simplicity review without claiming to have run it.

One owner controls browser QA and builds. Freeze coherent source during immutable builds and timed tests; use owned rooms and servers, no shared asset overwrite, and at most three visible windows. Use headless additional clients for four-player checks. Cover phone viewports 320×568, 390×844, 667×375, 844×390 and displays 1280×720, 1920×1080. Portrait gameplay must release controls and show the rotation fallback; lobby and results stay usable.

Provisional targets: 60fps display rendering, p95 frame time below 20ms at the maximum content budget on the recorded test machine, comfortably below the platform's 20-second preparation timeout, and measured LAN input-to-visible p95 below 150ms. Also test 100ms RTT and moderate jitter, and report actual snapshot sizes and CPU costs. Repeated replay must not accumulate canvases, timers, sockets, audio nodes, or listeners. Physical phones, Wi-Fi, TV distance, touch feel, and group enjoyment remain human playtest gates.

## Ownership and Claude collaboration

Game implementation belongs in `game-modules/packages/games/night-job/`, reachable through the existing `packages/games` symlink. Game assets and their `/games/night-job/` exposure belong in the games repository. Platform registries, discovery metadata, and integration tests belong in the parent repository. Follow [repository boundaries](../REPOSITORIES.md). Do not stage, commit, push, or open a PR without an explicit request for that action.

Integration checklist: `apps/party-server/src/registry.ts`, `apps/party-client/src/registry.ts`, catalog details in `apps/party-client/src/catalog.ts`, the `gameLooks` mapping in `apps/party-client/src/art.tsx` consumed by `main.tsx`, and `catalog/sources.json`. Verify asset handling rather than inventing an external artwork URL.

Codex owns rules, wire types, map validation, integration, builds, and QA. After types and visual fixtures stabilize, a bounded Fable frontend assignment can own `render/`, `controls.tsx`, `style.css`, and authored game art. Specify any client component ownership explicitly before handing it over. Fable must consume projected state and the provided input callbacks; it may not decide gameplay outcomes or modify shared runtime files. During a build, all editing owners freeze source.

Use the actual ask-claude skill with `--model fable` for follow-ups in the same model lane. Supply the scoped source, reference links, and current screenshots. Request architecture review before implementation, visibility/security/AI review when those rules exist, and frontend review against the actual browser build. Advice is reviewed by Codex rather than treated as authority to expand scope.

### Fable review disposition

Fable completed a read-only architecture/presentation review through the actual skill on 2026-09-20. Codex then checked its recommended Phonedig and Kitchen Rush source examples.

Accepted: Canvas SceneView and Phonedig performance patterns; explicit geometry distinctions; coin trails; passive role identity; dedicated phone controls (revised after the user’s clarification); source-based host-role handling; hidden-AI projection tests; bounded reconnect snapshots; solo reachability checks; and a narrow frontend/animation assignment after wire types stabilize.

Kept the original plan on three points. First, compact full-floor views are easier to prove at 1280×720 than Fable's larger floor and variable shared camera. Second, keep built-in reliable tool actions: with bounded loot and short missions, charges fit comfortably inside the default action budget, and accepted/rejected acknowledgements already exist. Kitchen Rush's sequenced held-command queue remains an alternative if measurement or future content justifies it; it is not free of latency or acknowledgement complexity. Include a total action-budget test across every mission's floors and bound repeated failed presses. Third, the plan does not adopt Fable's claimed exact blueprint-memory behavior as a verified Monaco fact; original visibility details still need direct comparison.

Fable also warned that coalesced input plus interpolation can exceed 150ms. That estimate is a risk, not a benchmark. The performance target remains a gate: measure the baseline, tune the presentation delay, and only then consider geometry-only prediction. Do not report the target as achieved.

## Current verification status

Game implementation now includes three single-floor heists, all eight roles, six tools, original Canvas artwork and effects, authoritative rules, and shared room integration. The final polished controller-only build, including the newer Ichi integration, passed the full automated suite: 1,599 tests passed, one skipped, and none failed. Claude Fable authored the frontend after its architecture review.

See [the QA report](../verification/night-job.md) for the current immutable build, complete playthroughs, review disposition, and remaining limits. Multi-floor transitions and music are not included. Physical-device and group playtesting remain human acceptance gates. The user subsequently authorized publication to main and updating the local desktop launcher; the QA report records the release verification.
