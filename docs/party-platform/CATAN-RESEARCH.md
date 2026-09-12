# CATAN adaptation: research and open decisions

Research date: 2026-09-12. Implementation started in `game-modules/packages/games/island-settlers`; see its README for implemented behavior and limits.

Confirmed: support up to **10 human players**, a shared top-down host board, and private phone hands/actions. Research the original game before implementation. Claude Fable owns frontend and animations; Codex owns the remaining implementation. The initial supported roster is three through ten.

Additional confirmed preferences:

- Expansion support is a product goal. The user selected Seafarers first; larger rosters can choose either Standard or Connect-style.
- Aim for roughly an hour, allowing duration to vary with roster. This is a design target requiring playtesting, not a verified duration.
- Phones show an interactive map for placement when needed, with private hands/actions otherwise.
- Negotiate aloud; use phone offers, counteroffers, and final confirmation, with public trade information on the host.
- Fixed overhead camera with a slight tilt. Primary host hardware is a laptop connected to a TV.
- Support beginners and experienced players through contextual guidance.
- Host save/resume is desirable but may be deferred if it adds substantial complexity. Ordinary reconnection remains necessary.
- Standard and Connect-style are selectable settings, including for seven through ten players. Begin expansion implementation with Seafarers; the remaining expansions are a later product goal.

## Official rules consulted

