import { describe, expect, it } from 'vitest';
import {
  CASTS,
  DROP_TIME,
  HOOK_REACH,
  STREAM_SPEED,
  cast,
  createState,
  duckAt,
  duckPosition,
  step,
  type HookADuckState,
} from './game';

/** Casts where the first duck will be when the hook reaches the water. */
function castAtFirstDuck(state: HookADuckState) {
  const duck = state.ducks[0];
  const landing = duckPosition({ ...duck, angle: duck.angle + STREAM_SPEED * DROP_TIME });
  cast(state, landing.x, landing.y);
  return duck;
}

describe('hook a duck', () => {
  it('starts with every cast and no score', () => {
    const state = createState();
    expect(state.casts).toBe(CASTS);
    expect(state.score).toBe(0);
    expect(state.hook).toBeNull();
    expect(state.phase).toBe('playing');
  });

  it('uses one cast per drop of the hook', () => {
    const state = createState();
    expect(cast(state, 400, 300)).toBe(true);
    expect(state.casts).toBe(CASTS - 1);
    expect(state.hook).not.toBeNull();
  });

  it('cannot cast again while the hook is still out', () => {
    const state = createState();
    cast(state, 400, 300);
    expect(cast(state, 400, 300)).toBe(false);
    expect(state.casts).toBe(CASTS - 1);
  });

  it('cannot cast once every cast is used', () => {
    const state = createState();
    state.casts = 0;
    expect(cast(state, 400, 300)).toBe(false);
    expect(state.hook).toBeNull();
  });

  it('scores the number on the base of a hooked duck', () => {
    const state = createState();
    const duck = castAtFirstDuck(state);
    step(state, DROP_TIME / 2);
    expect(state.score).toBe(0);
    step(state, DROP_TIME / 2);
    expect(duck.hooked).toBe(true);
    expect(state.score).toBe(duck.value);
  });

  it('scores nothing when the hook misses', () => {
    const state = createState();
    state.ducks = [];
    cast(state, 400, 300);
    step(state, DROP_TIME);
    expect(state.score).toBe(0);
    expect(state.hook?.duck).toBeUndefined();
  });

  it('puts the duck back in the stream when the hook comes up', () => {
    const state = createState();
    const duck = castAtFirstDuck(state);
    step(state, DROP_TIME);
    expect(duck.hooked).toBe(true);
    step(state, DROP_TIME);
    expect(state.hook).toBeNull();
    expect(duck.hooked).toBe(false);
  });

  it('ends the round when the last cast is back up', () => {
    const state = createState();
    state.casts = 1;
    cast(state, 400, 300);
    step(state, DROP_TIME);
    expect(state.phase).toBe('playing');
    step(state, DROP_TIME);
    expect(state.phase).toBe('over');
  });

  it('floats the ducks round the stream in a loop', () => {
    const state = createState();
    const before = state.ducks[0].angle;
    step(state, 1);
    expect(state.ducks[0].angle).not.toBe(before);
    for (let i = 0; i < 100; i++) step(state, 0.5);
    expect(state.ducks[0].angle).toBeGreaterThanOrEqual(0);
    expect(state.ducks[0].angle).toBeLessThan(Math.PI * 2);
  });

  it('only reaches ducks close to the hook', () => {
    const state = createState();
    const pos = duckPosition(state.ducks[0]);
    expect(duckAt(state, pos.x + HOOK_REACH - 1, pos.y)).toBe(state.ducks[0]);
    expect(duckAt(state, pos.x, pos.y - HOOK_REACH * 3)).toBeUndefined();
  });

  it('lands the hook at the same moment however the time is split into frames', () => {
    const whole = createState();
    const split = createState();
    castAtFirstDuck(whole);
    castAtFirstDuck(split);
    step(whole, DROP_TIME + 0.1);
    step(split, DROP_TIME);
    step(split, 0.1);
    expect(whole.score).toBe(split.score);
    expect(whole.score).toBe(whole.ducks[0].value);
    expect(whole.hook?.direction).toBe('up');
    expect(whole.hook?.depth).toBeCloseTo(split.hook?.depth ?? NaN);
    expect(whole.hook?.depth).toBeCloseTo(1 - 0.1 / DROP_TIME);
    whole.ducks.forEach((duck, i) => expect(duck.angle).toBeCloseTo(split.ducks[i].angle));
  });

  it('finishes a cast within one long step', () => {
    const state = createState();
    state.casts = 1;
    const duck = castAtFirstDuck(state);
    step(state, DROP_TIME * 2 + 0.1);
    expect(state.score).toBe(duck.value);
    expect(duck.hooked).toBe(false);
    expect(state.hook).toBeNull();
    expect(state.phase).toBe('over');
  });
});
