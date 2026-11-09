/**
 * The Flight path from the end of Year 2 to the Letter: the part of the route that comes after the Sea leg (ADR 0002).
 *
 *  1. The pull-up: from wherever the Sea leg left off (low over the water, heading into the screen) the path curves up
 *     until it heads straight up. The Flyers' bodies tip nose-up and level their wings as they go.
 *  2. The swing (the Turn-around): inside the Year 2 to Year 3 Cloud pass, where the Clouds veil them, the Flyers turn
 *     all the way round, from facing into the screen (-z) to facing the camera side (+z), and stand upright.
 *  3. The Face-on climb: a straight climb up with a slight sway, chest towards +z, at a steady pace through Year 3,
 *     then a slow-down to a stop at the rest point (under the Letter).
 *
 * The Flyers' pose is worked out separately from where they are: the model is built facing +x with +y up, so
 * "climbing with the chest towards +z" is simply yaw -pi/2 with no pitch. That keeps the swing a plain turn about the
 * vertical axis, and pitch is never near 90 degrees where yaw, pitch and roll go awkward.
 *
 * Like the Sea leg it is a list of evenly spaced poses plus anchors that say which scroll progress each pose belongs
 * to, so it is a pure function of progress and scrolling back retraces it.
 */
import type { Pose } from "@/lib/route";

export type ClimbPlan = {
  /** The Flyers' height in world units: everything here is sized from it. */
  flyerHeight: number;
  /** Scroll progress at which the pull-up begins (where the Sea leg ends). */
  from: number;
  /** The Year 2 to Year 3 Cloud pass: the path is straight up when it begins, and the Flyers swing round inside it. */
  pass: { from: number; to: number };
  /** Scroll progress at which they start slowing, and at which they have come to a stop. */
  slowFrom: number;
  restAt: number;
  /** World units flown per unit of progress when the pull-up begins (the Sea leg's pace there), and at a steady climb. */
  entrySpeed: number;
  cruiseSpeed: number;
};

export type ClimbLeg = {
  /** Evenly spaced poses; the first is the Sea leg's last pose (not repeated when the two are joined). */
  samples: Pose[];
  /** [scroll progress, index into `samples`], rising in both. */
  anchors: [progress: number, index: number][];
};

/* ---- Shape, all in Flyer heights unless said ---- */
/** How far the body tips nose-up at the top of the pull-up (radians); well short of straight up. */
const PITCH_UP = 0.6;
/** The climb's sway: how far either side, how long a wave, and how far the climb takes to build it up after the swing. */
const SWAY = 0.55;
const SWAY_WAVELENGTH = 26;
const SWAY_BUILD = 8;
/** The lean into the sway: radians of roll for each unit of sideways slope. */
const LEAN = 0.75;
/** Sample spacing along the path. */
const STEP = 0.1;

