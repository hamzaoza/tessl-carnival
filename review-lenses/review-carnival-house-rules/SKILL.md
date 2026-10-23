---
name: review-carnival-house-rules
description: Review a change to a carnival game for the house rules in AGENTS.md that keep every game working on the midway - registering on the midway, reporting scores through the shared scores module, and drawing with the carnival's theme. Use as one lens in a code review run.
---

# Review lens: Carnival House Rules

Review changes under `src/games/` for whether each game still plugs into the shared carnival the way the house rules in `AGENTS.md` require. A game that skips them still builds and passes its tests, but it is missing from the midway, keeps scores the midway can't see, or looks out of place next to the other booths.

## Scope

- **Registration** Whether a game can be reached from the midway: it lives in `src/games/<game-id>/`, exports a `CarnivalGame` from `game.ts`, is added to the list in `src/games/index.ts`, and its `id` matches its folder name. A game that is built but not listed, or listed under an `id` that differs from its folder, gets no booth or a broken route.
- **Scores** Whether a game's scores reach the shared board: it calls `recordScore(game.id, score)` from `src/carnival` once, when a round ends. A game that reads or writes local storage itself, keeps its own high score table, records on every frame or point, or never records, leaves the midway showing the wrong best score.
- **Theme** Whether a game draws with the carnival's look: colours, fonts and sizes come from `theme` and `canvasFont` in `src/carnival/theme.ts`. A hex colour, `rgb()` string, named colour or font string written inside a game drifts from the rest of the midway when the theme changes.

## Method

Start from each game folder the change touches. Read its `game.ts` for the exported `CarnivalGame` and its `id`, then check `src/games/index.ts` for the matching entry. Follow the end of a round to where its score is recorded, and search the game's files for `localStorage`, `sessionStorage` and score tables. Read every `fillStyle`, `strokeStyle`, `shadowColor`, gradient stop and `font` assignment the change adds, and trace its value to `theme` or `canvasFont`.

## Threshold

Report a rule the changed game code breaks, with the line that breaks it.

Do not report:

- Code outside `src/games/`. `src/carnival/` defines the theme and scores, and `src/midway/` draws the map with its own palette built on the theme.
- A value derived from the theme, such as `theme.colors.accent`, a colour built from theme values, or a size computed from `theme.canvas`.
- A colour or font that was already in the file and the change did not touch. Mention it once, as out of scope for this change, only when the change edits the same function.
- Test files that construct colours or scores as test data.
- Anything lint, the type-checker or the game's tests already enforce, such as the `CarnivalGame` type's required fields.

## Reporting

- Name the house rule by number and title from `AGENTS.md`, and the file and line that breaks it.
- Say what the player or the midway gets wrong because of it: a missing booth, a wrong best score, a colour that doesn't match.
- State the fix: the entry to add to `src/games/index.ts`, the `recordScore` call and where it belongs, or the `theme` key or `canvasFont` call to use instead.
