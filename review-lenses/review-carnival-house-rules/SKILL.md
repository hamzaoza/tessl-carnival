---
name: review-carnival-house-rules
description: Review a change to a carnival game for the house rules in AGENTS.md: every game registers on the midway, reports scores through the shared scores module, and draws with the carnival's theme. Use as one lens in a code review run on changes under src/games.
---

# Review lens: Carnival House Rules

Review changes to games under `src/games/` against house rules 1 to 3 in `AGENTS.md`, for a game that is missing from the midway, keeps its own scores, or draws in colours and fonts the rest of the carnival does not use.

## Scope

- **Registration** Whether every game lives in `src/games/<game-id>/`, exports a `CarnivalGame` from `game.ts`, is listed in `src/games/index.ts`, and has an `id` matching its folder name.
- **Scores** Whether a game reports each finished round once through `recordScore(game.id, score)` from `src/carnival`, rather than reading or writing local storage itself, keeping its own high score table, or recording more than once per round.
- **Theme** Whether a game takes its colours, fonts and sizes from `theme` and `canvasFont` in `src/carnival/theme.ts`, rather than writing its own hex, `rgb()` or named colours, or its own font strings.

## Method

Start at each changed game's `game.ts` and follow its imports. Check the exported `CarnivalGame` against its folder and against the list in `src/games/index.ts`. Trace the end of a round to the call that records its score, and check that no other path writes a score or touches storage. Read every value assigned to `fillStyle`, `strokeStyle`, `shadowColor`, `font` and gradient colour stops, and every colour or font in DOM styles the game sets, back to where it comes from.

## Threshold

Report a change that breaks one of these rules in code under `src/games/`.

Be accurate about the consequence:

- A game missing from `src/games/index.ts` gets no booth on the midway and cannot be played.
- A game whose `id` differs from its folder name breaks the house rule, but the router and midway use `game.id`, so nothing breaks for the player. Report it as a convention violation, not a broken route.
- A game that keeps its own scores or storage leaves the midway's best scores and booth card wrong for that game.
- A hard-coded colour or font makes the booth look out of place, and does not follow later changes to the theme.

Do not report:

- Code outside `src/games/`. `src/carnival/` defines the theme and the scores module, and `src/midway/palette.ts` has its own scenery colours.
- Values derived from the theme, such as a colour from `theme.colors` with transparency added, a size computed from `theme.font` or `theme.canvas`, or a string built with `canvasFont`.
- Test data in `game.test.ts`.
- Anything lint, the type-checker or the tests already enforce, such as `src/games/index.test.ts` comparing registered ids with folder names, unless the change weakens or removes that check.
- Other house rules, such as cleanup in `start`, READMEs or test coverage. Correctness and maintainability belong to the other lenses.

## Reporting

- Name the game, the house rule, and the line that breaks it.
- State the consequence for the player or the midway as above, without overstating it.
- State the smallest fix: the line to add to `src/games/index.ts`, the `recordScore` call to keep, or the `theme` value or `canvasFont` call to use instead.
