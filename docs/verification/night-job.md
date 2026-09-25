# Night Job verification

## Night Job v2 rebuild (2026-09-23)

The game was rebuilt: a Three.js TV scene with blueprint fog and raycast sight, a new simulation (guards with suspicion, radio, dodgeable aimed shots; dogs; civilians; cameras, lasers and circuits), three new 44–48-tile maps, a Blender model kit, and a new HUD, controller, lobby and results. The design contract is `packages/games/night-job/DESIGN.md`. Everything below this section describes the previous 2D version and is historical.

- Checks: `npm run typecheck` and `npm run lint` pass. `npm test` gives 1,614 tests: 1,613 pass, 1 skipped, 0 fail, including 60 Night Job game tests and the platform room/registry tests.
- Final isolated build `nj-final-a`. On a real room with a headless GPU TV at 1920×1080: a 4-phone Velvet heist (three WebSocket bot phones plus one Playwright phone), two rounds with Play again, results and awards, 0 browser errors. Renderer p50 8.3 ms, p95 9.8 ms, 98 draw calls. 4-phone tours of Glasshouse and Ferry, 0 errors.
- Review: independent simulation and client reviews plus a real-game playtest produced 44 findings, which were fixed or declined with reasons by the owning agents (evidence under ignored `output/nj-rebuild/`).
- Limits: emulated phones only, no physical-device or TV-distance check, sounds not reviewed by ear, and difficulty tuned with bots rather than human playtests.

2026-09-20 (America/Denver). Implemented in the games submodule, integrated into the platform library. See the [game README](../../packages/games/night-job/README.md), [research](../party-platform/MONACO-RESEARCH.md), and [design plan](../game-plans/night-job.md).

## Current polish release

Publication was explicitly authorized by the user. Game commit: `5b5f51e`. At the user’s request to publish immediately with no more tests, the remaining polish-B Ferry run was stopped; it is not claimed as a pass. The completed checks below predate that request. The desktop launcher is being moved to port 4382 so existing servers and rooms remain available.

The final quality pass combines Claude Fable’s renderer/UI changes with root’s audio work and review fixes. The dedicated TV map and controller-only phones are unchanged. This release includes the latest Ichi integration from main, for **16 catalog games**.

- Immutable run: `night-job-20260920-polish-b`, built `2026-09-21T01:58:18.336Z`.
- Entry SHA-256: `9a81995ab59f795e0a4c26c6c3f51b77c5d70f90661327b4d1868804c5dc8873`.
- Full suite: **1,600 tests, 1,599 passed, one skipped, zero failed**. Typecheck and lint pass without warnings. No Prettier.
- Source ownership froze before each build. Root alone owned QA on port 4381 and headless session `night-job-polish-20260920`; original preview 4380 and existing desktop server 4361 were preserved.
- Evidence: ignored `output/playwright/night-job-polish/`. Runtime source is unchanged after the final B build; later edits are documentation only.

Fable authored the visual pass and independently reviewed actual host/phone/lobby captures plus explicitly staged renderer fixtures. Improvements include detailed floor materials, raised walls with collision-footprint plinths, outlined props and larger actors, clearer walking/work/down/stealth states, guard suspicion, softer smoke, animated objective/escape cues, mission previews, status transitions and tool-charge pips. Root corrected the row-by-row sight-outline stripes, moved work labels away from seat badges, added a canvas rounded-rectangle fallback, softened smoke further, and prevented stale effects or reduced motion from causing camera shake.

Sound now uses original filtered noise and layered tones, stereo positioning, loot streaks, distinct quiet/loud shots, damage, recharge, lock work and objective cues. Three new tests verify gesture gating, snapshot deduplication, the 24-source limit, reconnect, mute, hidden-tab stopping and disposal. A real 48 kHz OfflineAudioContext rendered nine cues with finite samples, correct stereo placement and no clipping. Live browser checks confirmed one host mixer, completed/disconnected voices, muted tool use creating no sound, and no replay on unmute. This is signal/lifecycle evidence, not a human listening review.

The final polish-B four-phone Glasshouse run completed with all four winners, 25/90 loot, eight accepted tools, maximum snapshot 7,382 bytes and no browser/protocol errors (`glasshouse-four-b.log`).

