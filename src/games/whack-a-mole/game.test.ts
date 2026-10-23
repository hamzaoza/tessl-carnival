import { describe, expect, it } from 'vitest';
import {
  END_INTERVAL,
  POINTS_PER_WHACK,
  ROUND_SECONDS,
  START_INTERVAL,
  UP_TIME,
  createState,
  popInterval,
  step,
  whack,
} from './game';

const first = () => 0;

describe('whack-a-mole', () => {
  it('starts with a full clock, no score and every hole empty', () => {
    const state = createState();
    expect(state.timeLeft).toBe(ROUND_SECONDS);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.holes).toHaveLength(9);
    expect(state.holes.every((h) => h.up === 0)).toBe(true);
  });

  it('pops a mole up when the pop timer runs out', () => {
    const state = createState();
    step(state, START_INTERVAL, first);
    expect(state.holes[0].up).toBe(UP_TIME);
    expect(state.holes.filter((h) => h.up > 0)).toHaveLength(1);
  });

  it('drops a mole back down after its time is up', () => {
    const state = createState();
    state.nextPop = 100;
    state.holes[4].up = UP_TIME;
    step(state, UP_TIME, first);
    expect(state.holes[4].up).toBe(0);
  });

  it('scores a whack on a mole that is up and sends it down', () => {
    const state = createState();
    const hole = state.holes[2];
    hole.up = UP_TIME;
    expect(whack(state, hole.x + 10, hole.y)).toBe(true);
    expect(state.score).toBe(POINTS_PER_WHACK);
    expect(hole.up).toBe(0);
  });

  it('scores nothing for a whack on an empty hole', () => {
    const state = createState();
    const hole = state.holes[2];
    expect(whack(state, hole.x, hole.y)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('scores a mole only once', () => {
    const state = createState();
    const hole = state.holes[0];
    hole.up = UP_TIME;
    whack(state, hole.x, hole.y);
    expect(whack(state, hole.x, hole.y)).toBe(false);
    expect(state.score).toBe(POINTS_PER_WHACK);
  });

  it('pops moles up faster as the round goes on', () => {
    expect(popInterval(ROUND_SECONDS)).toBe(START_INTERVAL);
    expect(popInterval(ROUND_SECONDS / 2)).toBeLessThan(START_INTERVAL);
    expect(popInterval(0)).toBeCloseTo(END_INTERVAL);
  });

  it('ends the round when the clock runs out and puts every mole down', () => {
    const state = createState();
    state.holes[0].up = UP_TIME;
    state.timeLeft = 0.01;
    step(state, 0.05, first);
    expect(state.phase).toBe('over');
    expect(state.timeLeft).toBe(0);
    expect(state.holes.every((h) => h.up === 0)).toBe(true);
  });

  it('ignores whacks once the round is over', () => {
    const state = createState();
    const hole = state.holes[0];
    hole.up = UP_TIME;
    state.phase = 'over';
    expect(whack(state, hole.x, hole.y)).toBe(false);
    expect(state.score).toBe(0);
  });
});
