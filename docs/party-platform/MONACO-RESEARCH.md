# Monaco research for Night Job

Research date: 2026-09-20. Reference: **Monaco: What's Yours Is Mine (2013)**. Companion: [implementation plan](../game-plans/night-job.md). This is research and planning, not a claim that a game has been implemented or playtested.

## What makes it work

Monaco combines solo and up-to-four-player cooperative heists with eight specialists. The official release supports online and same-screen play. Its essential loop is choosing a crew, entering a location, taking the objective, and escaping together. [Official game description](https://store.steampowered.com/app/113020/Monaco_Whats_Yours_Is_Mine/)

The most useful primary design source is Andy Nguyen's GDC presentation. It identifies unpredictability, improvisation, and emotional range as design goals. The team deliberately retained restrictive sight and variable guard behavior despite requests for more predictable stealth. Our interpretation: being discovered should create an exciting recovery problem, not automatically invalidate a run. [Developer presentation, slides 10–14](https://media.gdcvault.com/GDC2014/Presentations/Andy_Nguyen_Monaco_Whats_Yours.pdf)

The design depends on a small control vocabulary producing many situations. Movement also performs contextual work: press against a locked door, safe, or other interaction and wait while exposed. Sneaking and one equipped tool supply the other major controls. Loot replenishes equipment as well as improving results, so taking a detour can enable an escape. [Contemporary controls and mechanics review](https://www.pcgamer.com/monaco-whats-yours-is-mine-review/)

## Visual reference, inspected directly

I inspected an [official gameplay screenshot](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/113020/ss_3242aa8249f2cfc3bf8baff15ef784584fa8fdea.1920x1080.jpg) and the original artist's [environment asset sheet](https://www.adamdegrandis.com/images/pocketwatch_monaco_assets.jpg). Adam deGrandis describes producing most of the environment artwork and contributing characters, UI, and branding. [Artist portfolio](https://www.adamdegrandis.com/project_pocketwatch.html)

Observations from those images:

- The camera looks straight down. Walls, doors, furniture, and narrow routes form an architectural plan.
- Unseen space remains useful as a muted gray schematic with hatch patterns, room labels, and selected symbols. It is not simply black fog.
- Revealed interiors have rich local color, textured floors, dense props, and pools of light. Visibility boundaries make passing a doorway visually dramatic.
- Actors are tiny relative to the environment. Saturated silhouettes and nearby symbols carry identity; loot and security devices are strong graphic marks.
- The asset sheet includes rugs, seating, kitchen and bathroom fixtures, plants, vehicles, machinery, and decorative objects. Repeating flat rectangles would lose much of the reference's character.
- Pixel detail and atmospheric lighting coexist. Making every surface neon or applying heavy blur would lose the hierarchy between architecture, actors, and hazards.

These are visual observations, not measurements of the original engine, tile resolution, camera rules, or shader pipeline. The reference images remain external research references, not bundled game assets.

## Mechanics to preserve

| System | Research finding | Design consequence |
| --- | --- | --- |
| Contextual interaction | Walking into an object starts its timed action. | Keep the player's attention on routes and danger; avoid an interaction menu. |
| Tool economy | One carried tool; each ten personally collected coins grants another use. | Optional loot should matter during the heist, not only at the scoreboard. |
| Detection | Suspicion progresses through question/exclamation feedback; the player can break contact. | Communicate escalation and recovery clearly. |
| Hiding and shortcuts | Bushes, windows, vents, and passages change movement and exposure. Being seen entering a hiding place matters. | A hiding button must not erase an informed pursuer. |
| Security | Cameras, lasers, doors, and alarms can be connected; hacking or power changes affect those connections. | Model explicit circuits rather than independent decorative hazards. |
| Rescue | Cooperative players can revive fallen teammates. | Rescue should be dangerous, achievable, and relevant to escape. |
| Results | Completion time is adjusted by missed loot; full collection rewards a different route from a fast exit. | Show raw time and loot separately as well as an adjusted result. |

The tool list includes firearms, smoke, healing, tranquilizing, instant-interaction equipment, and an EMP. We should preserve their different purposes before considering a large inventory. [Tools reference](https://monacowhatsyoursismine.fandom.com/wiki/Tools)

Doors, windows, hiding places, computer terminals, power switches, disguises, and medical pickups share the same interaction language. The community reference reports three-second ordinary lockpicking versus one second for the Locksmith. These are useful starting comparisons, not independently measured constants. [Interactables reference](https://monacowhatsyoursismine.fandom.com/wiki/Interactables)

The stealth reference documents escalating suspicion and hiding; its description of predetermined patrols conflicts with the developer's emphasis on random AI. Follow the primary source's design intent and use seeded variation with readable local behavior. Do not claim an exact reconstruction of the original AI. [Stealth reference](https://monacowhatsyoursismine.fandom.com/wiki/Stealth)

The achievement walkthrough reports a ten-second penalty per uncollected coin and describes teammates and NPCs reviving their allies. Treat the numerical scoring rule as secondary-source evidence pending direct comparison with the target game version. [Scoring and equipment reference](https://www.trueachievements.com/game/Monaco/walkthrough/2)

## The eight specialists

| Original role | Defining contribution | Equivalent proposed for our game |
| --- | --- | --- |
| Locksmith | Faster locks and safes | Cracker: safe and door specialist |
| Lookout | Detects NPCs beyond normal sight while still or sneaking | Scout: intentional intelligence markers |
| Pickpocket | A companion collects nearby money | Magpie: animated companion retrieves nearby loot |
| Cleaner | Incapacitates unsuspecting NPCs | Ghost: close-contact silent takedown |
| Mole | Digs through eligible walls | Breacher: noisy structural shortcuts |
| Gentleman | A disguise that can recover in hiding | Impostor: recoverable disguise |
| Hacker | Security interference and additional hacking access | Wire: circuit specialist |
| Redhead | Charms/distracts an NPC | Face: draws one guard away |

The first four are the original starting crew. Secondary specialties also shorten particular interactions. Role mechanics are summarized from the [class reference](https://monacowhatsyoursismine.fandom.com/wiki/Classes), [Gentleman reference](https://monacowhatsyoursismine.fandom.com/wiki/Gentleman), and [GDC narrative analysis](https://media.gdcvault.com/GDC2014/GameNarrativeReview/Bowman_Jonathan_MonacoWhatsYoursIsMine.pdf). Proposed names and implementations are our design, not Monaco terminology.

A useful principle from the narrative analysis is that a specialist contributes an advantage rather than being a mandatory key. Our level validation should enforce a viable solo route for every released role. A crew succeeds through complementary opportunities, not a required class composition.

## Missions, tone, and sound

The original uses a sequence of authored jobs and an ensemble crime story with differing accounts of events. Locations and obstacles change while the core controls remain stable. Story, character unlocks, optional completion goals, and replay give the simple actions context. Our adaptation should have authored routes and short original briefings; the first release need not reproduce the original campaign's length or plot. [Campaign overview](https://en.wikipedia.org/wiki/Monaco%3A_What%27s_Yours_Is_Mine)

Audio is a substantial part of the feel. Austin Wintory describes the original's vaudevillian upright piano when discussing the sequel. That supports a playful caper mood instead of a heavy tactical soundtrack. The project handbook reserves music for the user: plan hooks for calm, suspicion, pursuit, and escape, and implement original gameplay sound effects separately. [Composer's discussion](https://austinwintory.bandcamp.com/album/monaco-2)

## What remains uncertain

This research used official descriptions and imagery, developer slides, an artist portfolio, and secondary mechanics references. I did not play an installed copy, measure animation/input timings, or inspect the original source. Classic versus Enhanced changes make a few details version-dependent.

Before claiming close mechanical fidelity, compare: camera zoom when the crew separates; shared versus individual vision; blueprint discovery radius and memory; guard sight angles and sound propagation; progress cancellation; tool aiming and recharge on floor changes; solo death behavior; exact exit requirements and scoring. Our implementation plan makes explicit defaults for these instead of treating guesses as facts.

The largest fidelity risks are generic room art, oversized characters, omniscient guards, instant failure on detection, noisy UI covering the map, and touch latency. These are more important to resolve early than campaign size, a map editor, procedural generation, or a 3D asset pipeline.
