/**
 * The Flight path: where the Flyers are, and which way they face, at every scroll progress.
 *
 * - `buildRoute()` integrates a list of turns once, like a turtle that can pitch, yaw and bank.
 * - It also notes the Cloud passes (flying into a Cloud and out the far side, one at each Chapter change).
 * - Given a `Schedule` from the timeline, it retimes the path so those stretches land on the right scroll progress.
 * - `fitRoute()` (below) scales that route to the viewport whenever it resizes. That fitted part covers How we met and
 *   Year 1 and ends in the dive of the Year 1 to Year 2 Cloud pass. From there `routeForAspect` joins on the Sea leg
 *   (lib/sea-route.ts), which is in world units and not fitted to the screen (ADR 0002).
 * - `poseAt(progress)` is a pure lookup, so scrolling back up retraces the same poses.
 *
 * World axes: +x is right, +y is up, +z points at the camera.
 * A pose is applied to a model that faces +x with Euler order "YZX" (yaw, then pitch, then roll).
 * Pitch is unwrapped (a loop makes it travel a full 2*pi) and roll is negative when banking left.
 */
import { buildSeaLeg } from "@/lib/sea-route";

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

/** A stretch of the path with a meaning of its own, as fractions (0 to 1) of the distance flown. */
export type Mark = { kind: "cloud pass"; from: number; to: number };

/**
 * When, in scroll progress, things should happen (the timeline decides). `buildRoute` retimes the path so the marked
 * Cloud passes line up, and the Sea leg is paced to the pictures.
 */
export type Schedule = {
  /** The progress at which the Flyers appear: the path waits at its start until then, and begins flying from there. */
  start: number;
  /** The Cloud passes at the Chapter changes. The second is the dive that ends Year 1, where the fitted part of the route stops. */
  passes: readonly { centre: number; from: number; to: number }[];
  /** The progress at which the Flyers have pulled out of the dive and are level over the Sea. */
  levelAt: number;
  /** The Fly-by pictures in order: where the Flyers are alongside each, and which side it hangs on. */
  flyBys: readonly { alongside: number; side: "left" | "right" }[];
  /** The progress at which the Flyers have come to rest at the end of the story. */
  restAt: number;
};

/** Pairs of [scroll progress, fraction of the path flown], rising in both. */
export type Anchor = readonly [progress: number, path: number];

export type Route = {
  readonly samples: readonly Pose[];
  readonly marks: readonly Mark[];
  readonly anchors: readonly Anchor[];
  /** Total length of the path, in world units. */
  readonly length: number;
  poseAt(progress: number): Pose;
  /** How far along the path the Flyers are at this progress, in world units. */
  distanceAt(progress: number): number;
  /** The pose a given distance along the path (clamped to its ends). */
  poseAtDistance(distance: number): Pose;
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
  /** Marks this turn as a Cloud pass (see `Mark`). */
  mark?: Mark["kind"];
};

export const LOOP_RADIUS = 1.25;

const TAU = 2 * Math.PI;
const loop = (yaw: number): Turn => ({ name: "loop", length: TAU * LOOP_RADIUS, pitch: TAU, yaw, ease: "soft" });
/** Straight on at the heading the Flyers already have: into a Cloud and out the far side. */
const cloudPass = (pitch: number, yaw: number): Turn => ({ name: "cloud pass", length: 1.2, pitch, yaw, mark: "cloud pass" });

/**
 * The fitted part of the flight on wide screens (laptops, phones held sideways): How we met and Year 1. It climbs
 * right through the first Cloud pass, arcs over, makes the one loop, then dives steeply into the Year 1 to Year 2
 * Cloud pass, where it hands over to the Sea leg (lib/sea-route.ts).
 */
export const TURNS: readonly Turn[] = [
  { name: "fly right", length: 1.2, pitch: 0, yaw: 0 },
  { name: "climb", length: 3.0, pitch: 1.2, yaw: 0 },
  { name: "climb", length: 2.7, pitch: 1.2, yaw: 0 },
  cloudPass(1.2, 0),
  { name: "arc over", length: 3.0, pitch: 0, yaw: 0 },
  { name: "cruise", length: 1.0, pitch: 0, yaw: 0 },
  loop(0),
  { name: "cruise", length: 0.6, pitch: TAU, yaw: 0 },
  { name: "dive", length: 2.5, pitch: TAU - 1.25, yaw: 0 },
  cloudPass(TAU - 1.25, 0),
];

