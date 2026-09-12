# Kart Party directory consolidation

2026-09-10. Kart Party now has one home at `game-modules/packages/games/kart-party`, beside all other games. The old `modules/kart-party` directory and platform compatibility link have been removed.

- Shared-room adapter: `src/manifest.ts`, `src/server.ts`, `src/client.tsx`, `src/scene.tsx`.
- Original racing engine and renderer: `src/engine/`.
- Retained standalone support: `src/standalone-server/`, `src/app/`, `src/lib/`, `index.html`.
- Game-owned tests: `tests/`.
- Music, fonts, icon and licenses: `public/`. The games repository's `public/games/kart-party` symlink preserves existing served URLs.

Updated platform/test imports, the focused Kart test command, TypeScript and lint paths, standalone Vite root and current documentation. The normal game test glob now includes Kart, so `test:all` no longer runs it a second time. TypeScript explicitly includes the submodule's physical package path so JSX configuration applies to Node tests loaded through symlinks. The standalone Vite root resolves its symlink before calculating output names.

All 102 original Kart files were accounted for after relocation. All 51 original engine files and 11 assets are byte-identical. Changes to existing files are import paths, the HTML entry path, the Tailwind source scan path and documentation. No racing logic or room protocol changes.

Validation: TypeScript, oxlint, all 663 tests, isolated platform build `kart-layout-01`, and the retained standalone Vite build passed. Existing dependency directive/chunk warnings and standalone fonts resolved at runtime remain. Initial rendering-test and standalone-build path failures were corrected before final validation.

Owned Chromium session `kart-layout-20260910` on port 4399: Discover → Add Kart Party → My Library → Play → Start, real countdown and driving, ArrowLeft input, rendered 1240×430 canvas at 1280×720, observed speed 30.5, and music HEAD HTTP 200 with 7,491,916 bytes. Zero browser console errors/warnings. Screenshot visually inspected. Closed owned room HFFQYG through the UI, then closed the browser and stopped the owned test server. Existing user previews were preserved. No new full-race/replay or physical-device claim; prior gameplay acceptance remains applicable to the unchanged engine.

Local evidence: `output/kart-layout/` and `output/playwright/kart-layout/`. An initial asset-check script used a relative URL without an API base; the check was completed successfully using the explicit local URL.

Simplification review removed the obsolete module path and duplicate full-test invocation. The requested code-golf skill is unavailable in the configured skill directories, so the review was manual. No Prettier or Git staging/commit/push was performed for this follow-up.
