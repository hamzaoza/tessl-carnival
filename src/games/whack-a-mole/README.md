# Whack-a-Mole

Whack the moles as they pop up from the nine holes, before they duck back down.

## How to play

- Moles pop up from a 3 by 3 grid of holes and stay up for 1 second.
- Click a mole while it's up to whack it. Clicking an empty hole does nothing.
- At the start a mole pops up every second. By the end of the round one pops
  up every 0.35 seconds.
- The round lasts 30 seconds. Click again on the game over screen to play
  another round.

## Scoring

Every mole you whack scores 10 points. A mole can only be whacked once.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `whack`, `popInterval`) and
  the `whackAMole` entry the midway registers.
- `game.test.ts`: tests for the game logic.
