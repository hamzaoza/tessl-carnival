import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const CASTS = 8;
/** Seconds the hook takes to reach the water, and again to come back up. */
export const DROP_TIME = 0.4;
/** How close, in pixels, a duck must be to the hook when it lands. */
export const HOOK_REACH = 26;
export const DUCK_RADIUS = 20;
/** Radians per second the ducks travel round the stream. */
export const STREAM_SPEED = 0.6;
/** The stream is an oval loop: its centre and its two radii. */
export const STREAM = { x: WIDTH / 2, y: 270, rx: 300, ry: 140 } as const;
/** The number on the base of each duck, in order round the stream. */
export const DUCK_VALUES = [5, 10, 5, 20, 5, 10, 50, 5, 10, 20, 5, 10];
const HOOK_TOP = 60;

export interface Duck {
  /** Where the duck is round the loop, in radians. */
  angle: number;
  value: number;
  /** True while the duck is on the hook and out of the stream. */
  hooked: boolean;
}

export interface Hook {
  x: number;
  y: number;
  /** 0 at the top, 1 at the water. */
  depth: number;
  direction: 'down' | 'up';
  /** The duck on the hook, if the cast caught one. */
  duck?: Duck;
}

export interface Catch {
  value: number;
  age: number;
}

export interface HookADuckState {
  ducks: Duck[];
  hook: Hook | null;
  casts: number;
  score: number;
  lastCatch: Catch | null;
  phase: 'playing' | 'over';
}

export function createState(): HookADuckState {
  const ducks = DUCK_VALUES.map((value, i) => ({
    angle: (i / DUCK_VALUES.length) * Math.PI * 2,
    value,
    hooked: false,
  }));
  return { ducks, hook: null, casts: CASTS, score: 0, lastCatch: null, phase: 'playing' };
}

export function duckPosition(duck: Duck): { x: number; y: number } {
  return {
    x: STREAM.x + STREAM.rx * Math.cos(duck.angle),
    y: STREAM.y + STREAM.ry * Math.sin(duck.angle),
  };
}

/** The nearest duck in the stream within reach of the point, if any. */
export function duckAt(state: HookADuckState, x: number, y: number): Duck | undefined {
  let best: Duck | undefined;
  let bestDistance = HOOK_REACH;
  for (const duck of state.ducks) {
    if (duck.hooked) continue;
    const pos = duckPosition(duck);
    const distance = Math.hypot(pos.x - x, pos.y - y);
    if (distance <= bestDistance) {
      best = duck;
      bestDistance = distance;
    }
  }
  return best;
}

/** Lowers the hook towards a point on the stream. Returns false if nothing cast. */
export function cast(state: HookADuckState, x: number, y: number): boolean {
  if (state.phase !== 'playing' || state.casts === 0 || state.hook) return false;
  state.hook = { x, y, depth: 0, direction: 'down' };
  state.casts -= 1;
  return true;
}

function floatDucks(state: HookADuckState, dt: number) {
  for (const duck of state.ducks) {
    if (!duck.hooked) duck.angle = (duck.angle + STREAM_SPEED * dt) % (Math.PI * 2);
  }
}

/** The hook has reached the water or come back up: catch a duck or finish the cast. */
function turnHook(state: HookADuckState, hook: Hook) {
  if (hook.direction === 'down') {
    hook.depth = 1;
    const duck = duckAt(state, hook.x, hook.y);
    if (duck) {
      duck.hooked = true;
      hook.duck = duck;
      state.score += duck.value;
      state.lastCatch = { value: duck.value, age: 0 };
    }
    hook.direction = 'up';
  } else {
    // Put the duck back in the stream where it was caught.
    if (hook.duck) hook.duck.hooked = false;
    state.hook = null;
  }
}

/**
 * Advances the game by `dt` seconds. The step is split at the moment the hook
 * turns, so the result doesn't depend on how the time is cut into frames.
 */
