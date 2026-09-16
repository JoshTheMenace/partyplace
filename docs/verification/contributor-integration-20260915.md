# Contributor integration

Implemented in the isolated checkout `/Users/joshthemenace/Documents/ChatGPT/partyplay-contributor-integration`. The original working checkout and live rooms were preserved. The integration incorporates the selected contributor changes on top of current main, rather than merging conflicting historical branches. Games were published first as [`cb766b4`](https://github.com/JoshTheMenace/partyplay-games/commit/cb766b4572aaae5df3da0b1b2f48c7a9c33faf8f); this platform change pins that exact commit. Source PRs are closed with links to their incorporated work after publication. Aaron Hendricks receives coauthor credit in both commits.

Baseline: platform `f8a96255127ff0523f06643a21b6b57c1ca03362`, games `02c6cf59013e159e2b41e3576bcb77ac09be3e4b`.

## Integrated recommendations

| Source | Result |
| --- | --- |
| [Games PR 1](https://github.com/JoshTheMenace/partyplay-games/pull/1), `90bd824` | Six cook choices in Kitchen Rush's shared lobby; rendered food and character icons; scoped asset loading. Kept current kitchen stations, human rigs, campaign, audio and acknowledged dash commands. Animal meshes use the existing animation interface. Character selection does not spend service time. |
| [Games PR 2](https://github.com/JoshTheMenace/partyplay-games/pull/2), `6875fd0` | Kart race statistics, up to six awards, item roulette/icons, hit attribution, shield statistics, bounded wheel rotation and optional performance diagnostics. Kept the consolidated engine, current contact response, selectable karts, garage, courses, music and TV/personal view settings. Controls-only phones remain lightweight. |
| [Games PR 3](https://github.com/JoshTheMenace/partyplay-games/pull/3), `606d397` | Shared adaptive presentation and quality tools imported once. Quality recovery accepts normal 60 Hz frame intervals. Regression coverage includes degradation/recovery, jitter, bounded delay and suspended snapshot streams. |
| [Games PR 4](https://github.com/JoshTheMenace/partyplay-games/pull/4), `20dcfb8` | Phonedig registered in the server, client and catalog. Landscape phone playfield with left movement/right pump; shared map uses terrain and actor sprites. Still Air now applies the carrier's air-drain multiplier. |
| [Games PR 5](https://github.com/JoshTheMenace/partyplay-games/pull/5), `9c171ed` | Hotpot registered in the server, client and catalog. Private hand comes first in both DOM and visual order; short landscape views use smaller cards. Bots preserve sets and pairs and consider public discards. Windowed action history supports long rounds. |
| [Platform PR 1](https://github.com/JoshTheMenace/partyplace/pull/1), `9cd7f53` | Optional `HOST`, preserving `0.0.0.0` default. Ported into the current `createPartyApp` entry point. Address discovery respects the actual bound interface; startup output respects `PUBLIC_ORIGIN`. README documents proxy origin configuration. |

The platform PR adds no game APIs and is not a dependency of either new game. Its Standards review found no documented violation. Its Spec review identified misleading LAN invites when bound to loopback; the integrated implementation corrects that behavior. It does not trust request Host headers as a public proxy origin.

## Code walkthrough

- Game rules remain authoritative. Kitchen's lobby choice parser validates six cosmetic IDs, and round creation copies that choice into each chef. `SceneViewProps` now documents the optional lobby choice already supplied by the platform.
- Kart simulation updates each racer's statistics where pickups, drift boosts, hits and contacts actually occur. The awards module selects deterministic winners from those statistics. Item pickup events drive the short roulette animation; server cooldown still controls actual use.
- Phonedig drains each player's air from that player's effective tune. The regression compares a Still Air carrier with a teammate in the same run.
- Hotpot's bot evaluates disjoint sets and pairs using only its own hand and public piles. Its platform registration opts into the existing bounded action window; the endurance test executes 1,200 full turns, 600 accepted commands per player.
- Server binding changes the listener and advertised join addresses together. `PUBLIC_ORIGIN` remains the explicit source of reverse-proxy invite URLs.

## Fable review and corrections

Claude Fable 5.1 reviewed both repositories in the persistent Fable lane. Its first verdict found no release blockers and identified 13 should-fix issues. Corrections add Hotpot idle-turn cover and stable pending buttons, prevent bot discard loops, count only kart impacts for contact awards, distinguish shield-block feedback, preserve the phone quality default, trim and conditionally load Kitchen animal models, complete the icon port, and test asset loading/disposal. Phonedig resumes its cumulative pump counter from a private server acknowledgement across controller remount/reconnect, and restores hazard cues. The platform explains loopback-only invites and omits empty lobby action containers.

The animal model pack is now 1,107,320 bytes (18 meshes), down from 7,457,700 bytes (114 meshes). Main's original kitchen kit still supplies human chefs and stations. Reduced-motion effects and the solo Phonedig HUD/status positioning were also corrected. The final follow-up verdict was “good to go,” with no remaining substantive issue. One nonblocking note remains: idle Hotpot cover logs once for draw and again for discard. The complete review is recorded in the local evidence directory.

## Validation

- Full suite: 1,530 passed, one skipped, zero failures (1,531 total). This includes 600-command-per-player Hotpot endurance and existing real-socket action-window coverage.
- Kart suite: 482 passed after the final simulation/animation edits.
- All 73 Phonedig tests pass after the final presentation cleanup.
- Final TypeScript and Oxlint checks pass. No Prettier was run.
- Production build `contributor-integration-v4` passes. It retains the existing bundle-size advisories and excludes development fixtures.
- Real loopback launch: listener verified at `127.0.0.1:4358`, `/api/health` succeeds, `/api/addresses` returns no unreachable LAN links. With `PUBLIC_ORIGIN=https://party.example`, the endpoint and startup output return that origin.
- Browser checks used one owned headless Chromium session and synthetic rooms. No visible Chrome windows were opened. No physical-phone or Safari claim is made.

Focused v4 browser retests: ten Kitchen phones with all six choices, actual movement/dash, zero GLB requests from controllers, and inspected display/lobby/phone captures. Solo Phonedig at 844×390 with reduced motion and rotation had no horizontal overflow and no HUD/status overlap (HUD bottom 102.9px, status top 295.8px). Hotpot pending states retained disabled card buttons and showed “Sending…”; narrow informational text and hit targets were enlarged. The v4 solo match reached round-four results with a bot win; pending observations retained all 9 disabled discard buttons. The browser helper needed to wait for enabled cards instead of treating the new pending buttons as actionable.

### Game flows

- **Phonedig:** four real UI joins, suit selections, keyboard movement and pump input; 844×390 landscape controller has no document overflow. Shared map and downed states inspected. A level-30, one-life run reached normal game-over results, then all four readied, selected suits and replayed. This is completion of a run, not a claim that all 30 levels or relic combinations were manually played.
- **Hotpot:** four UI joins, complete match ending at round 13 with 97 automated UI actions, results reload and replay. Inspected 320×568, 390×844, 667×375 and 844×390 layouts without horizontal overflow. Final landscape hand fits above the fold; history may scroll. A separate solo game against the improved bots ended at round 5 with a bot win.
- **Kitchen Rush:** ten phone joins with long names, all six cook choices, host roster, actual 3D render, movement and acknowledged dash cooldown. Preserved existing service/recipe tests; this focused browser pass did not manually cook through all ten stages.
- **Kart Party:** ten phone joins, garage choice/readiness, split-screen rendering, steering and diagnostics. Controls-only phone fetched zero GLBs. Disconnection takeover finished all ten racers, populated six awards, and results rejoin/replay passed after all roster members returned and readied. The final build repeated the ten-player race; all standings, six awards and the replay button fit at 1280×720 without scrolling. Racing logic/roulette also has focused automated coverage; this is not physical-device frame-rate acceptance.

Some QA scripts needed corrected selectors or readiness waits: random Hotpot starting seat, Kart combobox labels, and reconnecting every roster member before replay. These were automation assumptions, not reproduced game failures.

## Local preview

From this checkout:

```sh
npm run serve:isolated -- contributor-integration-v4 4359
```

Build identity is recorded in `output/builds/contributor-integration-v4/build.json`. Screenshots and browser helpers are under `output/playwright/contributor-integration/`. Test logs are copied there too. Generated evidence is local and ignored by Git.

The requested code-golf skill was absent from both configured local skill directories. A manual simplification pass kept the existing action window, room lobby, animation hooks and presentation interfaces instead of introducing parallel systems.

## Screenshots

![Phonedig landscape controller](/Users/joshthemenace/Documents/ChatGPT/partyplay-contributor-integration/output/playwright/contributor-integration/phonedig-phone.png)

![Kitchen Rush with ten cooks](/Users/joshthemenace/Documents/ChatGPT/partyplay-contributor-integration/output/playwright/contributor-integration/kitchen-v4-tv.png)

![Hotpot compact landscape hand](/Users/joshthemenace/Documents/ChatGPT/partyplay-contributor-integration/output/playwright/contributor-integration/hotpot-v4-landscape.png)

![Kart Party final standings and awards](/Users/joshthemenace/Documents/ChatGPT/partyplay-contributor-integration/output/playwright/contributor-integration/kart-awards-final.png)