const TAU = 2 * Math.PI;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smoothstep = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const smoothDerivative = (t: number) => (t <= 0 || t >= 1 ? 0 : 6 * t * (1 - t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function buildClimbLeg(start: Pose, plan: ClimbPlan): ClimbLeg {
  const h = plan.flyerHeight;
  const { pass } = plan;
  const toPitch = Math.round(start.pitch / TAU) * TAU; // keep a loop's extra full turn
  const stepLength = STEP * h;

  /* ---- Pace: distance flown as a function of scroll progress ---- */
  const speedAt = (p: number) => {
    const rampUp = smoothstep((p - plan.from) / (pass.from - plan.from));
    const slowDown = 1 - smoothstep((p - plan.slowFrom) / (plan.restAt - plan.slowFrom));
    return lerp(plan.entrySpeed, plan.cruiseSpeed, rampUp) * slowDown;
  };
  const GRID = 0.0002;
  const gridCount = Math.max(2, Math.ceil((plan.restAt - plan.from) / GRID));
  const gridP = (i: number) => lerp(plan.from, plan.restAt, i / gridCount);
  const gridS: number[] = [0];
  for (let i = 1; i <= gridCount; i++) {
    gridS.push(gridS[i - 1] + 0.5 * (speedAt(gridP(i - 1)) + speedAt(gridP(i))) * (gridP(i) - gridP(i - 1)));
  }
  const total = gridS[gridCount];
  const distanceAt = (p: number) => {
    const f = (clamp01((p - plan.from) / (plan.restAt - plan.from))) * gridCount;
    const i = Math.min(gridCount - 1, Math.floor(f));
    return lerp(gridS[i], gridS[i + 1], f - i);
  };
  /** Where along the path (world units) the pull-up ends and the swing begins and ends. */
  const pullUpEnd = Math.min(total, Math.max(stepLength, distanceAt(pass.from)));
  const swingEnd = Math.min(total, Math.max(pullUpEnd + stepLength, distanceAt(pass.to)));

  /* ---- The path: a curve from the Sea leg's heading to straight up, then straight up with a sway ---- */
  const d0: [number, number, number] = [
    Math.cos(start.pitch) * Math.cos(start.yaw),
    Math.sin(start.pitch),
    -Math.cos(start.pitch) * Math.sin(start.yaw),
  ];
  const angle = Math.acos(Math.min(1, Math.max(-1, d0[1])));
  const direction = (s: number): [number, number, number] => {
    if (s < pullUpEnd) {
      if (angle < 1e-6) return [0, 1, 0];
      const t = smoothstep(s / pullUpEnd);
      const a = Math.sin((1 - t) * angle) / Math.sin(angle);
      const b = Math.sin(t * angle) / Math.sin(angle);
      return [a * d0[0], a * d0[1] + b, a * d0[2]];
    }
    const g = swayAt(s).slope;
    return [g, Math.sqrt(1 - g * g), 0];
  };
  /** The sideways slope of the climb (how much x changes for each unit climbed); nothing until the swing is over. */
  const swayAt = (s: number) => {
    const u = s - swingEnd;
    if (u <= 0) return { slope: 0 };
    const k = TAU / (SWAY_WAVELENGTH * h);
    const build = SWAY_BUILD * h;
    const ramp = smoothstep(u / build);
    const slope = SWAY * h * (smoothDerivative(u / build) / build * Math.sin(k * u) + ramp * k * Math.cos(k * u));
    return { slope: Math.max(-0.9, Math.min(0.9, slope)) };
  };

  /* ---- The Flyers' pose, separately from where they are ---- */
  const poseAtDistance = (s: number, x: number, y: number, z: number): Pose => {
    if (s < pullUpEnd) {
      const t = smoothstep(s / pullUpEnd);
      return { x, y, z, yaw: lerp(start.yaw, Math.PI / 2, t), pitch: lerp(start.pitch, toPitch + PITCH_UP, t), roll: lerp(start.roll, 0, t) };
    }
    if (s < swingEnd) {
      const t = smoothstep((s - pullUpEnd) / (swingEnd - pullUpEnd));
      return { x, y, z, yaw: lerp(Math.PI / 2, -Math.PI / 2, t), pitch: lerp(toPitch + PITCH_UP, toPitch, t), roll: 0 };
    }
    return { x, y, z, yaw: -Math.PI / 2, pitch: toPitch, roll: -LEAN * swayAt(s).slope };
  };

  const count = Math.max(2, Math.ceil(total / stepLength));
  const ds = total / count;
  const samples: Pose[] = [{ ...start }];
  let { x, y, z } = start;
  for (let i = 1; i <= count; i++) {
    // Heading at the middle of the step, so curves are not biased.
    const [dx, dy, dz] = direction((i - 0.5) * ds);
    x += dx * ds;
    y += dy * ds;
    z += dz * ds;
    samples.push(poseAtDistance(i * ds, x, y, z));
  }

  /* ---- Anchors: progress to sample index ---- */
  const anchors: [number, number][] = [[plan.from, 0]];
  for (let i = 1; i <= gridCount; i++) {
    const index = (gridS[i] / total) * count;
    const [lastP, lastI] = anchors[anchors.length - 1];
    if (gridP(i) > lastP && index > lastI) anchors.push([gridP(i), index]);
  }
  return { samples, anchors };
}