/**
 * The same for tall screens (phones held upright), as a serpentine: a steep climb, a left turn at the top, the loop,
 * and a long steep dive back down, so the route uses the height of the screen instead of a thin band across it.
 */
export const PORTRAIT_TURNS: readonly Turn[] = [
  { name: "fly right", length: 4.8, pitch: 0, yaw: 0 },
  { name: "climb", length: 1.2, pitch: 1.4, yaw: 0 },
  { name: "climb", length: 2.0, pitch: 1.4, yaw: 0 },
  cloudPass(1.4, 0),
  { name: "climb", length: 1.4, pitch: 1.4, yaw: 0 },
  { name: "turn back left", length: 3.4, pitch: 0.05, yaw: Math.PI, bank: 0.8 },
  loop(Math.PI),
  { name: "cruise", length: 0.6, pitch: TAU, yaw: Math.PI },
  { name: "dive", length: 3.4, pitch: TAU - 1.4, yaw: Math.PI },
  { name: "dive", length: 2.2, pitch: TAU - 1.4, yaw: Math.PI },
  cloudPass(TAU - 1.4, Math.PI),
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

/** Piecewise-linear map from scroll progress to the fraction of the path flown, through the anchors. */
function pathAt(anchors: readonly Anchor[], progress: number): number {
  const p = clamp01(progress);
  if (p <= anchors[0][0]) return anchors[0][1];
  let hi = anchors.length - 1;
  if (p > anchors[hi][0]) return 1;
  let lo = 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (p <= anchors[mid][0]) hi = mid;
    else lo = mid + 1;
  }
  const [p1, d1] = anchors[lo];
  const [p0, d0] = anchors[lo - 1];
  return p1 === p0 ? d1 : lerp(d0, d1, (p - p0) / (p1 - p0));
}

const blend = (a: Pose, b: Pose, t: number): Pose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  roll: lerp(a.roll, b.roll, t),
});

/**
 * Evenly spaced poses along the route. Without anchors, progress simply maps to distance flown; with them, the
 * marked stretches land on their scheduled progress and the flying in between speeds up or slows down to suit.
 */
export function makeRoute(samples: readonly Pose[], marks: readonly Mark[] = [], anchors: readonly Anchor[] = []): Route {
  const last = samples.length - 1;
  // Running length of the path at every sample, so the camera can ask for "6 units behind the Flyers".
  const lengths = new Float64Array(samples.length);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    lengths[i] = lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  const fractionOf = (progress: number) => (anchors.length ? pathAt(anchors, progress) : clamp01(progress));
  return {
    samples,
    marks,
    anchors,
    length: lengths[last],
    poseAt(progress) {
      const f = fractionOf(progress) * last;
      const i = Math.min(last - 1, Math.floor(f));
      return blend(samples[i], samples[i + 1], f - i);
    },
    distanceAt(progress) {
      const f = fractionOf(progress) * last;
      const i = Math.min(last - 1, Math.floor(f));
      return lerp(lengths[i], lengths[i + 1], f - i);
    },
    poseAtDistance(distance) {
      const d = Math.min(lengths[last], Math.max(0, distance));
      let lo = 0;
      let hi = last;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (lengths[mid] <= d) lo = mid;
        else hi = mid;
      }
      const span = lengths[hi] - lengths[lo];
      return blend(samples[lo], samples[hi], span > 0 ? (d - lengths[lo]) / span : 0);
    },
  };
}

/**
 * Anchors that put the middle of each Cloud pass at its scheduled progress. If the last Cloud pass is where the fitted
 * part ends (the dive), the part also ends where that pass does, and the Sea leg carries on from there.
 */
