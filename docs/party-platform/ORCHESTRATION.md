# Six-game build orchestration

User selected six games on 2026-09-08. Root task: 01a081e4-aea1-7440-9b76-ae64675d6c2f. Research: [JACKBOX-RESEARCH.md](JACKBOX-RESEARCH.md). Stable module boundary: [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Workspace and reference

All tasks run directly in this project with exclusive directory ownership. At dispatch, Git main had no commits, so the initial worktree creation did not produce an accessible running task; local project tasks were used. No staging, commits, pushes, PRs or publication are authorized.

User supplied Kart Party reference: `/Users/joshthemenace/Documents/Codex/2026-09-06/i-want-you-to-explore-building/outputs/kart-party`. Its `docs/party-platform/GAME-CONTRACT.md`, `AGENT-BRIEF.md` and `theme.reference.json` were found and read. They are proposed guidance, not previously implemented shared packages here. The reference stays unchanged and separately runnable. Full Kart Party migration is outside this batch.

## Ownership and tasks

| Task | ID | Exclusive ownership | Dispatch status |
| --- | --- | --- | --- |
| Build shared party-game platform | 01a081e6-eb7b-75f2-86a3-1c713a88c158 | apps, shared packages, root config/dependencies, fonts, registry, platform tests, launcher, IMPLEMENTATION.md | Complete; 151 collection tests, typecheck/lint/build and shared browser acceptance passed |
| Build Quip Clash | 01a081e9-01ce-75e2-8409-49623647e3e2 | packages/games/quip-clash/ | Complete; 15 tests; full submitted browser game, reload, replay and cross-game cycle passed |
| Build Sketch Bluff | 01a081e9-0bf2-7b11-8218-04c97cf39958 | packages/games/sketch-bluff/ | Complete; 19 tests; full browser game and repaired viewport/drawing checks passed |
| Build Tall Tales | 01a081e9-1c40-7020-b6c0-c594d1540ea2 | packages/games/tall-tales/ | Complete; 20 tests; full browser game, draft repair and viewport checks passed |
| Build Shirt Show | 01a081e9-274b-7aa2-a652-913d57017230 | packages/games/shirt-show/ | Complete; 27 tests; actual-content games, reload, voting and final viewport repairs passed |
| Build Odd One In | 01a081e9-321e-7681-9ce7-86d65257e9e8 | packages/games/odd-one-in/ | Complete; 25 tests; full repaired four-phone browser game, privacy, drafts and viewport checks passed |
| Build Quiz Panic | 01a081e9-3ed4-7c23-996a-ee63e1a96f42 | packages/games/quiz-panic/ | Complete; 39 tests; full game/replay, input recovery, pacing and final phone repairs passed |

Root owns this orchestration file and research. Only platform owner installs dependencies or edits shared configuration. Game owners report shared changes rather than patching outside their directory. No task may remove another task's untracked files. No additional agents or Claude consultation.

## Acceptance and coordination

1. Platform publishes exact API and UI signatures. Completed at dispatch; file contents inspected by root.
2. Each game builds pure rules and original server-only content, then display/controller views with shared primitives.
3. Each game validates full-round completion at intended counts, malformed/duplicate/late actions, deadlines/disconnects, scoring/ties and private serialized projections.
4. Platform integrates explicit server/client allowlists and runs real Node socket tests: persistent rooms, reconnect, host authority, action retries, secrecy, preparation and A → B → A switching.
5. Whole-project relevant typecheck/lint/build/tests must pass before calling implementation complete. Test reports from individual owners are distinct from root verification.
6. User explicitly authorized browser QA after module completion on 2026-09-08, requiring professional look and play comparable to Kart Party. Root owns integrated browser walkthroughs, viewport/screenshots, reconnect/rematch/switch checks and repair requests to owners. Physical phones, TV, hardware performance and family playtesting remain separate pending gates.
7. Music is reserved for user: games work silently and document cues/insertion points. No music download/generation, external content services or remote hosting.

No completed-game claim at dispatch. First progress snapshot confirmed all seven tasks active.