The polish-A four-phone Velvet run completed with all four winners, 28/85 loot and no browser/protocol errors. Its control tests passed simultaneous touch/Sneak, cancellation, rotation, reconnect, 320×568 and 390×844 portrait fallbacks, 667×375 and 844×390 controllers, 1280×720 and 1920×1080 TV layouts, and reduced motion. The phone and UI source is identical in B. Final B renderer fixtures cover all three authored maps and reduced motion with four staged actors, guards, smoke, work and rescue states; they are not gameplay completion evidence. Disabling `CanvasRenderingContext2D.roundRect` still renders successfully.

Across six synchronous fixture runs, median canvas command submission was about 0.3 ms, p95 0.5–0.8 ms, with isolated maxima up to 41.1 ms. These timings exclude a physical display pipeline and do not prove 60 fps. Real headless browser cadence remains 33.3 ms, matching the previously measured blank-page cadence. Physical phones, TV viewing distance, Wi-Fi, human difficulty balance and sustained hardware performance remain playtest limits.

## Initial implementation build (historical)

Source ready → immutable build → browser verification. Final device model: a dedicated TV/laptop map display and 1–4 landscape phone controllers. The host never occupies a thief seat. Phones have movement, Sneak, Tool, and personal status, with no canvas, map, or minimap. One player still needs one phone and the shared display.

- Run: `night-job-20260920-d`, built `2026-09-21T01:00:56.751Z`.
- Client entry SHA-256: `38d52d7fa808d7f6b14abc026b6d52780f0b69807642de7c7a7e6b780984d3d1`.
- Normal registry, no Scene Lab fixture. Runtime source stayed frozen throughout final QA.
- Root owned the isolated server on port 4377 and headless Playwright session `night-job-20260920` (browser PID 62815). Maximum test roster used one host and four isolated phone contexts, no user rooms or browser windows.
- Evidence: ignored `output/playwright/night-job/`; immutable assets: `output/builds/night-job-20260920-d/`. Logs embed the exact Playwright code executed.

## Automated checks

`npm test`: **1,577 tests, 1,576 passed, one skipped, zero failed** (30.98 seconds). `npm run typecheck` and `npm run lint` passed. The isolated production build passed its client/server boundary guards. No Prettier was run.

Game-owned tests cover map routes for all eight roles, circle collision, sight and glass/doors, authoritative movement, interactions, tools, role abilities, economy, score, downing/rescue, hiding, camera pursuit, EMP duration, disconnected suspension, all-absent clock pause, and hidden-state projections. The real WebSocket integration tests cover one and four phone seats, a watching host, preparation, movement/release, duplicate and stale actions, reconnect, and A → B → A switching. Explicit host `play:true` cannot create a Night Job player seat.

## Final build browser evidence

All joins, readiness, settings, tool presses, completion and replay use the real UI and room connection. The route driver reads public snapshots and operates actual controls; it never teleports actors or injects hidden/server state. These runs establish functional completion, not human difficulty or enjoyment.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Four phones, Velvet Ledger, Relaxed | All four escaped, 38/85 loot, five accepted tools | `velvet-four-d.log` |
| Same four seats, replay into Glasshouse, Relaxed | All four escaped, 15/90 loot, nine accepted tools | `replay-glasshouse-d.log`, `glasshouse-four-d.log` |
| Same four seats, replay into Last Ferry, Relaxed | All four escaped, 21/87 loot, seven accepted tools | `replay-ferry-d.log`, `ferry-four-d.log` |
| Night Job → Kitchen Rush → Night Job | Same room and four seats; no Night Job canvas in lobby | `switch-d.log` |
| One phone, Velvet Ledger, Normal | Scripted rush was caught; authoritative loss screen and retry worked | `velvet-one-touch-d.log`; room LNC5DP |
| One phone, retry Velvet Ledger, Relaxed | Emulated touch completed the heist, 29/85 loot, two accepted tools | `velvet-one-relaxed-d.log`, `retry-one-d.log` |
| One phone, replay into Glasshouse and aimed tool | 100px left / 30px up drag accepted; charges 2 → 1; zero phone canvases | `next-aim-d.log`, `aim-d.log`, `phone-aim-d.png` |
| One phone, Glasshouse with Tranquilizer, Relaxed | Scripted route was caught; no claim of successful solo Glasshouse completion | `glasshouse-one-touch-d.log` |
| One phone, Velvet Ledger through delayed relay, Relaxed | Scripted route reached capture/loss results, 20/85 loot; no successful delayed escape claimed | `velvet-delayed-d.log`; room M8FXVP |
| Four-player control/device checks | One TV canvas, zero phone canvases; no host play button | `start-d.log`, `controls-d.log` |

