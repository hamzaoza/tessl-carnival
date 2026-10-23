# Ring Toss

Land rings on the necks of the bottles at the back of the booth.

## How to play

- Move the mouse to aim. The circle shows where the ring will land, and it
  drifts a little, so time your throw.
- Click to throw a ring. You throw one ring at a time, and have 10 rings a round.
- A ring that lands on a bottle's neck stays there. Each bottle holds one ring.
- The round ends when you are out of rings and the last ring has landed.
- Click again on the game over screen to play another round.

## Scoring

Three rows of five bottles. Bottles further back score more:

| Row    | Points |
| ------ | ------ |
| Back   | 30     |
| Middle | 20     |
| Front  | 10     |

A ring that misses every neck scores nothing. Your final score is saved to the
carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `throwRing`, `step`, `bottleAt`,
  `wobble`) and the `ringToss` entry the midway registers.
- `game.test.ts`: tests for the game logic.
