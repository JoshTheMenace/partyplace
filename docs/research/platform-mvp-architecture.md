# PartyPlay platform MVP: same-day architecture and contract

Status: 2026-09-10, written before implementation of the frontend described here. Owner of this document and of the frontend: Claude (Fable lane). Owner of catalog data models, server, session, protocol, tests, build and deployment: Codex. This document is the coordination surface between the two. Anything marked **needs Codex** is a request, not a change already made.

## 1. Scope for today

Ship a playable public-facing version of the existing nine-game collection with real discovery, shareable game pages, a local personal library, and honest capability labels. Nothing here promises downloads, offline play, remixing, third-party imports, accounts, payments or an open-source license. Those remain research topics in [vibe-game-platform-report.md](vibe-game-platform-report.md).

Kept as-is: the shared room flow (host, QR, seats, ready, preparation, round, results), the Kart Party mount, the `packages/party-*` UI contract, the eight `GameClientModule`s and the server allowlists. The dashboard grows around them; it does not replace them.

## 2. Layering

```
Browser
  main.tsx            shell: session, room flows, modals          (Claude)
  routes.tsx          URL <-> view state, history, Link            (Claude, new)
  dashboard.tsx       discovery: hero, shelves, search, grid       (Claude)
  game-page.tsx       game detail, share, capabilities, play       (Claude, new)
  library-store.ts    favorites + recent in localStorage           (Claude, new; replaceable)
  catalog.ts          CatalogGame model, filters                   (Codex)
  registry.ts         lazy client allowlist                        (Codex)
Server
  main.ts, room-server.ts, registry.ts, world-http.ts              (Codex)
```

Rule: presentation reads `CatalogGame` and `GameManifest` and never reaches into game modules. Discovery and detail views work from catalog data alone, so a future non-room launch kind only needs a new `launch` value and a new branch in `playFromLibrary`.

## 3. URLs and routing (frontend, no server change required today)

| URL | View |
| --- | --- |
| `/` | Home: hero, shelves, search, full grid |
| `/?game=<id>` | Game detail page for `<id>`; shareable today because the existing static server already serves `/` |
| `/?join=<code>` and `/?display=<code>` | Existing deep join, unchanged |
| `/games/<id>` | Same detail page, reserved. **Needs Codex:** SPA fallback so any `/games/*` path returns the client `index.html`. Until then the client only emits `?game=` links |

`routes.tsx` parses both forms, pushes history on navigation, listens to `popstate`, and updates `document.title`. Unknown ids render a "not in this library" page with a way back. When a room is open, the detail page is still reachable from the picker as a modal so the room flow is not interrupted.

## 4. Local library: favorites and recent

Decision: implemented in the frontend as `library-store.ts`, key `party.library.v1` in `localStorage`, shape `{ favorites: string[]; recent: { id: string; at: number }[] }`, capped at 12 recent entries, exposed through a `useLibrary()` hook built on `useSyncExternalStore`. Reasons: zero server or model coordination, works on the LAN build today, and a later Codex library module can replace the store file while keeping the hook signature `{ favorites, recent, isFavorite(id), toggleFavorite(id), touch(id) }`.

"Recent" records a game when the player presses Play from the library or detail page, and again when a round for that game actually starts, so the shelf reflects real play rather than only clicks. This is device-local and says so in the UI.

## 5. Catalog fields used and requested

Used today, all existing: `id, title, description, category, status, players, supportsSolo, requiresSharedDisplay, cooperative, controls, playTime, launch, searchTerms`. The manifest's `sessionControls` is read only to describe Blockwild's server autosave honestly.

**Needs Codex, additive and optional so the UI can ship before they land:**

```ts
// Proposed additions to CatalogGame (all optional)
creator?: { name: string; url?: string };          // shown as "By …"; fallback "PartyPlay team"
detail?: string;                                    // 1–3 sentences for the detail page; fallback description
capabilities?: CatalogCapability[];                 // see below; fallback derived from existing fields
tags?: string[];                                    // displayed chips; fallback searchTerms
released?: string;                                  // ISO date, shown as "Added"
```

`CatalogCapability` proposal: `'browser-play' | 'shared-display' | 'phone-controllers' | 'solo' | 'keyboard' | 'touch' | 'server-autosave' | 'host-browser-progress' | 'lan-only'`. The frontend keeps a single label table for these values. If Codex prefers different names, only that table changes.

Until these exist the frontend derives capabilities: `browser-play` always; `shared-display` and `phone-controllers` from `requiresSharedDisplay`; `solo`, `keyboard`, `touch` from `supportsSolo` and `controls`; `server-autosave` from `sessionControls` including `save`; `host-browser-progress` for Kitchen Rush campaign stars (hard-coded in the frontend fallback, to be replaced by the catalog field); `lan-only` always for this build. Every label maps to a sentence that states what does and does not happen. No label for download, offline, remix, cloud sync or accounts.

## 6. Room isolation and creation API (needs Codex before public hosting)

Current server behaviour: one in-memory room; `room.create` fails with "A room is already open" if any room exists. That is unacceptable for a public URL. Requested contract, chosen so the client changes stay minimal:

