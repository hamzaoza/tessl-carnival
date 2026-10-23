import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 30;
export const POINTS_PER_WHACK = 10;
/** Seconds a mole stays up. */
export const UP_TIME = 1;
/** Seconds between pop-ups at the start and at the end of the round. */
export const START_INTERVAL = 1;
export const END_INTERVAL = 0.35;
const COLUMNS = 3;
const ROWS = 3;
const HOLE_RADIUS = 48;
const BONK_TIME = 0.25;

export interface Hole {
  x: number;
  y: number;
  /** Seconds left before the mole drops back down; 0 when the hole is empty. */
  up: number;
  /** Seconds left on the bonk flash after a whack. */
  bonk: number;
}

export interface WhackAMoleState {
  holes: Hole[];
  timeLeft: number;
  /** Seconds until the next mole pops up. */
  nextPop: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): WhackAMoleState {
  const top = 110;
  const spacingX = WIDTH / COLUMNS;
  const spacingY = (HEIGHT - top - 60) / ROWS;
  const holes = Array.from({ length: COLUMNS * ROWS }, (_, i) => ({
    x: spacingX * (i % COLUMNS) + spacingX / 2,
    y: top + spacingY * Math.floor(i / COLUMNS) + spacingY / 2,
    up: 0,
    bonk: 0,
  }));
  return {
    holes,
    timeLeft: ROUND_SECONDS,
    nextPop: START_INTERVAL,
    score: 0,
    phase: 'playing',
  };
}

/** Seconds between pop-ups: shrinks from START_INTERVAL to END_INTERVAL over the round. */
export function popInterval(timeLeft: number): number {
  const progress = 1 - Math.max(0, Math.min(timeLeft, ROUND_SECONDS)) / ROUND_SECONDS;
  return START_INTERVAL + (END_INTERVAL - START_INTERVAL) * progress;
}

export function isOnMole(hole: Hole, x: number, y: number): boolean {
  return hole.up > 0 && Math.hypot(x - hole.x, y - hole.y) <= HOLE_RADIUS;
}

/** Whacks at a point. Returns true if it hit a mole that was up. */
export function whack(state: WhackAMoleState, x: number, y: number): boolean {
  if (state.phase !== 'playing') return false;
  const hole = state.holes.find((h) => isOnMole(h, x, y));
  if (!hole) return false;
  hole.up = 0;
  hole.bonk = BONK_TIME;
  state.score += POINTS_PER_WHACK;
  return true;
}

/**
 * Advances the game by `dt` seconds. `random` picks which empty hole a mole
 * pops up from, and returns a number in [0, 1).
 */
export function step(state: WhackAMoleState, dt: number, random: () => number = Math.random): void {
  if (state.phase !== 'playing') return;

  for (const hole of state.holes) {
    hole.up = Math.max(0, hole.up - dt);
    hole.bonk = Math.max(0, hole.bonk - dt);
  }

  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft === 0) {
    for (const hole of state.holes) hole.up = 0;
    state.phase = 'over';
    return;
  }

  state.nextPop -= dt;
  if (state.nextPop <= 0) {
    const empty = state.holes.filter((h) => h.up === 0 && h.bonk === 0);
    if (empty.length > 0) empty[Math.floor(random() * empty.length)].up = UP_TIME;
    state.nextPop += popInterval(state.timeLeft);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  for (const hole of state.holes) {
    ctx.fillStyle = colors.wood;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 20, HOLE_RADIUS + 10, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 20, HOLE_RADIUS, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    if (hole.up > 0) {
      ctx.fillStyle = colors.muted;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, HOLE_RADIUS * 0.7, Math.PI, 0);
      ctx.lineTo(hole.x + HOLE_RADIUS * 0.7, hole.y + 20);
      ctx.lineTo(hole.x - HOLE_RADIUS * 0.7, hole.y + 20);
      ctx.fill();
      ctx.fillStyle = colors.background;
      ctx.beginPath();
      ctx.arc(hole.x - 12, hole.y - 8, 4, 0, Math.PI * 2);
      ctx.arc(hole.x + 12, hole.y - 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.stripeA;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y + 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (hole.bonk > 0) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 3;
      ctx.globalAlpha = hole.bonk / BONK_TIME;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, HOLE_RADIUS * (1.3 - hole.bonk / BONK_TIME / 2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(state.timeLeft)}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description: 'Whack the moles before they duck back down. They pop up faster as the clock runs.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      whack(
        state,
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the round.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        scoreRecorded = true;
        try {
          recordScore(whackAMole.id, state.score);
        } catch {
          // A full or blocked storage loses this score, not the game loop.
        }
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};