function anchorsFor(marks: readonly Mark[], schedule: Schedule): Anchor[] {
  const anchors: Anchor[] = [[schedule.start, 0]];
  marks.forEach((m, i) => {
    const scheduled = schedule.passes[i];
    if (scheduled) anchors.push([scheduled.centre, (m.from + m.to) / 2]);
  });
  const lastMark = marks[marks.length - 1];
  const lastPass = schedule.passes[marks.length - 1];
  if (lastMark && lastMark.to >= 0.9999 && lastPass) anchors.push([lastPass.to, 1]);
  else if (anchors[anchors.length - 1][0] < 1) anchors.push([1, 1]);
  // Both axes must keep rising, or the Flyers would stand still or fly backwards; if the schedule asks for that, ignore it.
  for (let i = 1; i < anchors.length; i++) {
    if (anchors[i][0] <= anchors[i - 1][0] || anchors[i][1] <= anchors[i - 1][1]) return [];
  }
  return anchors;
}

export function buildRoute(turns: readonly Turn[] = TURNS, schedule?: Schedule): Route {
  const samples: Pose[] = [];
  const spans: { kind: Mark["kind"]; from: number; to: number }[] = [];
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
    if (turn.mark) spans.push({ kind: turn.mark, from: samples.length, to: samples.length + steps });
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
  const last = samples.length - 1;
  const marks = spans.map((m): Mark => ({ kind: m.kind, from: m.from / last, to: m.to / last }));
  return makeRoute(samples, marks, schedule ? anchorsFor(marks, schedule) : []);
}

/* ---------- Fitting to the viewport ---------- */

/** The camera the fixed part of the route is fitted for; lib/camera-rig.ts builds the fixed camera from the same numbers. */
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

/** The Sea the route flies over, once there is one: the height of the water, and where the Flyers level out above it. */
export type SeaInfo = {
  /** Height of the water surface. */
  y: number;
  /** Where the pull-out ends and the Flyers are first level over the water. */
  level: { x: number; y: number; z: number };
};

export type FittedRoute = Route & {
  /** Height of the Flyers in world units, so the scene can scale the model to match. */
  flyerHeight: number;
  /** The Sea, when the route has one (it does once it was given a schedule with pictures). */
  sea: SeaInfo | null;
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

  return { ...makeRoute(samples, route.marks, route.anchors), flyerHeight, sea: null };
}

/** Below this width-to-height ratio the screen counts as tall (a phone held upright). */
export const PORTRAIT_BELOW = 0.85;

const built = new Map<readonly Turn[], { schedule: Schedule | undefined; route: Route }>();
const routeOf = (turns: readonly Turn[], schedule: Schedule | undefined) => {
  const cached = built.get(turns);
  if (cached && cached.schedule === schedule) return cached.route;
  const route = buildRoute(turns, schedule);
  built.set(turns, { schedule, route });
  return route;
};

/**
 * The Flight path for a screen of this shape. Call again whenever the screen resizes. The fitted part (How we met and
 * Year 1) is scaled to the screen; with a schedule that has pictures, the Sea leg is joined on after the dive, in world units.
 */
export function routeForAspect(aspect: number, schedule?: Schedule): FittedRoute {
  const fitted = fitRoute(routeOf(aspect < PORTRAIT_BELOW ? PORTRAIT_TURNS : TURNS, schedule), aspect);
  const dive = schedule?.passes[1];
  if (!schedule || !dive || !schedule.flyBys.length) return fitted;

  const end = fitted.samples[fitted.samples.length - 1];
  const leg = buildSeaLeg(end, {
    flyerHeight: fitted.flyerHeight,
    from: dive.to,
    levelAt: schedule.levelAt,
    pictures: schedule.flyBys,
    restAt: schedule.restAt,
  });

  // Join the two parts. The leg's first pose is the fitted part's last, so it is not repeated.
  const offset = fitted.samples.length - 1;
  const samples = [...fitted.samples, ...leg.samples.slice(1)];
  const last = samples.length - 1;
  const anchors: Anchor[] = fitted.anchors.map(([progress, f]) => [progress, (f * offset) / last]);
  for (const [progress, index] of leg.anchors) {
    const lastProgress = anchors.length ? anchors[anchors.length - 1][0] : -Infinity;
    if (progress > lastProgress) anchors.push([progress, (offset + index) / last]);
  }
  const marks = fitted.marks.map((m): Mark => ({ kind: m.kind, from: (m.from * offset) / last, to: (m.to * offset) / last }));
  return { ...makeRoute(samples, marks, anchors), flyerHeight: fitted.flyerHeight, sea: { y: leg.seaY, level: leg.levelAt } };
}
