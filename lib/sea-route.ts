/**
 * The Flight path over the Sea: the part of the route that is in world units, not fitted to the screen (ADR 0002).
 *
 * It carries on from the dive that ends Year 1:
 *  1. a pull-out that levels the Flyers just above the water and swings them to head straight into the screen (-z),
 *     which happens as the Chase camera takes over (see lib/camera-rig.ts);
 *  2. level flight low over the water with a gentle S-weave toward each picture, on alternating sides (the Flyers
 *     are over on the picture's side as they come alongside it), slight swoops up and down, and a bank into every turn;
 *  3. a pace that eases slower beside each picture and speeds up between them, then slows to rest at the end.
 *
 * The leg is a list of evenly spaced poses plus anchors that say which scroll progress each pose belongs to, in the
 * same form as the rest of the route (see lib/route.ts). Like everything in the route it is a pure function of progress.
 */
import type { Pose } from "@/lib/route";

export type SeaPlan = {
  /** The Flyers' height in world units: everything here is sized from it. */
  flyerHeight: number;
  /** Scroll progress at which the leg begins (the dive pass has just cleared). */
  from: number;
  /** Scroll progress at which they are level over the water, heading into the screen. */
  levelAt: number;
  /** The pictures in order: where the Flyers are alongside each (progress), and the side it hangs on. */
  pictures: readonly { alongside: number; side: "left" | "right" }[];
  /** Scroll progress at which they have come to rest. */
  restAt: number;
};

export type SeaLeg = {
  /** Evenly spaced poses; the first is the start of the pull-out (the end of the fitted part, not repeated). */
  samples: Pose[];
  /** [scroll progress, index into `samples`], rising in both. */
  anchors: [progress: number, index: number][];
  /** Height of the water surface. */
  seaY: number;
  /** Where the pull-out ends, for the spray burst: x and z of the first level pose. */
  levelAt: { x: number; y: number; z: number };
};

/* ---- Shape, all in Flyer heights ---- */
const PULL_OUT_LENGTH = 4.5;
/** How high above the water the Flyers fly (their middle). */
const CLEARANCE = 0.75;
/** How far the weave swings to each picture's side. */
const WEAVE = 0.85;
/** Swoop height, wavelength, and the distance over which it builds up after the pull-out. */
const SWOOP = 0.2;
const SWOOP_WAVELENGTH = 21;
const SWOOP_BUILD = 6;
/** How far the Flyers would travel between two neighbouring pictures at the base pace, and how far the weave takes to straighten after the last. */
const SPACING = 10;
const STRAIGHTEN = 8;
/** How much slower they go right beside a picture (a share of the base pace), and how wide that slow zone is (a share of the gap between pictures). */
const SLOW = 0.55;
const SLOW_REACH = 0.38;
/** Bank per unit of turn rate; 3.2 Flyer heights turns the sharpest weave into about 0.45 radians. */
const BANK_GAIN = 3.2;
const MAX_BANK = 0.55;
const PULL_OUT_BANK = 0.55;

const TAU = 2 * Math.PI;
const smoothstep = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The pull-out: pitch and yaw ease from the dive to level and straight into the screen, banking through the swing. */
function pullOut(start: Pose, h: number): Pose[] {
  const length = PULL_OUT_LENGTH * h;
  const steps = Math.max(1, Math.round(length / (0.06 * h)));
  const ds = length / steps;
  const toPitch = Math.round(start.pitch / TAU) * TAU; // keep a loop's extra full turn
  const toYaw = Math.PI / 2;
  const bank = Math.sign(toYaw - start.yaw) || 1;
  const out: Pose[] = [];
  let { x, y, z } = start;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const e = smoothstep(t);
    const pitch = lerp(start.pitch, toPitch, e);
    const yaw = lerp(start.yaw, toYaw, e);
    out.push({ x, y, z, yaw, pitch, roll: -bank * PULL_OUT_BANK * Math.sin(Math.PI * t) });
    const mid = smoothstep((i + 0.5) / steps);
    const midPitch = lerp(start.pitch, toPitch, mid);
    const midYaw = lerp(start.yaw, toYaw, mid);
    x += Math.cos(midPitch) * Math.cos(midYaw) * ds;
    y += Math.sin(midPitch) * ds;
    z -= Math.cos(midPitch) * Math.sin(midYaw) * ds;
  }
  out.push({ x, y, z, yaw: toYaw, pitch: toPitch, roll: 0 });
  return out;
}

