# Blockwild and Kitchen Rush — managed parallel build

User request: build two ambitious, polished games concurrently, one Codex task each: a Minecraft rebuild and an Overcooked remake. Token usage is not a limiting constraint. Music is reserved for the user. The coordinator owns integration, shared platform changes, acceptance and repair dispatch.

## Ownership

| Owner | Writable paths | QA reservation |
| --- | --- | --- |
| Blockwild task | packages/games/blockwild/**, public/games/blockwild/**, output/blockwild/**, output/playwright/blockwild/** | ports 4351, 4352; browser blockwild-build |
| Kitchen Rush task | packages/games/kitchen-rush/**, public/games/kitchen-rush/**, output/kitchen-rush/**, output/playwright/kitchen-rush/** | ports 4353, 4354; browser kitchen-rush-build |
| Manager (01a081e4-aea1-7440-9b76-ae64675d6c2f) | apps/**, shared packages/party-*/**, root scripts/config/dependencies, docs/game-batches/voxel-kitchen/** | ports 4350, 4355; browser voxel-kitchen-manager |

This repository has no initial commit (HEAD does not resolve). Both tasks therefore use the existing local project with disjoint ownership. Do not initialize/commit/stage it to make a worktree. No git publication was requested. Protect existing servers and their immutable assets, particularly 4320 and 4340, plus the Kart Party reference. Verify reserved ports before listening; never kill another owner.

Read AGENTS.md, AGENT-HANDBOOK.md, IMPLEMENTATION.md, 3D-READINESS.md, the party-platform-ui skill and actual TypeScript APIs. Shared support exists, including fixed simulation, held-input resend/release, scene warmup, resource ownership, metrics and isolated builds. Scene Lab is a technical example, not the art or gameplay target.

## Coordination

Start by writing the game-owned DESIGN.md and a typed manifest/settings/state sketch, then implement a complete playable slice and expand it into the requested polished game. Send the manager concrete shared API needs early using send_message_to_thread. The manager handles registries, new capabilities, dependencies and build freezes. Do not wait idle on shared support: implement rules, geometry, content and tests independently.

When coherent source is ready, write output/<game>/STATUS.md and send its exact paths and validation to the manager. Freeze the game files until the manager acknowledges the isolated build. The manager returns the frozen build/URL for browser QA, then releases further edits. Each task must do its own min/max-roster browser QA and visual repair; the manager independently checks important flows. Do not declare a game finished from compilation, screenshots of an intro, fixtures alone, or bot-only play.

Report meaningful milestones, blockers and required repairs, not repeated unchanged status. Preserve actual source-ready/built/verified distinctions and exact evidence. No fixed time/token cap and no arbitrary early stop after the first slice. Complete the important mechanics, content and polish in the brief; report true remaining device limits. New user-owned tasks or external Claude consultation require user scope, not an invented historical mandate.

## Research references

Minecraft official overview: https://www.minecraft.net/en-us/about-minecraft — resource gathering, mining, crafting/building, survival at night, creative and survival modes, and cooperative worlds. Visual references: block-scale terrain layers, tree silhouettes, varied elevation, bodies of water, readable crosshair/hotbar, held tool and first-person scale. Screenshot reference: https://pic.clubic.com/183367e01697572/1414x809/smart/minecraft.png . Inspect actual references as needed; do not ship screenshots or extracted game assets as original art.

Overcooked 2 official page and media gallery: https://www.team17.com/games/overcooked-2 — cooperative cooking, distinct themed kitchens, recipes, throwing ingredients, dynamic layouts. Screenshot: https://www.team17.com/hs-fs/hubfs/ss_576e1f2d7ad0b02ded1b235bb2ce0c161e485131.1920x1080.jpg?length=1000&name=ss_576e1f2d7ad0b02ded1b235bb2ce0c161e485131.1920x1080.jpg . Visual references: overhead diorama camera, solid counters, legible ingredients/tools, distinct chefs, order tickets above the playfield and station progress over the station.

Implement original source, names, characters, art, levels and recipes/content arrangements. Preserve the recognizable core loops. Do not claim a full feature-for-feature reproduction of every commercial update or expansion.


## Browser window budget — user request

Only one task runs browser QA at a time, with at most three visible QA windows across this batch: host plus two phones. Reuse that set, close owned sessions while editing, and run larger rosters headlessly. The manager grants the active QA slot. Do not open another visible set just because a task has its own port. Never close user or another owner's windows, and never run global browser cleanup. Current cleanup requested for all three named batch sessions before the next build.
