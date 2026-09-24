# Repository layout

- **[partyplace](https://github.com/JoshTheMenace/partyplace)**: discovery UI, My Library, curated source list, room service, integration tests, build/deployment scripts and architecture/research documents.
- **[partyplay-games](https://github.com/JoshTheMenace/partyplay-games)**: game code, game-owned tests, racing engine, shared runtime packages and game assets.

Both repositories are private. The platform references a specific games commit as a Git submodule at `game-modules/`. Game contents are stored only in the games repository's Git history. The platform contains directory symlinks at the old `packages/` and `public/games` paths so imports and build commands continue to work. `packages/party-catalog` remains in the platform because catalog metadata is independent of the game runtime.

This is a repository boundary. The currently installed nine games still build into the playable application through its trusted room adapter. It is not an arbitrary-game importer or a separate deployment service.

## Fresh checkout

```sh
git clone --recurse-submodules https://github.com/JoshTheMenace/partyplace.git
cd partyplace
npm ci
npm run typecheck
npm test
npm run test:kart
npm run build
npm start
```

For an existing checkout:

```sh
git submodule update --init --recursive
```

Use macOS/Linux, or a Windows environment with Git symlink support (WSL is a straightforward option). Do not replace the tracked symlinks with copied directories. Docker builds must start from a checkout with its submodule initialized; the normal recursive `COPY` includes the checked-out game source and follows links within the build workspace.

## Updating games

Create a branch inside `game-modules`, edit, and run tests from the platform root. Commit and push the games repository first. Then stage `game-modules` in the platform to record the new commit and push the platform change. Avoid committing a pointer to an unpublished games commit. `git submodule status` shows the pinned revision; `git status` reports uncommitted or updated game contents separately.

## Curating games

Edit `catalog/sources.json` in the platform. See [the curator guide](../catalog/README.md). Listing edits do not rebuild game modules, and the running catalog refreshes without a restart. Changing a room game's implementation does require a new games commit and application build. External listings point to their existing playable sites.

Generated builds, local saves, browser profiles, tunnel binaries, session logs and QA screenshots remain local under ignored `output/`. Authored source, research, instructions, assets and package lockfile are versioned. No credentials or environment files belong in either repository. Historical QA documents may refer to local evidence paths; the repository-split verification is recorded in `docs/verification/repository-split.md`.

Kart Party follows the same `packages/games/<id>/` layout as the other games. Its rebuilt engine, tests, Blender sources and assets all live under `packages/games/kart-party`; there is no separate `modules/kart-party` checkout or standalone server. The `public/games/kart-party` link in the games repository preserves its public URLs.
