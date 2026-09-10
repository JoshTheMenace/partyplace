# Curating Discover

Edit `catalog/sources.json` to add, change or remove listings. This file is read by the running server, separately from the compiled website. Discover refreshes every 30 seconds while visible, when returning to the tab, and when **Refresh sources** is pressed. No rebuild or restart is needed for catalog edits.

The nine PartyPlay games are seeded under **PartyPlay originals**. A new browser starts with an empty **My Library**. Adding a game saves its ID and listing metadata in that browser's local storage. It does not launch, install or download a game. Removing a library entry does not delete its game saves. Libraries do not yet sync across devices or different site addresses. If a listing leaves the catalog, saved library entries remain visible but cannot launch until it returns.

## Add a game manually

Each source has a unique `id`, `name`, optional `description`, and `games` array. Add another game object to an existing source, or add another source. Game IDs must be unique across the entire catalog. Use stable IDs so people's library entries survive title and artwork changes.

This example is documentation only; replace the example URLs with your chosen game's real addresses:

```json
{
  "version": 1,
  "sources": [
    {
      "id": "joshs-picks",
      "name": "Josh's picks",
      "description": "Games I think you should try.",
      "games": [
        {
          "id": "orbital-garden",
          "title": "Orbital Garden",
          "description": "Grow a little world in space.",
          "category": "Exploration",
          "players": { "min": 1, "max": 1 },
          "launch": "external",
          "playUrl": "https://games.example.com/orbital-garden/",
          "sourceUrl": "https://github.com/example/orbital-garden",
          "artwork": "https://games.example.com/orbital-garden/cover.png",
          "creator": { "name": "The creator" },
          "controls": ["Keyboard", "Mouse"],
          "searchTerms": ["space", "gardening"],
          "playTime": "Open-ended"
        }
      ]
    }
  ]
}
```

`launch` determines what Play does:

- `room`: launches a game already installed in the PartyPlay runtime. Its ID must match an existing registered game. Use this for the nine originals; listing arbitrary source code does not install it.
- `external`: opens `playUrl` in a new tab on the creator's site. These are manually authored listings, with no URL importer, code fetching, embedding or build service. A GitHub repository page belongs in `sourceUrl`; use the actual deployed game for `playUrl`.
- `unavailable`: a details-only listing people can save to their library. Use this when you have source information but no playable release. Omit `playUrl`.

Required game fields: `id`, `title`, `description`, `players`, `launch`; `external` also requires `playUrl`. Optional fields include `category`, `artwork`, `sourceUrl`, `creator`, `controls`, `playTime`, `searchTerms`, `tags`, `detail`, `supportsSolo`, `cooperative`, `requiresSharedDisplay`, `released` (YYYY-MM-DD), and `status` (`ready` or `in-progress`). Solo defaults to a minimum of one player; shared-display and co-op default to false. Set accurate controls/capabilities for each release. Artwork is an HTTPS image URL, with a neutral fallback for missing or broken images.

All provided URLs must be HTTPS and contain no credentials. Catalog limits are 100 sources, 500 games and 2 MiB. Categories and source names are not hardcoded. No external source is fetched automatically: a source here is a curator-defined collection, not an executable extension.

## Validate and publish an edit

From the project root:

```sh
node --import tsx scripts/check-catalog.mjs
```

For safer live edits, write a candidate alongside the active file, validate it, then rename it over the active file:

```sh
node --import tsx scripts/check-catalog.mjs catalog/sources.next.json
mv catalog/sources.next.json catalog/sources.json
```

Malformed JSON, duplicate IDs, invalid URLs and unknown room game IDs are rejected. Discover shows a refresh error and retains the last successfully loaded catalog until corrected; a fresh visitor can retry after the fix. The room server continues running.

The optional `PARTY_CATALOG_PATH` environment variable selects another source file. The default is relative to the server's working directory. In production, place the file on persistent storage or mount it into the container and set this variable. The Docker image includes the seed file at `/app/catalog/sources.json`; changing only your local copy does not update a remote container. Keep write access with the curator; no public editing endpoint is exposed.
