/**
 * The Flight path: where the Flyers are, and which way they face, at every scroll progress.
 *
 * - `buildRoute()` integrates a list of turns once, like a turtle that can pitch, yaw and bank.
 * - `fitRoute()` (below) scales that route to the viewport whenever it resizes.
 * - `poseAt(progress)` is a pure lookup, so scrolling back up retraces the same poses.
 *
 * World axes: +x is right, +y is up, +z points at the camera.
 * A pose is applied to a model that faces +x with Euler order "YZX" (yaw, then pitch, then roll).
 * Pitch is unwrapped (a loop makes it travel a full 2*pi) and roll is negative when banking left.
 */

export type Pose = {
  x: number;
  y: number;
  z: number;
  /** Rotation about world Y. Positive swings the nose towards -z (a left turn). */
  yaw: number;
  /** Nose up (positive) or down (negative); continues past +-pi/2 through a loop. */
  pitch: number;
  /** Rotation about the nose axis. Negative = left wing down. */
  roll: number;
};

export type Route = {
  readonly samples: readonly Pose[];
  poseAt(progress: number): Pose;
};

type Ease = "smooth" | "soft";

type Turn = {
  name: string;
  /** Distance flown, in design units. */
  length: number;
  /** Pitch and yaw to have reached by the end of the turn (they ease from where the last turn ended). */
  pitch: number;
  yaw: number;
  /** Peak bank; positive banks left. Rolls in and back out over the turn. */
  bank?: number;
  ease?: Ease;
};

export const LOOP_RADIUS = 1.25;

const TAU = 2 * Math.PI;
const loop = (yaw: number): Turn => ({ name: "loop", length: TAU * LOOP_RADIUS, pitch: TAU, yaw, ease: "soft" });

/** The flight on wide screens (laptops, phones held sideways): it travels right, then swings back left. */
export const TURNS: readonly Turn[] = [
  { name: "fly right", length: 1.2, pitch: 0, yaw: 0 },
  { name: "climb", length: 3.0, pitch: 1.2, yaw: 0 },
  { name: "climb", length: 4.0, pitch: 1.2, yaw: 0 },
  { name: "arc over", length: 3.4, pitch: -0.5, yaw: 0 },
  { name: "dive", length: 3.0, pitch: -1.25, yaw: 0 },
  { name: "dive", length: 5.0, pitch: -1.25, yaw: 0 },
  { name: "pull up", length: 2.6, pitch: 0, yaw: 0 },
  loop(0),
  { name: "cruise", length: 1.0, pitch: TAU, yaw: 0 },
  { name: "turn back left", length: Math.PI * 1.6, pitch: TAU, yaw: Math.PI, bank: 0.8 },
  { name: "cruise left", length: 0.5, pitch: TAU, yaw: Math.PI },
];

/**
 * The same story for tall screens (phones held upright), as a serpentine: long steep climbs and dives and a
 * left turn at each end, so the route uses the height of the screen instead of a thin band across it.
 */
export const PORTRAIT_TURNS: readonly Turn[] = [
  { name: "fly right", length: 0.6, pitch: 0, yaw: 0 },
  { name: "climb", length: 2.0, pitch: 1.4, yaw: 0 },
  { name: "climb", length: 7.0, pitch: 1.4, yaw: 0 },
  { name: "turn back left", length: 3.4, pitch: 0.05, yaw: Math.PI, bank: 0.8 },
  { name: "dive", length: 2.0, pitch: -1.4, yaw: Math.PI },
  { name: "dive", length: 10.0, pitch: -1.4, yaw: Math.PI },
  { name: "pull up", length: 2.0, pitch: 0, yaw: Math.PI },
  loop(Math.PI),
  { name: "turn back left", length: 3.4, pitch: TAU, yaw: TAU, bank: 0.8 },
  { name: "cruise", length: 1.0, pitch: TAU, yaw: TAU },
];

const STEP = 0.01;

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const easeFns: Record<Ease, (t: number) => number> = {
  smooth: smoothstep,
  // Mostly even, so a loop stays round, with only a gentle start and finish.
  soft: (t) => lerp(t, smoothstep(t), 0.4),
};

/** Evenly spaced poses along the route, so progress maps to distance flown. */
export function makeRoute(samples: readonly Pose[]): Route {
  const last = samples.length - 1;
  return {
    samples,
    poseAt(progress) {
      const f = clamp01(progress) * last;
      const i = Math.min(last - 1, Math.floor(f));
      const t = f - i;
      const a = samples[i];
      const b = samples[i + 1];
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t),
        yaw: lerp(a.yaw, b.yaw, t),
        pitch: lerp(a.pitch, b.pitch, t),
        roll: lerp(a.roll, b.roll, t),
      };
    },
  };
}

