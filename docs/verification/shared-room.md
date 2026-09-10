> Historical QA record. Runtime PIDs, preview URLs and output paths below describe that verification session. Generated screenshots and logs remain local.

# Shared rooms and solo play

Verified September 10, 2026. Public preview: https://pages-obj-ellen-cities.trycloudflare.com

Current immutable build: `unified-room-05`; see `output/builds/unified-room-05/build.json` for the HTML SHA-256. Public server port 4388, PID 66440. The existing cloudflared tunnel (PID 45736) remains running. No active tunnel requests were present before replacing the prior preview server. User runtime on port 4361 was preserved.

## Changes and reasons

- All nine games register with the same room server and client. The Kart adapter reuses the existing simulation, race timing, tracks, renderer, interpolation and audio. The platform no longer builds or mounts the separate Kart launcher/room server. Old Kart landing links redirect into PartyPlay.
- The host can take a player seat for a solo-capable game. Host authority, player identity and reconnect credentials remain on one connection. The server enforces the lobby, host-only action and ten-seat limit. Switching to a party game returns the host to watching while preserving phone seats.
- Blockwild and Kitchen Rush accept 1–10 players. The round shell renders a playing host's scene and optional PersonalView. Kitchen Rush's combined view reserves measured space for its controls; solo tickets have more patience and star thresholds scale down. Host-player results still save campaign progress.
- Shortened library descriptions and the hero paragraph; removed both requested “Everything in the library” strings and redundant detail-page copy.
- Sound defaults on, unlocks after browser interaction, and remembers an explicit mute. Kart audio follows the shell preference.
- Kart item presses use acknowledged actions so short taps cannot disappear between held-input samples. Rendering shows every active racer when the host plays alongside phone players.

## Automated checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 308 passed.
- `npm run test:kart`: 350 passed.
- Production isolated builds passed; final build is 05. Vite reports the existing large-renderer chunk warning.
- Added actual-room tests for solo host creation/reconnection, switching games without changing the room/seat, ten retained phone seats, host-only seat changes, and rejection of an eleventh seat.
- Kart adapter completed and replayed all four courses at one and ten players under deterministic rule tests. Kitchen topology/roster checks now include one player; a solo service earns stars, finishes, and restarts.
- Public smoke verified exact served HTML hash, nine games, three solo entries, public invite origin, protected save endpoint, old Kart redirect, and the same host player/code across Blockwild → Kart → Kitchen over public WSS. Evidence: `public-smoke.json` and its reproducible script.

## Browser evidence

One Playwright CLI owner; isolated rooms and owned browser contexts only. Chromium desktop and emulated phone viewports, not physical-device evidence.

| Flow | Evidence |
|---|---|
| Library has nine games; solo filter has three; requested text is absent; mute persists across reload | `final-home.cjs`, `final-library.png` |
| Kitchen solo: keyboard movement, gather/chop/plate/serve a salad, full 180-second service, results and replay in the same room | `kitchen-cook.cjs`, `kitchen-plate.cjs`, `kitchen-served.png`, `kitchen-results.png` |
| Solo Kitchen score 67 survived reload in `party.kitchen-rush.campaign.v1` | Asserted in `start-03.cjs` |
| Kitchen responsive scene and controls do not overlap | `layout-03.cjs`, `kitchen-03-390.png`, `kitchen-03-320.png`, `kitchen-03-667.png`, `kitchen-03-844.png` |
| Blockwild solo: movement, downloaded world, imported that file, finished and replayed | `blockwild-play.cjs`, `blockwild-save.cjs`, `solo-world.json`, `blockwild-solo.png`, `blockwild-results.png` |
| Kitchen → Blockwild → Kart retained room BPV68S and the host seat | Browser result records from `to-blockwild.cjs`, `blockwild-save.cjs`, `kart-start-menu.cjs` |
| Kart race, results and replay, final adapter | `final-kart-results.png`: host finished in 39.1 seconds; `final-race.cjs` |
| Playing host + nine racers, all ten cameras/names visible | `final-party.cjs`, `final-ten-player.png`; room 448865, first playable frame/controller in about 2.1 seconds |
| Real browser phone joins, readies and drives; no phone WebGL scene needed | `final-phone-controller.png`; one browser phone plus eight synthetic sockets and the host. Phone speed 17.82 after input; no page errors |
| Solo Kart controls visible and at least 44px at 1280×720, 390×844, 320×568, 667×375 and 844×390 | `final-controls.cjs`, `final-kart-*.png`; checked descendant button bounds as well as screenshots |

Full gameplay evidence was collected on immutable builds 01/02/04. Focused layout checks cover later CSS refinements; mixed ten-player play and final control checks ran on 05. The Kart full-race run started with actual keyboard steering, then used synthetic bot steering through the real room protocol to complete the course. It did not alter game state or skip the server clock.

## Limits and cleanup

- Very short portrait phones may need a small vertical scroll in Kitchen Rush; landscape keeps the kitchen and controls together. No physical phone, thermal, Wi-Fi contention, accessibility certification or group pacing claims.
- TryCloudflare remains a temporary public tunnel to this computer, not permanent hosting. Keep the computer, Node server and tunnel running.
- Browser QA rooms were closed through their host controls. The named browser and QA servers were closed after verification; the public server/tunnel remain active.
- No Prettier, staging, commits, pushes or PR operations. The requested code-golf skill was not available in the configured skill/plugin roots. A manual cleanup removed the redundant launcher build and reused existing engines and shared contracts.
