/**
 * The Flight path: where the Flyers are, and which way they face, at every scroll progress.
 *
 * - `buildRoute()` integrates a list of turns once, like a turtle that can pitch, yaw and bank.
 * - It also notes the stretches that matter to the story: three Cloud passes (flying into a Cloud and out the far
 *   side, one at each Chapter change) and the Turn-around (swinging to face the Recipient before the Letter).
 * - Given a `Schedule` from the timeline, it retimes the path so those stretches land on the right scroll progress.
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

/** A stretch of the path with a meaning of its own, as fractions (0 to 1) of the distance flown. */
export type Mark = { kind: "cloud pass" | "turn-around"; from: number; to: number };

/**
 * When, in scroll progress, the marked stretches should happen (the timeline decides: Cloud passes at the Chapter
 * changes, the Turn-around just before the Letter). `buildRoute` retimes the path so they line up.
 */
export type Schedule = {
  passes: readonly { centre: number }[];
  turnAround: { from: number; to: number };
};

/** Pairs of [scroll progress, fraction of the path flown], rising in both. */
export type Anchor = readonly [progress: number, path: number];

export type Route = {
  readonly samples: readonly Pose[];
  readonly marks: readonly Mark[];
  readonly anchors: readonly Anchor[];
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
  /** Marks this turn as a Cloud pass or the Turn-around (see `Mark`). */
  mark?: Mark["kind"];
};

export const LOOP_RADIUS = 1.25;

const TAU = 2 * Math.PI;
const loop = (yaw: number): Turn => ({ name: "loop", length: TAU * LOOP_RADIUS, pitch: TAU, yaw, ease: "soft" });
/** Straight on at the heading the Flyers already have: into a Cloud and out the far side. */
const cloudPass = (pitch: number, yaw: number): Turn => ({ name: "cloud pass", length: 1.2, pitch, yaw, mark: "cloud pass" });

/**
 * The flight on wide screens (laptops, phones held sideways): it travels right, then swings back left and turns
 * around to face the camera. Three Cloud passes sit one at each Chapter change, and the Turn-around comes last.
 */
export const TURNS: readonly Turn[] = [
  { name: "fly right", length: 1.2, pitch: 0, yaw: 0 },
  { name: "climb", length: 3.0, pitch: 1.2, yaw: 0 },
  { name: "climb", length: 2.7, pitch: 1.2, yaw: 0 },
  cloudPass(1.2, 0),
  { name: "arc over", length: 3.4, pitch: -0.5, yaw: 0 },
  { name: "dive", length: 3.0, pitch: -1.25, yaw: 0 },
  { name: "dive", length: 2.7, pitch: -1.25, yaw: 0 },
  cloudPass(-1.25, 0),
  { name: "dive", length: 1.2, pitch: -1.25, yaw: 0 },
  { name: "pull up", length: 2.0, pitch: 0, yaw: 0 },
  loop(0),
  { name: "cruise", length: 0.4, pitch: TAU, yaw: 0 },
  cloudPass(TAU, 0),
  { name: "turn back left", length: Math.PI * 1.6, pitch: TAU, yaw: Math.PI, bank: 0.8 },
  { name: "cruise left", length: 4.5, pitch: TAU, yaw: Math.PI },
  // Swing round toward the camera and finish side by side, face on.
  { name: "turn-around", length: (Math.PI / 2) * 1.6, pitch: TAU, yaw: 1.5 * Math.PI, bank: 0.8, mark: "turn-around" },
];

/**
 * The same story for tall screens (phones held upright), as a serpentine: long steep climbs and dives and a
 * left turn at each end, so the route uses the height of the screen instead of a thin band across it.
 */
export const PORTRAIT_TURNS: readonly Turn[] = [
  { name: "fly right", length: 0.6, pitch: 0, yaw: 0 },
  { name: "climb", length: 2.0, pitch: 1.4, yaw: 0 },
  { name: "climb", length: 3.2, pitch: 1.4, yaw: 0 },
  cloudPass(1.4, 0),
  { name: "climb", length: 1.4, pitch: 1.4, yaw: 0 },
  { name: "turn back left", length: 3.4, pitch: 0.05, yaw: Math.PI, bank: 0.8 },
  { name: "dive", length: 2.0, pitch: -1.4, yaw: Math.PI },
  { name: "dive", length: 3.4, pitch: -1.4, yaw: Math.PI },
  cloudPass(-1.4, Math.PI),
  { name: "dive", length: 4.6, pitch: -1.4, yaw: Math.PI },
  { name: "pull up", length: 2.0, pitch: 0, yaw: Math.PI },
  cloudPass(0, Math.PI),
  loop(Math.PI),
  { name: "turn back left", length: 3.4, pitch: TAU, yaw: TAU, bank: 0.8 },
  { name: "cruise", length: 2.5, pitch: TAU, yaw: TAU },
  // A right turn from heading right brings the nose round to the camera: side by side, face on.
  { name: "turn-around", length: (Math.PI / 2) * 2.0, pitch: TAU, yaw: 1.5 * Math.PI, bank: -0.8, mark: "turn-around" },
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
  for (let i = 1; i < anchors.length; i++) {
    const [p1, d1] = anchors[i];
    if (p <= p1) {
      const [p0, d0] = anchors[i - 1];
      return p1 === p0 ? d1 : lerp(d0, d1, (p - p0) / (p1 - p0));
    }
  }
  return 1;
}

/**
 * Evenly spaced poses along the route. Without anchors, progress simply maps to distance flown; with them, the
 * marked stretches land on their scheduled progress and the flying in between speeds up or slows down to suit.
 */
export function makeRoute(samples: readonly Pose[], marks: readonly Mark[] = [], anchors: readonly Anchor[] = []): Route {
  const last = samples.length - 1;
  return {
    samples,
    marks,
    anchors,
    poseAt(progress) {
      const f = (anchors.length ? pathAt(anchors, progress) : clamp01(progress)) * last;
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

/** Anchors that put the middle of each Cloud pass, and both ends of the Turn-around, at their scheduled progress. */
function anchorsFor(marks: readonly Mark[], schedule: Schedule): Anchor[] {
  const anchors: Anchor[] = [[0, 0]];
  const passes = marks.filter((m) => m.kind === "cloud pass");
  const turn = marks.find((m) => m.kind === "turn-around");
  passes.forEach((m, i) => {
    const scheduled = schedule.passes[i];
    if (scheduled) anchors.push([scheduled.centre, (m.from + m.to) / 2]);
  });
  if (turn) {
    anchors.push([schedule.turnAround.from, turn.from]);
    anchors.push([schedule.turnAround.to, turn.to]);
  }
  // Close the path at the end, unless the last marked stretch already finishes it (then it simply stays there).
  const lastAnchor = anchors[anchors.length - 1];
  if (lastAnchor[0] < 1 && lastAnchor[1] < 1) anchors.push([1, 1]);
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

  return { ...makeRoute(samples, route.marks, route.anchors), flyerHeight };
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

/** The Flight path for a screen of this shape, fitted to it. Call again whenever the screen resizes. */
export function routeForAspect(aspect: number, schedule?: Schedule): FittedRoute {
  return fitRoute(routeOf(aspect < PORTRAIT_BELOW ? PORTRAIT_TURNS : TURNS, schedule), aspect);
}
