# Main branch game integration

2026-09-15 (America/Denver). The user requested merging the published game branches into main in both repositories.

## Included branches

| Game | PartyPlace branch tip | partyplay-games branch tip |
| --- | --- | --- |
| Blockwild | `fe706a5` | `d2a3caf` |
| Island Settlers CPU / solo | `5245ed4` | `7cac448` |
| Kart Party | `53687e7` | `3a876ad` |
| Kitchen Rush | `1096851` | `2517add` |
| Sky Clash | `947a2fd` | `faccc6a` |
| Starship Scramble | `0847848` | `8ce7a28` |

The games repository also includes the earlier Island Settlers expansions branch, `d1af5da`. The CPU branch already contains its game content; the merge retains the newer CPU edition and records the earlier branch ancestry. Sky Clash and the earlier workspace snapshot are ancestors of the Starship branches.

Combined games commit: `02c6cf59013e159e2b41e3576bcb77ac09be3e4b`. Every published feature branch tip is an ancestor of its repository's integration head. Each of the six game source and public-asset directories exactly matches its latest game-specific branch after integration.

## Conflict decisions

- Retain the latest Blockwild chunked-world files over the older workspace snapshot.
- Retain Island Settlers CPU/solo work over its earlier expansion edition, including rules help and music.
- Retain Kart Party's latest mobile garage fix.
- Preserve the current shared UI/audio/lobby APIs, Starship's reliable action window, and the extracted `createPartyApp` server entry. Earlier branch versions must not undo these additions.
- Combine catalog assertions so both Starship and Island Settlers appear in solo/no-TV filters. There are twelve registered games, five solo-capable entries, and seven shared-screen-required entries.

Merges were performed in isolated worktrees. The user's original working branch and uncommitted files were not staged, overwritten, or reset. Feature branches were retained. No live server or user browser was restarted.

## Validation

- `npm ci --ignore-scripts --no-audit --no-fund`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed; no Prettier used.
- `npm test`: 1,426 tests, 1,425 passed, zero failures, one skipped. The skipped packaged-app launch test requires `PARTY_LOCAL_HOST_APP`; no packaged application was supplied for this merge.
- `npm run test:kart`: 472 passed, zero failures. This separately runs the Kart suite in its game directory; it overlaps the root suite.
- `npm run build:isolated -- main-merge-20260915`: passed. Vite reports its large-chunk advisory for the Three.js bundle.
- Built-server HTTP smoke: health and catalog expose all twelve games; every registered game has a discovery listing; all twelve detail routes and both referenced entry assets respond successfully. The built tree contains 182 game asset files. The isolated smoke server was closed afterward.
- `git diff --check origin/main HEAD` in both repositories: passed before publication.

Build index SHA-256: `2d2974795f171f5bed73ce22275c1303d2f74cadddf139b69e385da0076a27e0`.

This is merge/integration validation, not a new visual or physical-phone acceptance pass. The individual game branches retain their QA reports. The code-golf skill is not installed in this session; the only manual test resolution combines the two branches' existing catalog expectations without adding production logic.

Publication order is games main first, then PartyPlace main pinned to that published games commit. Both updates must be ordinary fast-forwards from the previous main histories, without force-pushing.
