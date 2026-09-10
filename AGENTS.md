# Project instructions

These instructions apply throughout this project.

## Start here

- Read [the game-building handbook](docs/party-platform/AGENT-HANDBOOK.md) before game or platform work. [IMPLEMENTATION.md](docs/party-platform/IMPLEMENTATION.md) maps the current runtime; exported TypeScript types and source define the actual API.
- Apply [party-platform-ui](.agents/skills/party-platform-ui/SKILL.md) when creating or changing UI. For 3D or continuous-input games, also read [3D readiness](docs/party-platform/3D-READINESS.md).
- For a new 3D game, reuse the implemented runtime and [Scene Lab example](packages/games/scene-lab/README.md). Use the isolated build/QA commands in the 3D guide; do not expose the development fixture in a normal game build.
- This repository already has a shared launcher, room server, client, UI package, and nine catalog games. Eight use the shared room runtime; Kart Party is mounted from `modules/kart-party` with its existing racing protocol. Do not recreate the platform from the historical Kart Party proposal or invent missing reference APIs.

## Editing and validation

- Never run Prettier, including scripts or formatter flows that invoke it.
- Use the fewest lines that satisfy requirements. Prefer the cleanest fix; elegance over complexity.
- After code changes, explain important decisions and briefly walk through the changed code.
- Browser QA is authorized for this project's requested game, UI, and platform work. Agents may open, navigate, interact, take screenshots, and run automated browser checks without asking again. Use isolated test rooms, synthetic players, and owned browser/server sessions; preserve any user session or live room. This permission does not authorize unrelated websites, external messages, purchases, or publishing.
- Validate the smallest relevant slice first. For game UI, test the advertised maximum roster and maximum legal content early. New games require a real join-to-results game and replay; refinements may reuse recorded complete-flow evidence alongside focused retests of changed behavior. Emulated phones are not physical-device evidence.
- Keep browser QA to one active owner and at most three visible QA windows across the batch (one host and two phones). Reuse owned sessions, close them when idle, and use headless browsers for larger rosters. Never close user windows or run global browser cleanup.
- Follow the handbook's build freeze and browser ownership rules. Record actual checks and remaining limits; static checks alone do not prove visual quality or gameplay feel.

## Git permissions

Do not stage changes, create or amend commits, push branches, or create or update pull requests unless the user explicitly requests that exact action for the current change. Earlier permission does not carry forward to later edits, follow-up fixes, review feedback, or cleanup.

## Agent coordination

When delegation is authorized, use bounded briefs and explicit file ownership. The subagent tool rejects full-history forks. These documents do not themselves authorize new tasks or delegation. Use the [game brief](docs/party-platform/GAME-BRIEF.md) for assigned work.

Consult Claude only when the user requests it. Use the actual ask-claude skill, default paired session unless the user names another model/workflow, and scoped game UI source plus relevant screenshots. Do not infer a standing Claude mandate from historical Fable references. If execution is rejected, report the action and reason once; preserve the brief and wait for a supported authorization/access change instead of retrying the same rejected request across tasks. Project instructions do not override tool permissions.

## Repository boundary

The separate `partyplay-games` repository is checked out as the `game-modules` submodule. `packages/games`, shared runtime packages, `modules/kart-party`, and `public/games` are relative symlinks into it. Commit game changes there first, then update the pinned submodule commit here. Keep game source/assets out of the platform Git history. Read `docs/REPOSITORIES.md` for checkout and validation commands.