export function buildSeaLeg(start: Pose, plan: SeaPlan): SeaLeg {
  const h = plan.flyerHeight;
  const pictures = plan.pictures;
  const pull = pullOut(start, h);
  const level = pull[pull.length - 1];
  const pitchBase = level.pitch;
  const seaY = level.y - CLEARANCE * h;

  /* ---- Pace: distance flown as a function of scroll progress, slowest beside each picture ---- */
  const first = pictures[0]?.alongside ?? plan.levelAt;
  let gap = Infinity;
  for (let k = 1; k < pictures.length; k++) gap = Math.min(gap, pictures[k].alongside - pictures[k - 1].alongside);
  if (!Number.isFinite(gap)) gap = Math.max(1e-3, plan.restAt - plan.levelAt);
  const base = (SPACING * h) / gap; // world units per unit of progress
  const reach = SLOW_REACH * gap;
  const last = pictures.length ? pictures[pictures.length - 1].alongside : plan.levelAt;
  let restFrom = last + reach * 1.2;
  if (restFrom >= plan.restAt) restFrom = (last + plan.restAt) / 2;

  const speedAt = (p: number) => {
    let slow = 0;
    for (const pic of pictures) {
      const u = (p - pic.alongside) / reach;
      if (Math.abs(u) < 1) slow = Math.max(slow, Math.cos((Math.PI * u) / 2) ** 2);
    }
    const rest = p <= restFrom ? 1 : 1 - smoothstep((p - restFrom) / (plan.restAt - restFrom));
    return base * (1 - SLOW * slow) * rest;
  };

  // Distance flown (along the heading into the screen) at the progress grid points, by trapezoid.
  const GRID = 0.0004;
  const gridCount = Math.max(2, Math.ceil((plan.restAt - plan.levelAt) / GRID));
  const gridP = (i: number) => lerp(plan.levelAt, plan.restAt, i / gridCount);
  const gridS: number[] = [0];
  for (let i = 1; i <= gridCount; i++) {
    gridS.push(gridS[i - 1] + 0.5 * (speedAt(gridP(i - 1)) + speedAt(gridP(i))) * (gridP(i) - gridP(i - 1)));
  }
  const total = gridS[gridCount];
  const distanceAt = (p: number) => {
    const f = ((Math.min(plan.restAt, Math.max(plan.levelAt, p)) - plan.levelAt) / (plan.restAt - plan.levelAt)) * gridCount;
    const i = Math.min(gridCount - 1, Math.floor(f));
    return lerp(gridS[i], gridS[i + 1], f - i);
  };

  /* ---- Weave: smooth side to side through each picture's side, level (heading straight) as they pass it ---- */
  const A = WEAVE * h;
  const controls: { s: number; w: number }[] = [{ s: 0, w: 0 }];
  for (const pic of pictures) controls.push({ s: distanceAt(pic.alongside), w: (pic.side === "left" ? -1 : 1) * A });
  controls.push({ s: controls[controls.length - 1].s + STRAIGHTEN * h, w: 0 });
  // Pictures at or before the level point would not be reachable; keep the controls strictly rising.
  for (let i = 1; i < controls.length; i++) if (controls[i].s <= controls[i - 1].s) controls[i].s = controls[i - 1].s + 1e-3;

  const weave = (s: number): { w: number; dw: number; ddw: number } => {
    if (s >= controls[controls.length - 1].s) return { w: 0, dw: 0, ddw: 0 };
    let i = 0;
    while (i < controls.length - 2 && s > controls[i + 1].s) i++;
    const a = controls[i];
    const b = controls[i + 1];
    const L = b.s - a.s;
    const t = Math.min(1, Math.max(0, (s - a.s) / L));
    const d = b.w - a.w;
    return {
      w: a.w + (d * (1 - Math.cos(Math.PI * t))) / 2,
      dw: ((d * Math.PI) / 2) * Math.sin(Math.PI * t) / L,
      ddw: ((d * Math.PI * Math.PI) / 2) * Math.cos(Math.PI * t) / (L * L),
    };
  };
  const swoop = (s: number) => SWOOP * h * smoothstep(s / (SWOOP_BUILD * h)) * Math.sin((TAU * s) / (SWOOP_WAVELENGTH * h));

  /* ---- Samples along the cruise ---- */
  const cruiseCount = Math.max(2, Math.ceil(total / (0.1 * h)));
  const samples: Pose[] = [...pull.slice(0, -1)];
  const levelIndex = samples.length;
  const cruise: Pose[] = [];
  for (let j = 0; j <= cruiseCount; j++) {
    const s = (j / cruiseCount) * total;
    const { w, dw, ddw } = weave(s);
    const dy = (swoop(s + 1e-3 * h) - swoop(s - 1e-3 * h)) / (2e-3 * h);
    const yawRate = -ddw / (1 + dw * dw);
    cruise.push({
      x: level.x + w,
      y: level.y + swoop(s),
      z: level.z - s,
      yaw: Math.atan2(1, dw),
      pitch: pitchBase + Math.atan2(dy, Math.hypot(dw, 1)),
      roll: -Math.min(MAX_BANK, Math.max(-MAX_BANK, BANK_GAIN * h * yawRate)),
    });
  }
  samples.push(...cruise);

  /* ---- Anchors: progress to sample index ---- */
  const anchors: [number, number][] = [
    [plan.from, 0],
    [plan.levelAt, levelIndex],
  ];
  for (let i = 1; i <= gridCount; i++) {
    const index = levelIndex + (gridS[i] / total) * cruiseCount;
    const [lastP, lastI] = anchors[anchors.length - 1];
    if (gridP(i) > lastP && index > lastI) anchors.push([gridP(i), index]);
  }

  return { samples, anchors, seaY, levelAt: { x: level.x, y: level.y, z: level.z } };
}
