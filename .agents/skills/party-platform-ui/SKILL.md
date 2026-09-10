---
name: party-platform-ui
description: Apply this project's shared party-platform UI contract when creating, changing, or reviewing game UI, phone controllers, lobbies, launcher screens, HUDs, or shared visual primitives.
---

# Party platform UI

Use the current [shared exports](../../../packages/party-ui/src/index.ts), [primitives](../../../packages/party-ui/src/primitives.tsx), and [stylesheet](../../../packages/party-ui/src/style.css). [IMPLEMENTATION.md](../../../docs/party-platform/IMPLEMENTATION.md) explains the actual shell. Do not import nonexistent Kart Party helpers or copy its racing UI wholesale. Browser QA for requested project work is authorized by [AGENTS.md](../../../AGENTS.md); this skill does not grant unrelated work, delegation, Claude consultation, or git publication.

## Preserve the family, give the game its own identity

Reuse the existing tokens and locally hosted fonts. Keep `kp-` for shared code and scope game CSS under its game ID. Scene art may extend colors without redefining shared tokens. The reference Tailwind classes are not an installed API here.

| Token | Value |
| --- | --- |
| `--kp-ink` | `#05071a` |
| `--kp-navy` | `#0b1030` |
| `--kp-cream` | `#fff6e5` |
| `--kp-sun` | `#ffd24a` |
| `--kp-coral` | `#ff5748` |
| `--kp-sky` | `#28c6e7` |
| `--kp-lime` | `#78d955` |
| `--kp-grape` | `#b58aff` |

Use Lilita One for display text, Nunito for body copy, and the existing `kp-display`, `kp-title`, `kp-numeral`, and `kp-hud-text` helpers as appropriate. Preserve font licenses, readable contrast, QR quiet zones, and safe-area variables. Decorative headings should not compete with the current prompt or action.

Reuse ArcadeButton, Panel, Modal, Eyebrow, StatusNotice, TextInput, ToggleRow, Countdown, DrawingPad, and DrawingRenderer where appropriate. Read their real props. Preserve native semantics, accessible names, 3px focus rings, pressed/disabled states, modal Escape/Tab/Shift+Tab behavior, and focus restoration. HoldButton, SteerPad, and RotatePrompt are exported from action-controls.tsx for continuous-input games. Compose their changes into one complete held-input state and call releaseInput when neutral. A split-screen helper is not implemented; agree on its layout contract if a game needs it.

Each game should have a recognizable art direction, meaningful action feedback, clear results, and its own scene composition. The shared palette does not require every game to be a grid of identical panels. Choose composition from the gameplay, inspect real renders, and keep successful art rather than adding decoration to fill empty space.

## Reuse the room flow

The shared shell owns host authority, QR/code, seats, readiness, loading, reconnect, host controls, and sound unlock. A watching host occupies no player seat. Respect the manifest's minimum and maximum roster. Do not add a second lobby or socket inside a game. Show private role/instructions only on the intended player's screen; public animation must not reveal hidden state early. Avoid role-specific colors, oversized labels, or obvious panel silhouettes visible to neighbors. Check both roles with readable prompts and usable controls.

Make the current task obvious on the phone. Distinguish draft, pending, accepted/locked, time up, reconnecting, and spectator states. Server rejection needs a useful message. Preserve unfinished drafts across reload with player/round/turn scoping; do not let visual refactoring remount a form and discard its input.

## Design for the actual content limit

Before detailed polish, render the maximum advertised roster and legal content at 1280×720. Include long names, all distinct maximum-length answers plus decoys, many voters on one entry, shared winners, and two-digit ranks. Derive layout density from actual roster/option count, not the minimum-player demo. The first batch's Tall Tales maximum was 13 choices, not 10 players or the 11 choices produced by duplicate lies.

Keep the active prompt, complete choices, essential outcome, and necessary standings visible on the shared display. Use wider grids, compact score strips, or progressive disclosure of secondary details before reducing text size. Do not clip authored answers, conceal names, or use `overflow:hidden` to manufacture a passing height measurement. If votes move from cards into a named score strip, preserve an explicit matching label so every voter remains identifiable.

On phones, put actionable information before credits and scenery. Preserve complete choices and readily reachable primary controls. Check which inputs/options are visible on arrival; after scrolling, inspect the selected item and sticky submit together for overlap. A results gallery may scroll; distinguish that from a timed ballot with inaccessible choices. Avoid breaking a rank such as #10 or an ordinary name across arbitrary fragments. Keep colors paired with names, numbers, or icons.

## Controller and drawing behavior

Typing, drawing, quiz, and voting controllers must work in portrait and remain usable in short landscape. Do not disable scrolling or text selection across forms. Apply `touch-action:none` only to an input surface that requires it. Every active control has a 44px minimum target; prefer 48px for portrait phone actions when space permits. Use at least 16px text for text inputs and compact phone choices.

Use the same normalized square geometry for drawing display and pointer mapping. Test real strokes in portrait and landscape, save/reload, undo/clear, and maximum drawing detail. A pretty canvas with a displaced input path fails acceptance.

For two-thumb action controls, movement belongs left and the largest repeated action near the resting right thumb, with secondary actions above. Capture pointers and release held state on pointercancel, lost capture, blur, hidden tab, disconnect, rotation, and unmount. Match the game's real neutral-input schema; do not assume null clears movement. Orientation/fullscreen requests follow a user gesture and retain a usable fallback. Read [3D readiness](../../../docs/party-platform/3D-READINESS.md) for the implemented simulation, scene-readiness, input, and cleanup APIs.

## Motion and 3D presentation

Use animation to explain submission, reveal, impact, progress, and winning. Never hide readable answer text while waiting for a decorative transition. Disable decorative loops/transitions under reduced motion; countdown correctness must not depend on animation. Fixed edge controls and HUDs respect safe areas.

For 3D, judge the playable camera and HUD together. Keep the controlled subject, hazards, targets, and aim/landing cues legible through movement and effects. One shared camera is often enough; use multiple viewports only if the game needs them. If split views are implemented, canvas and HTML overlays must use the same layout data. Do not invent an existing split-screen API.

## Acceptance evidence

For changed views, check phones at 320×568, 390×844, 667×375, 844×390 and displays at 1280×720, 1920×1080. Test minimum and maximum advertised rosters, legal maximum content, empty/error/reconnect states, ties, and missing submissions relevant to the change. Verify hit targets, focus, reduced motion, complete text, descendant overflow, and actual action results. Inspect representative screenshots as well as DOM measurements.

A game owner verifies its maximum roster before handoff; the coordinator spot-checks independently rather than discovering every density defect at the end. Use the [handbook's](../../../docs/party-platform/AGENT-HANDBOOK.md) stable-build and timed-scenario workflow. Record build hash, phase, roster, content limits, viewport, actual result, evidence path, and unrun gates. Browser emulation does not prove native keyboards, physical touch, viewing distance, accessibility certification, hardware performance, or human pacing.