export function step(state: HookADuckState, dt: number): void {
  let left = dt;
  while (left > 0) {
    const hook = state.hook;
    const untilTurn = hook
      ? (hook.direction === 'down' ? 1 - hook.depth : hook.depth) * DROP_TIME
      : Infinity;
    const t = Math.min(left, untilTurn);

    floatDucks(state, t);
    if (state.lastCatch) {
      state.lastCatch.age += t;
      if (state.lastCatch.age > 1.2) state.lastCatch = null;
    }
    if (hook) hook.depth += ((hook.direction === 'down' ? 1 : -1) * t) / DROP_TIME;
    left -= t;
    if (hook && t === untilTurn) turnHook(state, hook);
  }

  if (state.casts === 0 && !state.hook) state.phase = 'over';
}

function drawDuck(ctx: CanvasRenderingContext2D, x: number, y: number, value: number) {
  const { colors } = theme;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.ellipse(x, y, DUCK_RADIUS, DUCK_RADIUS * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + DUCK_RADIUS * 0.6, y - DUCK_RADIUS * 0.7, DUCK_RADIUS * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.stripeA;
  ctx.beginPath();
  ctx.moveTo(x + DUCK_RADIUS * 1.0, y - DUCK_RADIUS * 0.8);
  ctx.lineTo(x + DUCK_RADIUS * 1.5, y - DUCK_RADIUS * 0.6);
  ctx.lineTo(x + DUCK_RADIUS * 1.0, y - DUCK_RADIUS * 0.5);
  ctx.fill();
  ctx.fillStyle = colors.background;
  ctx.beginPath();
  ctx.arc(x + DUCK_RADIUS * 0.75, y - DUCK_RADIUS * 0.85, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // The number on its base.
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x - DUCK_RADIUS * 0.15, y + 1);
  ctx.textBaseline = 'alphabetic';
}

function draw(ctx: CanvasRenderingContext2D, state: HookADuckState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The stream: a ring of water with a wooden island in the middle.
  ctx.fillStyle = colors.wood;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx + 44, STREAM.ry + 44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.water;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx + 34, STREAM.ry + 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.wood;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx - 34, STREAM.ry - 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx - 44, STREAM.ry - 44, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ducks further back are drawn first.
  const swimming = state.ducks
    .filter((d) => !d.hooked)
    .map((d) => ({ ...duckPosition(d), value: d.value }));
  swimming.sort((a, b) => a.y - b.y);
  for (const duck of swimming) drawDuck(ctx, duck.x, duck.y, duck.value);

  // Rod and line: over the hook while casting, else over the aim.
  const hook = state.hook;
  const target = hook ?? { x: aim.x, y: aim.y, depth: 0 };
  const hookY = HOOK_TOP + (target.y - HOOK_TOP) * target.depth;
  ctx.strokeStyle = colors.wood;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(target.x - 120, HOOK_TOP - 20);
  ctx.lineTo(target.x, HOOK_TOP);
  ctx.stroke();
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(target.x, HOOK_TOP);
  ctx.lineTo(target.x, hookY);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x, hookY + 6, 6, 0, Math.PI);
  ctx.stroke();
  if (hook?.duck) drawDuck(ctx, target.x, hookY + DUCK_RADIUS, hook.duck.value);

  // Where the hook will land.
  if (!hook && state.phase === 'playing') {
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, HOOK_REACH, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state.lastCatch) {
    ctx.globalAlpha = Math.max(0, 1 - state.lastCatch.age / 1.2);
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(`+${state.lastCatch.value}`, STREAM.x, STREAM.y + 10);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Casts ${state.casts}/${CASTS}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of casts! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const hookADuck: CarnivalGame = {
  id: 'hook-a-duck',
  name: 'Hook a Duck',
  description: 'Lower your hook as a duck floats past. The number on its base is your score.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: STREAM.x, y: STREAM.y + STREAM.ry };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(aim, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(aim, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        cast(state, aim.x, aim.y);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(hookADuck.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};
