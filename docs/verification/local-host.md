# Local host and browser play verification

2026-09-10. Claude Fable implemented the shared server, local launcher, packaging, and help UI through the ask-claude workflow. Codex reviewed the code, reproduced and requested correction of the unsafe stale-PID stop behavior, and fixed the remaining startup-lock race after Claude's handoff. No commits, pushes, deployments over existing previews, or changes to the installed Desktop app were made.

The delivered package is [local-host-05](../../output/local-host/local-host-05/PartyPlay-Local-Host-macos-arm64.zip): macOS Apple silicon, 63,245,539 bytes (60.3 MiB), containing nine games and Node 24.14.0. Minimum macOS version is 13.5, matching [Node's supported platforms](https://github.com/nodejs/node/blob/v24.14.0/BUILDING.md#platform-list). It is ad-hoc signed, not notarized. See [usage instructions](../LOCAL-HOST.md).

Artifact fingerprints:

- ZIP SHA-256: `61c14242fded4942b4591b38f192acea228ba6e13261d1d8e087b3964e1d33c3`.
- Client index SHA-256: `8453f41353dd31173ee5192cd029a9bb2e10106a7398c8e5af6c1cf187bc6376`.
- Local server SHA-256: `79eabf9ef779f19485aefe8da38c321f623b0abbab89ad3dc0916218d4a08cd7`.

The final hosted preview runs on [localhost:4398](http://localhost:4398), PID 8050, exec session 69120, using `output/local-host/local-host-05/build/server.mjs`, its matching client directory, and an isolated save directory under `output/playwright/local-host/hosted-saves`. This is a local preview of the hosted entry, not a new public deployment. Existing previews on ports 4361, 4388, 4396, and 4397 retained their exact client HTML hashes. The public tunnel's existing server was left intact.

Checks completed:

- TypeScript passed. Final lint passed without warnings.
- Full suite: 669 tests, 668 passed, one packaged-launch test skipped without an artifact path. After the final lock-cleanup logging change, the focused suite passed again.
- Final package suite with the artifact supplied: all six tests passed. Coverage includes data paths, stop authorization, forged instance identity, sequential reuse, concurrent startup, lock recovery, and real packaged launch/shutdown.
- Independently extracted the ZIP outside the checkout and launched it with `PATH=/usr/bin:/bin`, no HOME override, and a temporary `PARTY_DATA_DIR`. No Git, npm, compiler, or separately installed Node was used by the launch. This tests portability on this Mac, not a fresh physical machine.
- Independent packaged regression: a stale instance record did not terminate an unrelated disposable process. Two simultaneous launcher processes produced one running host. The verified stop command ended that host.
- Fresh incomplete startup locks are respected while their creator writes ownership data; abandoned incomplete locks and dead owners are recoverable. Slow live owners are not evicted by a timestamp alone. Cleanup checks ownership before removing its lock.
- The copied bundled Node binary links only to system libraries/frameworks. Strict deep code-signature verification passed on the final package.

Browser evidence used headless Chromium through the Playwright skill, with one owner. On immutable package local-host-03, a host at 1280×720 added Kitchen Rush to its library, created a room, and a separate browser context joined its actual LAN URL. The phone was first emulated at 390×844 and correctly displayed the landscape instruction; the harness initially timed out because it expected visible controls in portrait. At 844×390 the controls appeared. Kitchen Rush rendered on both devices. Switching Kitchen Rush → Kart Party preserved room `ZTS4VV` and the phone seat. Kart reached live racing at observed speed 6.79. The room was explicitly closed. No JavaScript errors were captured. The later launcher changes did not modify game rules or gameplay rendering.

Final local-host-05 UI verification covered the help dialog at 1280×720, 1920×1080, 320×568, 390×844, 667×375, and 844×390. There was no horizontal overflow; the stop target was at least 44 pixels tall. The dialog scrolls vertically at shorter sizes. A LAN browser saw the accurate remote-host wording and no stop button. Clicking the loopback browser's stop button showed success and the actual local host exited.

The final hosted entry reported nine games and `host: hosted`, returned 404 for local shutdown, and displayed no local-only help section. Through its UI, Kart Party was added, launched, and reached live racing at observed speed 5.94. That room was also closed. No JavaScript errors were captured. Representative host and phone screenshots were visually inspected.

Evidence is in [output/playwright/local-host](../../output/playwright/local-host), including test logs, package build log, regression results, browser scripts/results, preview fingerprints, and screenshots. All QA rooms and owned browser sessions were closed, and both temporary packaged QA hosts exited. Only the final hosted preview is intentionally left running for the user.

Limits: no physical-phone/Wi-Fi load test, WAN-disconnected certification, fresh-machine install, downloaded-copy Gatekeeper test, or Intel/Windows/Linux package. Existing game QA and maximum-roster automated coverage remain applicable; this packaging change did not replay every game's full round. Games remain compiled into the release. Independent game installation, arbitrary remixes, updates, and public publishing are not implemented in this slice. Save files use the durable host data directory, but account-based save discovery and automatic recovery of closed rooms are unchanged.

The requested code-golf skill was unavailable; the implementation received a manual simplification review. Packaging output is ignored by Git, and game implementation remains in the separate games repository.