1. `room.create` always creates a new room and returns the existing `welcome` with its own `code`, `hostId`, and token. Rooms are keyed by code; codes are unique among open rooms. Optional payload `gameId` preselects a game so the detail page can host-and-select in one message. If `gameId` is absent, behaviour is exactly today's picker.
2. `room.join` resolves by code across rooms. Errors stay message-shaped: `Room code not found`, `Room is full`, `Server is at capacity`.
3. Limits: a maximum number of open rooms per server (proposal 24), idle-room teardown (proposal 30 minutes with no connected sockets), and today's per-room ten seats and host grace stay as they are. `RoomView` and `Snapshot` shapes do not change.
4. `GET /api/rooms/<code>` (optional, read-only): `{ open: boolean; phase; gameId; players: number; max: number }` so the join dialog and a future `/?join=` landing can say "Quip Clash, 4 of 10 seated" before connecting. The client treats a 404 as "not found" and works without the endpoint.
5. `/api/catalog` stays `{ games: GameManifest[] }`. If Codex wants to serve the merged `CatalogGame[]`, add `catalog: CatalogGame[]` beside `games`. The client does not read it yet; Claude will switch `main.tsx` to prefer it once it exists, keeping `gameCatalog(games)` as the fallback.

Everything else the client sends (`game.select`, `room.ready`, `round.*`, `input.*`, `snapshot.sync`, `room.remove`, `room.close`) is unchanged.

## 7. Discovery model (frontend)

- Hero states the honest proposition: nine games, play in the browser, one shared screen plus phones for eight of them, Kart Party solo. Counts are computed from the catalog, never typed.
- Shelves on the home page: "Jump back in" (recent, device-local), "Your favorites", then "Everything" with the existing search and filters. Shelves disappear when empty rather than showing placeholders.
- Cards: art, status stamp, category, title linking to the detail page, description, facts, favorite toggle, Play.
- Detail page: large art, title, creator, detail text, capability list with sentences, players, time, controls, "Play" (hosts a room on this screen, then selects the game), "Join with a code" for phones, "Copy link", favorite, and "More like this" derived from category and shared search terms.
- In-room picker: same cards, "Details" opens a modal with the same content; Play stays host-only.

## 8. Freeze and QA handoff

Claude will report source-ready files and exact validation performed. Claude does not build or run browser QA; Codex owns QA after the freeze. Static checks Claude may run: `npm run typecheck` and `npm run lint` (neither invokes Prettier). Codex's checklist for the frontend: home at 1280×720 and 1920×1080, phone widths 320, 390, 667 and 844, detail page for Kart Party and Blockwild, favorite toggle persistence across reload, recent shelf after a real round start, copy-link fallback when the clipboard API is unavailable over LAN HTTP, and the existing full room flow unchanged.

## 9. Not in this MVP

Third-party imports and the isolated launch origin, accounts, payments, downloads, offline mode, remix or fork features, cloud saves, ratings, comments, and any open-source license declaration for the repository. The research report keeps the reasoning; this document only tracks what is being built today.

## 10. Status, 2026-09-10 (Claude)

Source-ready, frozen for Codex QA: `apps/party-client/src/main.tsx`, `dashboard.tsx`, `dashboard.css` (appended sections only), new `routes.tsx`, `library-store.ts`, `capabilities.ts`, `game-page.tsx`. Not touched: `catalog.ts`, `registry.ts`, `art.tsx`, `dashboard-art.tsx`, `round-runtime.tsx`, `world-controls.tsx`, every server, session, protocol, test and build file.

Validation performed: `npm run typecheck` clean, `npm run lint` clean, `tests/catalog.test.ts` passes, `library-store.ts` imports under Node without a window. Not performed: any build or browser run; layout, focus order, clipboard fallback and reduced-motion behaviour are unverified until Codex's QA pass (checklist in §8).

Behaviour notes for QA: the share link uses the LAN address discovered by `/api/addresses` when available, otherwise `location.origin`. Recent-play entries are written on Play and again when a room enters `playing`. The in-room details modal is closed automatically when the room leaves the picker phase. Opening `/?game=<id>` while a saved seat reconnects shows the room, not the detail page, by design.

## 11. Integrated implementation (Codex)

The initial proposal above is implemented with the following final choices. `room-hub.ts` routes the existing handshake, with 32 shared-room and 256-connection bounds, unique room codes, and each room's existing two-minute host reconnect grace. It uses a private random autosave directory per room. HTTP saves add `X-Party-Room` in `PartySession`. No optional room-preview HTTP endpoint or create-with-gameId shortcut was needed; the UI retains create-then-select.

The optional creator/detail/capabilities/tags fields now exist directly in `catalog.ts`, seeded for all nine games. No `lan-only` capability is emitted: `PUBLIC_ORIGIN` configures the public HTTPS invite address for both runtimes. The existing static fallback already serves clean `/games/<id>` detail paths; emitted share links remain `?game=` for this release. Favorites/recent remain local to the browser.

Fable's follow-up review was applied: shared games prioritize Join on narrow/coarse-pointer devices; desktop prioritizes hosting; route navigation resets scroll and focuses the heading. Blockwild copy describes room lifetime in player language. Final verification and precise deployment limits are in [MVP QA](../../output/platform-mvp/QA.md) and [public-preview operations](../party-platform/PUBLIC-PREVIEW.md).
