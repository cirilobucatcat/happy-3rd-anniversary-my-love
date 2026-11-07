/**
 * Wiggle: a Memory's frame swings from the corner nearest the pointer, as if hanging from a nail there, and settles
 * with a spring. Pure physics on one angle; the Memory card applies it as a rotation about that corner.
 */

export type Corner = { sx: -1 | 1; sy: -1 | 1 };

export type Wiggle = { angle: number; velocity: number; corner: Corner };

/** Springiness (rad/s) and how quickly the swing dies away (0 = never, 1 = no swing at all). */
const OMEGA = 2 * Math.PI * 2.1;
const DAMPING = 0.2;
/** Push given by a kick, in rad/s: about a 16 degree swing. */
const KICK = 4.0;
const REST_ANGLE = 0.0008;
const REST_SPEED = 0.01;

export const createWiggle = (): Wiggle => ({ angle: 0, velocity: 0, corner: { sx: 1, sy: 1 } });

/** The corner of a rectangle centred on the origin that is nearest the point (x, y). */
export function nearestCorner(x: number, y: number): Corner {
  return { sx: x < 0 ? -1 : 1, sy: y < 0 ? -1 : 1 };
}

/** Starts a swing about `corner`. Hitting it again mid-swing simply pushes it again. */
export function kick(w: Wiggle, corner: Corner): void {
  w.corner = corner;
  w.angle = 0;
  // A top corner hangs the frame below it, a bottom corner above it; the swing goes the way that opens up the far side.
  w.velocity = KICK * corner.sx * corner.sy;
}

export const isResting = (w: Wiggle) => Math.abs(w.angle) < REST_ANGLE && Math.abs(w.velocity) < REST_SPEED;

/** Advances the spring by `dt` seconds (in small steps, so a slow frame cannot blow it up). */
export function step(w: Wiggle, dt: number): void {
  if (isResting(w)) {
    w.angle = 0;
    w.velocity = 0;
    return;
  }
  const h = 1 / 240;
  let left = Math.min(dt, 0.1);
  while (left > 1e-9) {
    const d = Math.min(h, left);
    const accel = -OMEGA * OMEGA * w.angle - 2 * DAMPING * OMEGA * w.velocity;
    w.velocity += accel * d;
    w.angle += w.velocity * d;
    left -= d;
  }
}