The [official rulebook directory](https://www.catan.com/understand-catan/game-rules) separates current editions from archived editions. The current base-game PDF returned HTTP 429 through the research tool; the archived base rules and current 5–6 rules were readable. Verify the current base PDF before claiming sixth-edition conformance.

### Classic base game

The base game uses 19 terrain hexes, five resource types, and a finite development deck. Players have 15 roads, five settlements, and four cities. Variable setup places a settlement and road per player, then repeats in reverse order; starting resources come from the second settlement.

Production benefits all eligible players. Settlements produce one resource; cities produce two. Roads occupy edges; settlements occupy intersections and obey spacing and connectivity rules. Cities replace existing settlements. Trade/build may be combined. Bank rates are 4:1, general ports 3:1, and specialized ports 2:1 for their resource.

Development cards include Knight, Road Building, Year of Plenty, Monopoly, and hidden victory points. Normally only one card is playable per turn, never one bought that turn; victory-point cards have an exception. Victory requires ten points on the player's turn.

Source: [base rules and almanac, pages 2–14](https://www.catan.com/sites/default/files/2021-06/catan_base_rules_2020_200707.pdf).

### Edge cases to turn into tests

- Resource-hand sizes are public; contents stay private. Completed trades cannot be secret, and must involve the active player. Gifts and credit are prohibited.
- Seven resolution precedes trading. A Knight moves the robber without triggering discards.
- Resource shortages have a special case when only one player is owed that resource.
- Longest Road requires correct handling of loops, branches, opponent settlements, incumbent ties, and loss of ownership without a unique successor.
- A win can occur at turn start without rolling.

Source: [official base-game FAQ](https://www.catan.com/faq/basegame). This FAQ also contains historical and expansion-specific answers; apply only entries consistent with the chosen edition.

### Five or six players

The 2025 rules enlarge the board and supply and replace the older special building phase with paired turns. Player 1 completes production and actions; Player 2 then gets actions without player-to-player trading. Player 2 may build, trade with the supply, play a development card, and win. Development-card eligibility spans those distinct opportunities. The markers then move one seat clockwise.

Source: [2025 5–6-player rulebook, pages 1–4](https://www.catan.com/sites/default/files/2025-03/CN3082%20CATAN%20%E2%80%93%205-6%20Rulebook%202025%20reduced.pdf). Do not silently mix this with old special-building-phase rules.

## Expansion research

| Expansion | Main additions | Proposed order |
| --- | --- | --- |
| [Seafarers](https://www.catan.com/seafarers) | Ships, island maps, gold fields, pirate, scenario objectives. | First: exercises variable maps and new route pieces while retaining familiar settlement play. |
| [Cities & Knights](https://www.catan.com/cities-knights) | Board knights, barbarian attacks, commodities, city improvements, metropolises, progress cards. | Second: a substantial additional ruleset and phone interface. |
| [Traders & Barbarians](https://www.catan.com/traders-barbarians) | A collection of variants and scenarios, including fishing, rivers, merchant trains, and deliveries. | Later, one complete scenario at a time. |
| [Explorers & Pirates](https://www.catan.com/explorers-pirates) | Movable expedition ships carrying settlers, crews, fish, or spices; exploration and missions. | Later, as a distinct mode; its ships differ from Seafarers. |

Seafarers first is accepted; the order of later expansions is a recommendation. Expansion support must mean implemented, tested modes, not merely settings or unused hooks. The official Seafarers page describes compatible Cities & Knights scenarios, while Explorers & Pirates explicitly excludes combining its ship system with Seafarers. Offer curated compatible presets rather than unrestricted expansion toggles.

The [official player-extension overview](https://www.catan.com/explore-catan/catan-basegame-expansions/play-catan-5-6-players) covers these standard expansions through six players. Requiring an expansion does not by itself provide rules for ten.

### Large-group precedent

[CATAN Connect](https://www.catan.com/connect) is an official large-group format using shared dice rolls, timed rounds, and simultaneous trading/building. The [German product overview](https://www.catan.de/catan-connect) describes combining sets and its relationship to the older Big Game format. This provides a grounded alternative to scaling sequential turns. It is a separate ruleset, not an automatic expansion-compatible replacement for classic play.

The [English event rules](https://www.catan.com/sites/default/files/2025-06/CAT_Connect_Manual_Event_RZ%20ENG%20250514s.pdf) were subsequently downloaded directly and read locally, along with the current Seafarers rules. Connect uses even rosters, alternating active sides, visible resources and different robber/scoring rules. Our private-hand, shared-board Connect-style option is explicitly an adaptation, including support for seven and nine players.

## PartyPlay implications

These are implementation findings and proposed design choices, not tabletop rules.

- Reuse GameRules, authoritative actions, publicView/playerView, the shared room, and portrait controllers. Keep deck order, random state, and opponents' hands out of client projections.
- The room supports ten seats. Ten-player support is required: design and test board size, component supply, player identification, and trading density at ten from the first playable slice. Choose a documented classic adaptation or a separately researched Connect-inspired mode, with human pacing/balance tests.
- A trusted registration option now permits 4,096 actions/player at 1 KiB/action for this game, within the original worst-case retained-payload budget. Existing games retain 256 actions. WebSocket tests exercise the larger budget and acknowledgement deduplication.
- The host currently has a two-minute reconnect grace; server restarts discard active rooms. Save hooks exist, but secure board-game recovery, seat reassignment, and private-hand restoration need explicit design.
- Fable's read-only consultation recommends a host-only Three scene, DOM/SVG phones, shared geometry IDs, server-provided legal targets, zoom and confirmation for placement, spoken negotiation with structured trade confirmation, and stable public event IDs for animation. These choices are implemented; the current game QA report records verification.
- Fable suggests procedural board geometry with a small Blender kit for buildings, robber, dice, and terrain details. The user selected a tilted overhead view on a laptop connected to a TV; exact asset style remains an implementation design choice.

Local references: [handbook](AGENT-HANDBOOK.md), [runtime overview](IMPLEMENTATION.md), [contract](../../packages/party-contract/src/index.ts), [room implementation](../../apps/party-server/src/room-server.ts).

## Proposed implementation sequence

1. Choose the large-roster turn model. Write its board, supply, trading, robber, scoring, and conflict-resolution differences explicitly, with the hour target treated as a hypothesis.
2. Implement the complete core rules and a maximum-roster join-to-victory-and-replay slice. Use stable board IDs shared by rules and views. Keep authoritative state independent from animation.
3. Implement an initial complete Seafarers scenario to prove actual expansion support. Separate board/scenario definitions, economy/decks, turn progression, action validation, and scoring only where these concrete modes require different behavior.
4. Integrate Fable's board, phone placement, trade flow, beginner guidance, and event-driven animation. Inspect dense ten-player states before expanding decorative assets.
5. Add Cities & Knights, then selected additional scenarios. Test combinations explicitly; unsupported combinations stay unavailable.

Proposed defaults: human players only, minimum three for classic play, no forced turn timer in the faithful mode, explicit placement confirmation, and save/resume deferred from the first playable milestone. These are reversible scope assumptions. Durable recovery must not be advertised until implemented.

The user selected both turn styles as explicit settings. Standard and Connect-style both support three through ten; neither mode requires the Seafarers setting. The first Seafarers scenario is a generated Open Seas archipelago. Timers and layouts remain subject to real playtesting.

Production acceptance should include rules cases above, stale/duplicate actions, trade races, privacy checks, interruption recovery, and a real maximum-roster join-to-victory game followed by replay. Inspect the densest legal board and hand states early. Browser emulation cannot establish physical-phone usability or across-room readability.
