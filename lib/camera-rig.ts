/**
 * The camera for every part of the story, as a pure lookup like `poseAt` (so scrolling back retraces it).
 *
 *  - **Fixed** up to the dive that ends Year 1: the old side view, which drifts a few degrees as she scrolls so Clouds
 *    at different depths slide past one another.
 *  - **Chase camera** from the dive on (Year 2 and the end of the story): behind and above the Flyers, looking the
 *    way they are heading, so they sit low in the middle of the screen with their backs showing and the Sea and Sky
 *    ahead. It follows the *smoothed* heading, so the weave shows as the world swinging past rather than the Flyers
 *    sliding about the screen, and it tilts a few degrees into each bank.
 *  - In between, it blends from one to the other inside the dive's Cloud pass, where the Clouds veil the Flyers (ADR 0002).
 *
 * A face-on mode (Year 3, ticket 08) joins these later.
 */
import { CAMERA, type FittedRoute } from "@/lib/route";
import { phaseOf, type Span } from "@/lib/timeline";

export type Vec3 = [number, number, number];

export type CameraState = {
  position: Vec3;
  /** The point the camera looks at. */
  target: Vec3;
  /** Turn about the view axis, in radians. Positive turns the view anticlockwise, like tilting your head to the left. */
  roll: number;
  /** `fixed` and `chase` are the two modes; `blend` is somewhere between (inside the dive's Cloud pass). */
  mode: "fixed" | "chase" | "blend";
};

/** The fixed camera swings this far each way (radians, about 4 degrees) across the whole scroll, for parallax. */
export const CAMERA_DRIFT = 0.07;

/** The Chase camera, in Flyer heights. */
export const CHASE = {
  /** How far behind the Flyers (along their smoothed heading). */
  back: 6.5,
  /** How far above them. */
  up: 1.5,
  /** How far ahead of them it looks; a long way, so they sit well below the middle of the screen. */
  lookAhead: 14,
  /** The smoothed heading is taken over this stretch of the path behind and ahead of the Flyers. */
  smoothBehind: 5,
  smoothAhead: 1.5,
  /** The view tilts this much of the Flyers' own bank (about 6 degrees at the deepest bank). */
  tilt: 0.2,
} as const;

/** How strongly the camera looks at the Flyers in the middle of the swing from the fixed view to the Chase camera. */
const SWING_PULL = 0.9;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

export type CameraRig = { cameraAt(progress: number): CameraState };

export function createCameraRig(input: {
  route: FittedRoute;
  /** The dive's Cloud pass: the camera blends from fixed to Chase across it. */
  blend: Span;
}): CameraRig {
  const { route, blend } = input;
  const h = route.flyerHeight;

  const fixedAt = (progress: number): CameraState => {
    const angle = lerp(-CAMERA_DRIFT, CAMERA_DRIFT, Math.min(1, Math.max(0, progress)));
    return {
      position: [Math.sin(angle) * CAMERA.distance, 0, Math.cos(angle) * CAMERA.distance],
      target: [0, 0, 0],
      roll: 0,
      mode: "fixed",
    };
  };

  const chaseAt = (progress: number): CameraState => {
    const flyers = route.poseAt(progress);
    const d = route.distanceAt(progress);
    const behind = route.poseAtDistance(d - CHASE.smoothBehind * h);
    const ahead = route.poseAtDistance(d + CHASE.smoothAhead * h);
    let dx = ahead.x - behind.x;
    let dy = ahead.y - behind.y;
    let dz = ahead.z - behind.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-9) {
      // Not moving yet: look the way the Flyers' nose points.
      dx = Math.cos(flyers.pitch) * Math.cos(flyers.yaw);
      dy = Math.sin(flyers.pitch);
      dz = -Math.cos(flyers.pitch) * Math.sin(flyers.yaw);
    } else {
      dx /= length;
      dy /= length;
      dz /= length;
    }
    return {
      position: [flyers.x - dx * CHASE.back * h, flyers.y - dy * CHASE.back * h + CHASE.up * h, flyers.z - dz * CHASE.back * h],
      target: [flyers.x + dx * CHASE.lookAhead * h, flyers.y + dy * CHASE.lookAhead * h, flyers.z + dz * CHASE.lookAhead * h],
      roll: -CHASE.tilt * flyers.roll,
      mode: "chase",
    };
  };

  return {
    cameraAt(progress) {
      const t = smooth(phaseOf(blend, progress));
      if (t <= 0) return fixedAt(progress);
      const chase = chaseAt(progress);
      if (t >= 1) return chase;
      const fixed = fixedAt(progress);
      const mix = (a: Vec3, b: Vec3): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
      // Half way through the swing the two aims point quite different ways; keep the Flyers (and the Cloud round them)
      // in view by pulling the aim toward them, most in the middle of the blend and not at all at either end.
      const flyers = route.poseAt(progress);
      const pull = SWING_PULL * Math.sin(Math.PI * t);
      const aim = mix(fixed.target, chase.target);
      return {
        position: mix(fixed.position, chase.position),
        target: [lerp(aim[0], flyers.x, pull), lerp(aim[1], flyers.y, pull), lerp(aim[2], flyers.z, pull)],
        roll: lerp(fixed.roll, chase.roll, t),
        mode: "blend",
      };
    },
  };
}
