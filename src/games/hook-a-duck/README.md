# Hook a Duck

Rubber ducks float round a stream in a loop. Lower your hook as one passes to
catch it.

## How to play

- Move the mouse to aim the hook. A ring shows where it will land.
- Click to lower the hook. It takes a moment to reach the water, so aim a little
  ahead of the duck you want.
- If a duck is under the hook when it lands, you catch it. The hook brings it up
  and puts it back in the stream.
- You have 8 casts. The round ends when the last cast is back up.
- Click again on the game over screen to play another round.

## Scoring

Each duck has a number on its base, and catching it scores that number. A cast
that misses scores nothing.

| Ducks in the stream | Points each |
| ------------------- | ----------- |
| 5                   | 5           |
| 4                   | 10          |
| 2                   | 20          |
| 1                   | 50          |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `cast`, `step`, `duckAt`,
  `duckPosition`) and the `hookADuck` entry the midway registers.
- `game.test.ts`: tests for the game logic.
