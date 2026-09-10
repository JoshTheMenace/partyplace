# Copyable game assignment

Replace the bracketed fields before dispatch. Use a bounded task; do not forward an entire noisy orchestration history.

```text
Build/refine [game title/id] in this existing partyplay collection.

Outcome: [core interaction and complete round loop; what makes it fun].
Pacing: [target duration, readable minimums, all-submitted and missing-input policy].
Modes/roster: [implemented target modes, minimum/maximum players].
Controls/privacy: [orientation, state vs action, private information].
Scope: [new slice/full game/UI refinement]. Preserve [rules/music/etc. as applicable].

Read AGENTS.md, docs/party-platform/AGENT-HANDBOOK.md,
IMPLEMENTATION.md, the current TypeScript exports, and party-platform-ui.
For 3D/continuous input, also read 3D-READINESS.md; choose the implemented scene/input/simulation APIs and state any remaining game-specific gaps.

Own only [exact game paths] and [evidence directory].
[Platform owner/task] owns shared files, registries, builds and the live runtime.
Reserve [QA port] and [browser session name]; record actual owned process IDs.
Do not touch [protected paths/live room/server]. Browser QA is authorized by
project instructions. Git publication and external consultation have separate scope.

Build one real join → action → result → replay slice first.
Before decorative expansion, check [maximum roster + exact maximum text/choices,
ties, concentrated votes, or simultaneous bodies/events] on phone and display.
For 3D, state [hardware/camera count/frame/input/load budget and coordinate contract].

Validation: [focused rules/lifecycle cases], then relevant root checks,
real minimum/maximum-roster browser scenarios, six viewport sizes, and A → B → A.
Record accepted actions, exact phase/build/measurements, screenshots inspected,
and physical-device/performance gaps. Retest changed states after repairs.

Before a build, report one coherent source-ready batch and freeze edits until the
builder releases the build/QA window. Cancel and await acknowledgement before
editing sooner. Shared builds require a safe boundary for every live session;
otherwise defer or use isolated build output and assets. Final report: outcome, decisions/code walkthrough, commands,
current build/evidence, remaining gaps, and cleanup of only owned QA resources.

Claude, only if explicitly requested: [review scope and relevant source/screenshots].
Use actual ask-claude; report selected/declined advice. Do not invent a review or
retry rejected calls through another task without a supported authorization change.
```
