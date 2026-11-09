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
 *  - **Face-on** from the Turn-around on (Year 3): the Flyers have swung round to face +z, and the camera is on that
 *    side, in front of them and a little above, looking at them and rising with them, so they stay in the same place
 *    low on the screen while the world slides down past. It blends in from the Chase camera inside the Turn-around's
 *    Cloud pass. (Both cameras are on the +z side of the Flyers: it is the Flyers who turn round, so the camera never
 *    has to go through or round them.)
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
  /** `fixed`, `chase` and `face-on` are the three modes; `blend` is somewhere between two of them (inside a Cloud pass). */
  mode: "fixed" | "chase" | "blend" | "face-on";
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
  /**
   * Pulling up out of the water the heading turns steeply up, and a camera aiming straight up has no sensible "which way
   * is up" (the view would spin). From `steepFrom` radians of climb the camera's heading leans on the way the pull-up was
   * pointing as the Turn-around began, and it never aims higher than `maxClimb`. The Sea leg never climbs this steeply.
   */
  steepFrom: 0.7,
  steepSpan: 0.5,
  maxClimb: 1.0,
} as const;

/**
 * The face-on camera, in Flyer heights. The Flyers sit low on the screen so the Letter card has the top at the end:
 * their heads stay below about 70% of the way down it.
 */
export const FACE_ON = {
  /** How far in front of the Flyers (towards +z), how far above them, and how far beyond them it looks. */
  front: 9,
  up: 3.2,
  lookAhead: 14,
  /** The sway's sideways slope is taken over this stretch of the path behind and ahead of the Flyers. */
  smoothBehind: 6,
  smoothAhead: 6,
  /** The view tilts this much of the Flyers' own lean into the sway (a degree or so at most). */
  tilt: 0.15,
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
  /** The Turn-around's Cloud pass (Year 2 to Year 3): the camera blends from Chase to face-on across it. Without one it never goes face-on. */
  turnAround?: Span;
}): CameraRig {
  const { route, blend, turnAround } = input;
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

  /** The way the Flyers are heading, smoothed over the path behind and ahead of them (a unit vector). */
  const smoothedHeading = (progress: number): Vec3 => {
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
      return [dx, dy, dz];
    }
    return [dx / length, dy / length, dz / length];
  };

  /** Which way the pull-up was heading, flat on the water, as the Turn-around's Cloud pass began (a unit vector in x and z). */
  const entryAzimuth: [number, number] = (() => {
    if (!turnAround) return [0, -1];
    const [x, , z] = smoothedHeading(turnAround.from);
    const length = Math.hypot(x, z);
    return length > 1e-6 ? [x / length, z / length] : [0, -1];
  })();

  /** The heading, kept from aiming too steeply up (see `CHASE.steepFrom`). A heading no steeper than that is left exactly as it is. */
  const calmed = (heading: Vec3): Vec3 => {
    const elevation = Math.asin(Math.min(1, Math.max(-1, heading[1])));
    if (elevation <= CHASE.steepFrom) return heading;
    const lean = smooth(Math.min(1, (elevation - CHASE.steepFrom) / CHASE.steepSpan));
    let x = heading[0] + lean * entryAzimuth[0];
    let z = heading[2] + lean * entryAzimuth[1];
    const flat = Math.hypot(x, z) || 1;
    x /= flat;
    z /= flat;
    const climb = Math.min(elevation, CHASE.maxClimb);
    return [x * Math.cos(climb), Math.sin(climb), z * Math.cos(climb)];
  };

  const chaseAt = (progress: number): CameraState => {
    const flyers = route.poseAt(progress);
    const [dx, dy, dz] = calmed(smoothedHeading(progress));
    return {
      position: [flyers.x - dx * CHASE.back * h, flyers.y - dy * CHASE.back * h + CHASE.up * h, flyers.z - dz * CHASE.back * h],
      target: [flyers.x + dx * CHASE.lookAhead * h, flyers.y + dy * CHASE.lookAhead * h, flyers.z + dz * CHASE.lookAhead * h],
      roll: -CHASE.tilt * flyers.roll,
      mode: "chase",
    };
  };

  /**
   * In front of the Flyers, facing them. It looks level with them and well beyond (`lookAhead`), from a little above, so
   * they sit low on the screen. The camera turns about them by the sway's smoothed sideways slope, so they stay put
   * on the screen and the world swings; it rises with them, at a constant height above.
   */
  const faceOnAt = (progress: number): CameraState => {
    const flyers = route.poseAt(progress);
    const d = route.distanceAt(progress);
    const behind = route.poseAtDistance(d - FACE_ON.smoothBehind * h);
    const ahead = route.poseAtDistance(d + FACE_ON.smoothAhead * h);
    const rise = ahead.y - behind.y;
    const slope = rise > 1e-9 ? (ahead.x - behind.x) / rise : 0;
    const norm = Math.hypot(slope, 1);
    // The way the camera looks: into the screen, turned a little sideways by the slope.
    const fx = -slope / norm;
    const fz = -1 / norm;
    return {
      position: [flyers.x - fx * FACE_ON.front * h, flyers.y + FACE_ON.up * h, flyers.z - fz * FACE_ON.front * h],
      target: [flyers.x + fx * FACE_ON.lookAhead * h, flyers.y, flyers.z + fz * FACE_ON.lookAhead * h],
      // Their lean about the axis towards us, as we see it: a positive lean is towards the screen's left, an anticlockwise tilt.
      roll: FACE_ON.tilt * flyers.roll,
      mode: "face-on",
    };
  };

  const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  /** Blends from camera `from` to camera `to` at `t` (0 to 1), pulling the aim toward the Flyers in the middle so they never leave the screen. */
  const swing = (from: CameraState, to: CameraState, t: number, progress: number): CameraState => {
    const flyers = route.poseAt(progress);
    // Half way through the swing the two aims point quite different ways; keep the Flyers (and the Cloud round them)
    // in view by pulling the aim toward them, most in the middle of the blend and not at all at either end.
    const pull = SWING_PULL * Math.sin(Math.PI * t);
    const aim = mix(from.target, to.target, t);
    return {
      position: mix(from.position, to.position, t),
      target: [lerp(aim[0], flyers.x, pull), lerp(aim[1], flyers.y, pull), lerp(aim[2], flyers.z, pull)],
      roll: lerp(from.roll, to.roll, t),
      mode: "blend",
    };
  };

  /** Fixed, then Chase: the camera for How we met, Year 1 and Year 2 (and, with no Turn-around, to the end). */
  const earlyAt = (progress: number): CameraState => {
    const t = smooth(phaseOf(blend, progress));
    if (t <= 0) return fixedAt(progress);
    const chase = chaseAt(progress);
    if (t >= 1) return chase;
    return swing(fixedAt(progress), chase, t, progress);
  };

  return {
    cameraAt(progress) {
      if (!turnAround || progress <= turnAround.from) return earlyAt(progress);
      const t = smooth(phaseOf(turnAround, progress));
      const faceOn = faceOnAt(progress);
      if (t >= 1) return faceOn;
      return swing(chaseAt(progress), faceOn, t, progress);
    },
  };
}