Maximum observed four-player snapshot packet: **7,363 bytes**, below the provisional 16 KiB reconnect budget. Scripted elapsed values include time spent inspecting screens between actions, so they are not pacing measurements. Replays reset choices and exercise duplicate Cracker roles; the initial crew selected Cracker, Scout, Magpie and Face. All player names use the legal 16-character maximum. Every completed run asserts shared winners, collected loot, and no browser/protocol errors.

Real CDP touch verified simultaneous movement and Sneak, pointer cancellation, authoritative stopping, and rotation release. Reload retained the player seat and role with zero phone canvases. Portrait 320×568 and 390×844 show the rotation fallback; landscape 667×375 and 844×390 show the full controller. Landscape targets: 200×200 movement pad, 48px-high Sneak, 136px-high Tool. TV layouts fit at 1280×720 and 1920×1080 with four crew cards. Reduced-motion preference reaches the game. Screenshots were inspected, including full maps, controllers, rotation fallback, lobby and results.

Results remove the scene canvas; each replay mounts one fresh TV canvas. Switching games removes it. This verifies lifecycle behavior visibly, but is not a long-running heap/listener/audio-node leak profile.

## Response and performance

Local emulated touch-to-TV painted movement, measured from actual pointer events and canvas skin-pixel displacement: **68, 104, 104, 105, 106, 117 ms** across six samples (`latency-local-d.log`). This small localhost sample is not a physical-touch/LAN p95 benchmark. Input-to-public-snapshot samples were 21–62 ms, which exclude rendering delay.

A separate owned WebSocket relay on port 4378 added 50 ms each direction with deterministic ±10 ms jitter and preserved message order. Emulated touch-to-painted-TV samples were **131, 136, 142, 144, 169, 179 ms** (`latency-delayed-d.log`). Both host and phone joined through the relay; this delayed the game connection, not just HTTP assets. These six samples do not establish a statistical p95 or real Wi-Fi performance.

Headless Chrome 153 on this Mac delivered approximately 33.3 ms frame intervals (p95 33.4 ms), with the same cadence on a blank page. Consequently the planned 60 fps / p95 below 20 ms target remains unproven in this environment. No production CPU or real-device thermal profile was taken.

## Review and fixes

Claude Fable was consulted through the actual ask-claude skill for architecture, frontend implementation, complicated visibility/AI review, screenshot review, and the final controller-only revision. Advice was checked against the source and tests. Accepted fixes include directional hiding entry/exit, preventing camera alerts from overriding pursuit, shared security sight constants and occluded cones, normalized tool aiming, bounded interpolation, legible crew health, clearer result arithmetic, and the dedicated display/phone arrangement.

Earlier builds A–C tested an initial seated-host/phone-map interpretation. The user's later clarification supersedes those device-mode results. Build B's Ferry route driver pushed into hiding places and stalled; routing now avoids those intentional interactions. Review also found a near-tangent cover-exit edge, fixed with regression tests. Build D completed Ferry. Earlier evidence is retained as history rather than presented as final controller-only acceptance.

The requested code-golf skill was not installed in the searched skill roots/cache. A manual simplicity pass removed obsolete host keyboard and phone-camera branches, kept shared controls and room transport, and avoided introducing a separate engine, socket, or asset framework. No claim is made that the unavailable skill ran.

## Initial delivery (historical)

A clean preview of the verified build runs at `http://localhost:4380/games/night-job` (owned delivery process, exec session 98473). Its served entry hash matches build D. The shared screen creates a room; phones on the same network scan its QR code. The advertised phone address at handoff is `http://192.168.1.126:4380`, subject to normal LAN address changes. This is a local preview, not an internet deployment. Owned QA rooms were closed through the UI, the scoped headless browser was closed, and the test server/latency relay were stopped; only the delivery preview remains running.

## Scope and remaining limits

Three original single-floor maps, eight specialists, six tools, guard/security systems, original pixel artwork and synthesized effects are implemented. Music and multi-floor transitions are not included. Physical iOS/Android touch, Wi-Fi conditions, TV viewing distance, sustained 60 fps, and human group pacing/fun still need playtesting. Browser emulation does not establish those gates. The initial implementation was not published. The user subsequently authorized committing and pushing this game and its polish pass to main; see the current release section above.
