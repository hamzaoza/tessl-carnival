import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 10;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.6;
/** How close to the centre of a neck a ring must land to score. */
export const NECK_RADIUS = 12;
/** How far, in pixels, the throw drifts from the aim. */
export const WOBBLE = 18;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 30 } as const;
/** Back row first: bottles further back score more. */
const ROWS = [
  { y: 120, points: 30 },
  { y: 200, points: 20 },
  { y: 280, points: 10 },
];
const BOTTLES_PER_ROW = 5;

export interface Bottle {
  x: number;
  /** Where the neck is: the point a ring has to land on. */
  y: number;
  points: number;
  ringed: boolean;
}

export interface Ring {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds since the throw. */
  age: number;
}

export interface Landing {
  x: number;
  y: number;
  scored: boolean;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  ring: Ring | null;
  landings: Landing[];
  rings: number;
  score: number;
  /** Seconds since the round started; drives the wobble. */
  time: number;
  phase: 'playing' | 'over';
}

export function createState(): RingTossState {
  const spacing = WIDTH / (BOTTLES_PER_ROW + 1);
  const bottles = ROWS.flatMap((row) =>
    Array.from({ length: BOTTLES_PER_ROW }, (_, i) => ({
      x: spacing * (i + 1),
      y: row.y,
      points: row.points,
      ringed: false,
    })),
  );
  return {
    bottles,
    ring: null,
    landings: [],
    rings: RINGS_PER_ROUND,
    score: 0,
    time: 0,
    phase: 'playing',
  };
}

/** The drift added to a throw at `time`, so the aim never holds perfectly still. */
export function wobble(time: number): { x: number; y: number } {
  return { x: WOBBLE * Math.sin(time * 3.1), y: WOBBLE * 0.6 * Math.cos(time * 2.3) };
}

/** The bottle a ring landing at (x, y) goes over, if any. A bottle holds one ring. */
export function bottleAt(state: RingTossState, x: number, y: number): Bottle | undefined {
  return state.bottles.find((b) => !b.ringed && Math.hypot(x - b.x, y - b.y) <= NECK_RADIUS);
}

/** Throws one ring towards the aim point. Returns false if nothing was thrown. */
export function throwRing(state: RingTossState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'playing' || state.rings === 0 || state.ring) return false;
  const drift = wobble(state.time);
  state.ring = {
    fromX: THROWER.x,
    fromY: THROWER.y,
    toX: aimX + drift.x,
    toY: aimY + drift.y,
    age: 0,
  };
  state.rings -= 1;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  state.time += dt;

  const ring = state.ring;
  if (ring) {
    ring.age += dt;
    if (ring.age >= FLIGHT_TIME) {
      const bottle = bottleAt(state, ring.toX, ring.toY);
      if (bottle) {
        bottle.ringed = true;
        state.score += bottle.points;
      }
      state.landings.push({ x: ring.toX, y: ring.toY, scored: Boolean(bottle), age: 0 });
      state.ring = null;
    }
  }

  for (const landing of state.landings) landing.age += dt;
  state.landings = state.landings.filter((l) => l.age < 0.5);

  if (state.rings === 0 && !state.ring) state.phase = 'over';
}

/** Where a ring in the air is drawn: along a line to its target, lifted into an arc. */
export function ringPosition(ring: Ring): { x: number; y: number } {
  const t = Math.min(ring.age / FLIGHT_TIME, 1);
  return {
    x: ring.fromX + (ring.toX - ring.fromX) * t,
    y: ring.fromY + (ring.toY - ring.fromY) * t - Math.sin(t * Math.PI) * 120,
  };
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, 16 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  for (const row of ROWS) {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(0, row.y + 44, WIDTH, 8);
    ctx.fillStyle = colors.muted;
    ctx.font = canvasFont('small');
    ctx.textAlign = 'left';
    ctx.fillText(`${row.points}`, 12, row.y + 40);
  }

  for (const bottle of state.bottles) {
    ctx.fillStyle = colors.water;
    ctx.fillRect(bottle.x - 14, bottle.y + 14, 28, 30);
    ctx.fillRect(bottle.x - 5, bottle.y - 4, 10, 18);
    ctx.fillStyle = colors.surface;
    ctx.fillRect(bottle.x - 6, bottle.y - 8, 12, 5);
    if (bottle.ringed) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 4;
      drawRing(ctx, bottle.x, bottle.y + 12, 0.8);
    }
  }

  ctx.lineWidth = 3;
  for (const landing of state.landings) {
    if (landing.scored) continue;
    ctx.globalAlpha = 1 - landing.age / 0.5;
    ctx.strokeStyle = colors.danger;
    drawRing(ctx, landing.x, landing.y + landing.age * 60);
  }
  ctx.globalAlpha = 1;

  // Crosshair where the next ring would land.
  if (state.phase === 'playing' && !state.ring && state.rings > 0) {
    const drift = wobble(state.time);
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aim.x + drift.x, aim.y + drift.y, NECK_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state.ring) {
    const { x, y } = ringPosition(state.ring);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 4;
    drawRing(ctx, x, y, 1.2 - (state.ring.age / FLIGHT_TIME) * 0.4);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.rings}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description: 'Land rings on the bottle necks. Bottles further back score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: WIDTH / 2, y: ROWS[1].y };

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
        throwRing(state, aim.x, aim.y);
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
        recordScore(ringToss.id, state.score);
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