export function buildRoute(turns: readonly Turn[] = TURNS): Route {
  const samples: Pose[] = [];
  let x = 0;
  let y = 0;
  let z = 0;
  let pitch = 0;
  let yaw = 0;

  for (const turn of turns) {
    const steps = Math.max(1, Math.round(turn.length / STEP));
    const ds = turn.length / steps;
    const ease = easeFns[turn.ease ?? "smooth"];
    const fromPitch = pitch;
    const fromYaw = yaw;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const e = ease(t);
      pitch = lerp(fromPitch, turn.pitch, e);
      yaw = lerp(fromYaw, turn.yaw, e);
      const roll = -(turn.bank ?? 0) * Math.sin(Math.PI * t);
      samples.push({ x, y, z, yaw, pitch, roll });
      // Heading from pitch and yaw. At the middle of a step so curves are not biased.
      const midT = (i + 0.5) / steps;
      const midPitch = lerp(fromPitch, turn.pitch, ease(midT));
      const midYaw = lerp(fromYaw, turn.yaw, ease(midT));
      x += Math.cos(midPitch) * Math.cos(midYaw) * ds;
      y += Math.sin(midPitch) * ds;
      z -= Math.cos(midPitch) * Math.sin(midYaw) * ds;
    }
    pitch = turn.pitch;
    yaw = turn.yaw;
  }
  samples.push({ x, y, z, yaw, pitch, roll: 0 });
  return makeRoute(samples);
}

/* ---------- Fitting to the viewport ---------- */

/** The camera the route is fitted for; lib/scene.ts builds its camera from the same numbers. */
export const CAMERA = { fov: 35, distance: 10 } as const;

/** How tall the Flyers are, as a share of the visible height. */
const FLYER_HEIGHT_SHARE = 0.17;
/** Half-extent of the Flyers (trailing hair and dress included), as a share of their height. */
const FLYER_RADIUS_SHARE = 0.75;
/** The fitted route may stretch one axis at most this much more than the other, so loops stay roughly round. */
const MAX_STRETCH = 1.8;

/** Half the visible width and height at depth `z` (a perspective camera sees more the further away it looks). */
export function visibleHalf(aspect: number, z = 0) {
  const height = Math.tan((CAMERA.fov / 2) * (Math.PI / 180)) * (CAMERA.distance - z);
  return { width: height * aspect, height };
}

export type FittedRoute = Route & {
  /** Height of the Flyers in world units, so the scene can scale the model to match. */
  flyerHeight: number;
};

/** Scales and centres `route` so the Flyers stay fully on screen at every progress. Cheap enough to call on resize. */
export function fitRoute(route: Route, aspect: number): FittedRoute {
  const src = route.samples;
  const bounds = (k: "x" | "y" | "z") => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of src) {
      lo = Math.min(lo, p[k]);
      hi = Math.max(hi, p[k]);
    }
    return { mid: (lo + hi) / 2, half: Math.max((hi - lo) / 2, 1e-6) };
  };
  const bx = bounds("x");
  const by = bounds("y");
  const bz = bounds("z");

  const flat = visibleHalf(aspect, 0);
  const flyerHeight = Math.min(FLYER_HEIGHT_SHARE * 2 * flat.height, 0.3 * 2 * flat.width);
  const radius = flyerHeight * FLYER_RADIUS_SHARE;

  let sx = (flat.width - radius) / bx.half;
  let sy = (flat.height - radius) / by.half;
  if (sx > sy * MAX_STRETCH) sx = sy * MAX_STRETCH;
  if (sy > sx * MAX_STRETCH) sy = sx * MAX_STRETCH;
  let sz = Math.min(sx, sy);

  // Depth changes how much the camera sees, so shrink until every sample really fits.
  for (let pass = 0; pass < 6; pass++) {
    let k = 1;
    for (const p of src) {
      const z = (p.z - bz.mid) * sz;
      const half = visibleHalf(aspect, z);
      const x = Math.abs((p.x - bx.mid) * sx);
      const y = Math.abs((p.y - by.mid) * sy);
      if (x > 0) k = Math.min(k, (half.width - radius) / x);
      if (y > 0) k = Math.min(k, (half.height - radius) / y);
    }
    if (k >= 0.9999) break;
    sx *= k;
    sy *= k;
    sz *= k;
  }

  // Stretching x and y by different amounts bends the heading; recompute pitch from the stretched direction,
  // keeping it unwrapped so a loop still travels a full turn.
  const samples = src.map((p): Pose => {
    const bent = Math.atan2(sy * Math.sin(p.pitch), sx * Math.cos(p.pitch));
    const pitch = bent + 2 * Math.PI * Math.round((p.pitch - bent) / (2 * Math.PI));
    return {
      x: (p.x - bx.mid) * sx,
      y: (p.y - by.mid) * sy,
      z: (p.z - bz.mid) * sz,
      yaw: p.yaw,
      pitch,
      roll: p.roll,
    };
  });

  return { ...makeRoute(samples), flyerHeight };
}

/** Below this width-to-height ratio the screen counts as tall (a phone held upright). */
const PORTRAIT_BELOW = 0.85;

const built = new Map<readonly Turn[], Route>();
const routeOf = (turns: readonly Turn[]) => {
  let route = built.get(turns);
  if (!route) built.set(turns, (route = buildRoute(turns)));
  return route;
};

/** The Flight path for a screen of this shape, fitted to it. Call again whenever the screen resizes. */
export function routeForAspect(aspect: number): FittedRoute {
  return fitRoute(routeOf(aspect < PORTRAIT_BELOW ? PORTRAIT_TURNS : TURNS), aspect);
}
