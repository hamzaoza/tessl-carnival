import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  NECK_RADIUS,
  RINGS_PER_ROUND,
  bottleAt,
  createState,
  step,
  throwRing,
  wobble,
  type RingTossState,
} from './game';

/** Throws a ring that lands exactly on (x, y), allowing for the wobble. */
function throwAt(state: RingTossState, x: number, y: number) {
  const drift = wobble(state.time);
  return throwRing(state, x - drift.x, y - drift.y);
}

describe('ring toss', () => {
  it('starts with a full set of rings, no score and no ringed bottles', () => {
    const state = createState();
    expect(state.rings).toBe(RINGS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.bottles.length).toBeGreaterThan(0);
    expect(state.bottles.every((b) => !b.ringed)).toBe(true);
  });

  it('uses one ring per throw', () => {
    const state = createState();
    expect(throwRing(state, 400, 200)).toBe(true);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
    expect(state.ring).not.toBeNull();
  });

  it('throws one ring at a time', () => {
    const state = createState();
    throwRing(state, 400, 200);
    expect(throwRing(state, 400, 200)).toBe(false);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
  });

  it('cannot throw once the rings run out', () => {
    const state = createState();
    state.rings = 0;
    expect(throwRing(state, 400, 200)).toBe(false);
    expect(state.ring).toBeNull();
  });

  it('scores a ring that lands on a bottle neck', () => {
    const state = createState();
    const bottle = state.bottles[0];
    throwAt(state, bottle.x, bottle.y);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(bottle.points);
    expect(bottle.ringed).toBe(true);
    expect(state.ring).toBeNull();
  });

  it('does not score until the ring lands', () => {
    const state = createState();
    const bottle = state.bottles[0];
    throwAt(state, bottle.x, bottle.y);
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(0);
    expect(state.ring).not.toBeNull();
  });

  it('scores nothing for a ring that misses every neck', () => {
    const state = createState();
    throwAt(state, 5, 480);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(0);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
  });

  it('lets each bottle hold only one ring', () => {
    const state = createState();
    const bottle = state.bottles[0];
    bottle.ringed = true;
    expect(bottleAt(state, bottle.x, bottle.y)).toBeUndefined();
  });

  it('only counts a landing inside the neck', () => {
    const state = createState();
    const bottle = state.bottles[0];
    expect(bottleAt(state, bottle.x + NECK_RADIUS - 1, bottle.y)).toBe(bottle);
    expect(bottleAt(state, bottle.x + NECK_RADIUS + 1, bottle.y)).toBeUndefined();
  });

  it('scores bottles further back higher', () => {
    const { bottles } = createState();
    const back = bottles.reduce((a, b) => (b.y < a.y ? b : a));
    const front = bottles.reduce((a, b) => (b.y > a.y ? b : a));
    expect(back.points).toBeGreaterThan(front.points);
  });

  it('ends the round when the last ring has landed', () => {
    const state = createState();
    state.rings = 1;
    throwRing(state, 400, 200);
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, FLIGHT_TIME);
    expect(state.phase).toBe('over');
  });
});
