# Repository split verification

2026-09-10. The platform and game collection are separate private repositories. `game-modules` is a pinned submodule, and the platform's old game/runtime/asset paths are relative symlinks into it. The platform Git tree contains references, not copies of game implementation or asset directories.

## Local verification

- Preserved all 225 pre-split game/runtime/asset files. The only changed existing module files are two test imports, redirected from the platform server to the shared serialization contract. The serialization implementation was moved unchanged and is re-exported from the platform server for compatibility.
- Added a games-owned TypeScript configuration so standalone Kart JSX tests resolve the same compiler settings after the repository boundary changed.
- TypeScript and oxlint passed. All 313 collection tests and all 350 Kart tests passed (663 total).
- Isolated production build `repository-split-01` passed; Vite copied the linked public game assets into its own immutable output. Existing Vite dependency-directive and large-chunk warnings remain.
- A local pre-split source archive and file hash inventory remain under ignored `output/repository-split/`. Generated outputs, saves, tunnel binaries and session logs were excluded from Git.
- Existing running previews were not restarted or modified.

Fresh GitHub checkout verification is recorded below after publication.
