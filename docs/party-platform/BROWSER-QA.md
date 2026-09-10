# Browser QA and polish

The subsequent user-requested Claude visual refinement is documented in [the independent refinement report](../../output/claude-refinement/ROOT-QA.md). The first implementation pass below remains historical evidence; the refinement report records later changes and their current validation status.

The user authorized browser QA on 2026-09-08 and requested professional look and play comparable to Kart Party. These results describe local Chromium with a host and isolated phone browser contexts, not physical devices.

## Evidence and scope

The root inspected the reference Kart Party menu/lobby, then the collection entry, picker, controllers, important game phases and results. Screenshots are under `output/playwright/`. The collection runtime is http://localhost:4320 (LAN http://192.168.0.24:4320). Reference servers on 4317/4318 remain untouched. The implementation is one room per server process, with same-tab reconnect credentials; restarting the server clears the room.

Root independently verified 151/151 tests, full typecheck and lint after the functional repairs. Platform verified the coordinated production build. Later CSS/copy polish is rechecked by the relevant owner and build coordinator.

## Live acceptance

| Game | Browser evidence | Status |
| --- | --- | --- |
| Quip Clash | Two complete games with three phones; actual text submissions, anonymous votes, author exclusion, scoring, missed-ballot fallback, saved draft/reload, results, replay; repaired early reveal retested | Passed |
| Sketch Bluff | Complete minimum-three game with actual pointer drawings; three exhibits, draft/caption/submitted reload, bluff/guess/artist scoring; second game retested repaired views | Passed; [owner evidence](../../output/playwright/sketch-bluff/qa-evidence.md) |
| Tall Tales | Complete seven-question game, three phones, truth rejection, duplicate/own-lie handling, scoring/finale, draft/lie/vote reload, results and replay | Passed; [owner evidence](../../packages/games/tall-tales/BROWSER-QA.md) |
| Shirt Show | Initial full three-phone game with actual drawings/slogans/designs, private trays, reload, judge eligibility, cheers, byes and champion | Passed; [owner evidence](../../output/playwright/shirt-show/qa-evidence.md) |
| Odd One In | Four-phone secret delivery, saved text/choice/number/vote drafts, 12 actual answers and 12 votes across three repaired rounds, caught/escaped/tied results, replay and picker | Passed; [owner evidence](../../output/playwright/odd-one-in/qa-evidence.md) |
| Quiz Panic | Eight experiments and six-question escape completed with three phones; real answers, all rescue families, draft and accepted-answer reload, six-second early reveal, +2/+1 charge, catch-up +3, tied ranks and replay | Passed; full game plus focused final phone repair retest |

Root additionally completed Quip → Sketch → Quip in room 2BNCH7: retained all three seats and room code, drew and saved a real Sketch stroke, returned through confirmed host controls, started fresh Quip with zero scores and empty answers, and accepted a new answer. No rescan or duplicate roster. Backend socket tests also cover this lifecycle and maximum supported joining.

## Repairs and checks

- Rebuilt shared landing into a clear host/join layout; phone deep links prioritize name/join. The compact QR/roster rail and illustrated three-by-two picker show all six games at 1280x720.
- Phone lobbies put Ready before instructions. Gameplay uses a compact header with host-only room controls. Local favicon eliminates the404.
- Drawing surface now remains square in landscape. The original letterbox mapping caused about 110px pointer drift; Sketch final 844x390 and 667x375 checks measured effectively zero drift.
- Shared modal Tab and Shift+Tab explicitly wrap inside the dialog and restore focus. Root verified forward/backward wrap.
- Quip gets original stage art, visible answer progress, readable countdown and cue-card links. Final champion/ranked results inspected. Every eligible vote now advances after a 3.5-second minimum; deadline remains fallback. Live retest passed.
- Tall Tales saves unfinished private drafts scoped to player/round/turn, clears submitted drafts and compresses phone writing/reveal views. Root inspected the final six-choice reveal fitting1280x720 and landscape controller.
- Sketch gets original gallery art, readable countdown, compact caption rows, tie-aware standings and corrected drawing geometry. Owner inspected all requested sizes.
- Odd and Quiz add isolated unfinished-input recovery; Shirt gets an illustrated print studio and more compact creation/vote/results views. Final focused checks passed.
- Shared lazy-load error now offers an explicit Refresh and reconnect action. Root deliberately blocked one phone’s Tall Tales module request, observed the error action, removed the fault and clicked Refresh and reconnect. Alex resumed the same room GRGH7Z and seat; all three remained connected.

Quip writing and results measured 320x568, 390x844, 844x390 and 667x375 with no horizontal overflow and no visible form/button target below44px. Sketch and Tall owners checked those four phone sizes plus 1280x720/1920x1080 displays, keyboard focus and reduced motion. Screenshots were inspected, not inferred from builds.

## Evidence limits

Browser automation was disrupted once when all named CLI sessions disappeared; owners reopened only their own sessions. Concurrent client rebuilds also exposed stale lazy chunks, prompting the recovery action above. These tooling interruptions are separated from game behavior. A Quiz owner’s 4325 launch was rejected by automatic approval review; root performed its QA on the existing4320 instance instead.

Physical touch devices, native soft keyboards, TV legibility at room distance, ten-device Wi-Fi load, hardware frame/input performance, full screen-reader accessibility, family pacing playtests and audio-device behavior remain unverified. Music is reserved for the user. No staging, commits, pushes, PRs or deployment occurred.

Quiz evidence: room UBDFLW finished Casey 8 steps/13 charge, Alex 4/7, Blair 4/8. Early quiz questions missed during inspection advanced normally; later rounds used actual submissions. Five-symbol draft Bolt → Drop → Drop → Sun → Drop survived reload and scored correctly. Estimate draft 30 survived reload; an accepted trivia answer resumed locked. Root console reported 0 errors / 0 warnings before intentional later fault testing. Results screenshot: `output/playwright/quiz-results.png`.

## Final acceptance

All six games reached results through real browser play. Root inspected the final Shirt Show 720p matchup, with shirts, credits, vote totals and collapsed history fully visible. Shirt owner verified design/vote/match-result document height720px and final content bottoms693/659/659px.

Quiz final questions fit all four phone sizes: buttons48px in portrait and44px in landscape. All four answers end by394px at320x568 and256px at667x375. Final five-symbol memory controls end at546.83px on320x568 and358.48px on667x375, with no horizontal overflow. Both screenshots were inspected. Sun then Undo worked; reduced motion reported zero running animations. The follow-up match was intentionally ended after the affected layouts were verified; the earlier full match and replay remain the completion evidence.

Final coordinated code passes151 tests, typecheck, lint and production build. Root closed its test room and named browser session after QA; the local4320 server remains available for the user. Owner QA servers4321–4324 were shut down separately. Music and physical-device acceptance remain as described above.
