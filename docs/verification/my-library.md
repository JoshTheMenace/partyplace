> Historical QA record. Runtime PIDs, preview URLs and output paths below describe that verification session. Generated screenshots and logs remain local.

# My Library and curated Discover QA

2026-09-10. Build `my-library-01`; HTML SHA256 `3fbeac5158eb843996b6b5b7b97b5fa783e12b7ca7a5e4fc7e60dacd986ba43b`.

## Delivered

My Library is the default route and starts empty. Discover is a separate route, with source selection, search, filters, details and explicit Add actions. Library membership persists separately from favorites/history; removing membership leaves game save storage untouched. Curator-owned `catalog/sources.json` is read at request time, independent of the client build and game registries. Metadata supports existing room games, manually configured external launches, artwork, source URLs and unavailable listings. There is no public importer or writable catalog API.

## Checks

- All 313 collection tests passed, including five new tests for manual catalog normalization, invalid URLs/duplicates, hot file updates, unknown room IDs, legacy library migration and routes. TypeScript, oxlint and the isolated build passed. Existing Vite dependency directive and chunk-size warnings remain.
- Browser empty-state and nine-game Discover checks at 1280×720, 1920×1080, 320×568, 390×844, 667×375 and 844×390: no document horizontal overflow; card buttons at least 44px; reduced motion enabled. Representative desktop and phone screenshots inspected.
- Actual Add from Discover, Add from details, Remove, empty-after-last-removal, reload persistence, and cross-tab membership sync passed. Old history/favorites do not imply membership.
- Library Play for Kart Party opened the actual shared lobby with its host seated and Start enabled. Owned room PTFMS2 was closed through its UI. No new game round was needed for these catalog-only changes; prior gameplay evidence remains in `output/unified-room/QA.md`.
- Edited the owned source fixture while the server stayed running. Refresh exposed a tenth game from a second source; source selection showed only that game. Add persisted through reload; Open launched the configured HTTPS page in a new tab with a null opener. The external page was intercepted in the browser as a controlled fixture, without contacting a third-party game. Broken artwork fell back to the neutral image.
- Invalid JSON returned 503, displayed a retry error and retained ten previously loaded listings plus the personal library. Correcting the file recovered without restart.
- Synthetic maximum catalog: 100 sources, 500 games. All entries rendered; desktop source list scrolls; phone selector contains all 101 choices including All sources. Long title/source text and narrow layouts had no horizontal overflow.
- Removing the test game from the source list retained its library entry but disabled launch in both card and details; removing the entry worked.

Evidence: `tests.log`, `flow-results.txt`, `hot-add-results.txt`, `error-results.txt`, `maximum-results.txt`, `removed-results.txt`, screenshots and CLI scripts in this directory. No physical-device, remote multi-user load, Docker deployment, native-game, embedded-game or offline capability is claimed.

## Runtime ownership

Owned headless browser `my-library-20260910` closed. QA server PID 69496 (session 59936) stopped after tests. The final user preview now reads the real curator file, not a test fixture:

- http://localhost:4397
- server PID 70820, exec session 37512
- `npm run serve:isolated -- my-library-01 4397`
- `preview-smoke.json` confirms one real source, nine games and the exact build hash.

Public tunnel `https://pages-obj-ellen-cities.trycloudflare.com` reported an active connection at the final promotion check. Its server and build were preserved. The existing user's other local previews were also left running.

## Cleanup review

Reviewed the changed source for unnecessary abstractions: one shared metadata validator, one server file reader, one catalog refresh hook and the existing library store/UI primitives. Removed the former hero/shelf rendering from the default dashboard and kept room-game metadata behind the existing runtime path. The requested code-golf skill is unavailable in configured skills/plugin cache; the simplification review was manual. No Prettier, staging, commits, pushes or PR changes.
