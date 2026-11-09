/**
 * Cloud placement: where every Cloud in the Sky is, how big, and when it is there.
 *
 * A Cloud is a cluster of soft round puffs (sprites) placed in 3D. There are five kinds:
 *  - ambient Clouds at several depths, drifting sideways as she scrolls (nearer ones faster) and wrapping round; they
 *    belong to the fixed side view, so they clear away inside the dive's Cloud pass when the camera leaves it;
 *  - one Cloud pass Cloud per Chapter change, formed right on the Flyers' path, with puffs in front of and behind them;
 *  - for every Pop-out Memory, an arrive Cloud it emerges from and a different leave Cloud it slips behind;
 *  - route Clouds along the Sea: they form far ahead above and to the sides of the route, and the camera streams past them.
 * Placement is pure and seeded, so a resize never reshuffles the Sky, and every puff stays behind the depth at
 * which a settled Memory sits (lib/memory-layout.ts), which is what keeps a Memory in front of every Cloud.
 */
import { MEMORY_Z, type Slot } from "@/lib/memory-layout";
import { visibleHalf, type FittedRoute } from "@/lib/route";
import { phaseOf, type Span, type Timeline } from "@/lib/timeline";
import { LEAVE_START } from "@/lib/pop-out";

export type Puff = {
  /** Offset from the Cloud's centre, in world units. */
  x: number;
  y: number;
  z: number;
  /** Diameter. */
  size: number;
  alpha: number;
};

export type CloudRole = "ambient" | "pass" | "arrive" | "leave" | "route";

export type Cloud = {
  id: string;
  role: CloudRole;
  /** The Memory this Cloud hides (arrive and leave Clouds only). */
  memory?: number;
  /** Centre; `x` is where an ambient Cloud is at the start of the scroll. */
  x: number;
  y: number;
  z: number;
  width: number;
  puffs: Puff[];
  /** Ambient Clouds: world units drifted left over the whole scroll, and the length of the loop they wrap around. */
  drift: number;
  wrap: number;
  /** Pass, hiding and route Clouds form over `in` and clear over `out` (scroll progress). Ambient Clouds are always there... */
  life?: { in: Span; out: Span };
  /** ...until they retire: ambient Clouds clear away over this stretch of scroll (the dive), and stay gone. */
  retire?: Span;
};

export type PlaceInput = {
  aspect: number;
  route: FittedRoute;
  timeline: Timeline;
  /** One per Memory, from lib/memory-layout.ts. */
  slots: readonly Slot[];
};

/** Four ambient depths, far to near: how far back, how many, how wide (share of the view at that depth), how strong, how fast. */
const BANDS = [
  { z: -22, count: 4, share: 0.5, alpha: 0.5, flow: 0.35 },
  { z: -13, count: 4, share: 0.45, alpha: 0.62, flow: 0.7 },
  { z: -7, count: 3, share: 0.4, alpha: 0.72, flow: 1.2 },
  { z: -2.5, count: 3, share: 0.36, alpha: 0.8, flow: 2.0 },
] as const;

/** Depth of the Clouds a Memory hides behind: between its hidden depth (0) and its place (MEMORY_Z). */
const HIDE_Z = 1.0;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A flat-bottomed cumulus: a row of overlapping puffs, bigger in the middle, with a few on top. `straddle` spreads
 * the puffs evenly in front of and behind the Cloud's centre depth (used for Clouds the Flyers fly into).
 */
function puffsFor(rand: () => number, width: number, depth: number, alpha: number, count: number, straddle: boolean): Puff[] {
  const puffs: Puff[] = [];
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : (i / (count - 1) - 0.5) * 0.84 + (rand() - 0.5) * 0.06;
    const hump = 1 - (u / 0.42) ** 2;
    const z = straddle ? (i % 2 === 0 ? 1 : -1) * (0.25 + rand() * 0.65) * depth : (rand() - 0.5) * 2 * depth;
    puffs.push({
      x: u * width,
      y: width * (0.02 + 0.09 * hump * rand()),
      z,
      size: width * (0.3 + 0.2 * hump) * (0.85 + rand() * 0.3),
      alpha: alpha * (0.78 + rand() * 0.22),
    });
  }
  // A couple of rounded tops.
  puffs.push({ x: -0.12 * width, y: width * 0.13, z: straddle ? 0.2 * depth : (rand() - 0.5) * depth, size: width * 0.3, alpha: alpha * 0.85 });
  puffs.push({ x: 0.14 * width, y: width * 0.1, z: straddle ? -0.2 * depth : (rand() - 0.5) * depth, size: width * 0.27, alpha: alpha * 0.85 });
  return puffs;
}

export function placeClouds({ aspect, route, timeline, slots }: PlaceInput): Cloud[] {
  const clouds: Cloud[] = [];

  // Ambient Clouds, spread evenly around the loop each band wraps round.
  BANDS.forEach((band, b) => {
    const rand = mulberry32(1000 + b);
    const half = visibleHalf(aspect, band.z);
    // Sized by the shorter side of the view, so a wide laptop gets Clouds of the same size as a tall phone, just more room.
    const width = band.share * 2 * Math.min(half.width, half.height * 0.9);
    const wrap = 2 * half.width + 2 * width;
    for (let i = 0; i < band.count; i++) {
      clouds.push({
        id: `ambient-${b}-${i}`,
        role: "ambient",
        x: ((i + 0.15 + rand() * 0.7) / band.count - 0.5) * wrap,
        y: (rand() * 1.1 - 0.55) * half.height,
        z: band.z,
        width,
        puffs: puffsFor(rand, width, width * 0.18, band.alpha, 7, false),
        drift: band.flow * 2 * half.width,
        wrap,
        retire: timeline.passes[1],
      });
    }
  });

  // Cloud pass Clouds: on the Flyers' path at each Chapter change.
  timeline.passes.forEach((pass, i) => {
    const rand = mulberry32(2000 + i);
    const at = route.poseAt(pass.centre);
    const entry = route.poseAt(pass.from);
    const exit = route.poseAt(pass.to);
    const run = Math.hypot(exit.x - entry.x, exit.y - entry.y, exit.z - entry.z);
    const width = Math.max(3.2 * route.flyerHeight, run + 2.4 * route.flyerHeight);
    const cloud: Cloud = {
      id: `pass-${i}`,
      role: "pass",
      x: at.x,
      y: at.y,
      z: at.z,
      width,
      puffs: puffsFor(rand, width, 0.9, 0.95, 9, true),
      drift: 0,
      wrap: 0,
      life: { in: { from: pass.from - 0.06, to: pass.from - 0.012 }, out: { from: pass.to + 0.012, to: pass.to + 0.06 } },
    };
    // A dense puff in front of the middle, so the Flyers are properly veiled at the heart of the Cloud.
    cloud.puffs.push({ x: 0, y: 0, z: 0.55, size: width * 0.5, alpha: 0.97 });
    clouds.push(cloud);
  });

  // Route Clouds: scattered above and to the sides of the Sea route, so they stream past the Chase camera.
  if (route.sea) {
    const rand = mulberry32(5000);
    const h = route.flyerHeight;
    const STEP = 0.012;
    // Along the Sea only: the climb after it is for the open-Sky Clouds of ticket 08c.
    const end = timeline.pullUpFrom;
    for (let p = timeline.levelAt - 0.02, n = 0; p <= end; p += STEP, n++) {
      const at = route.poseAt(p);
      const side = n % 2 === 0 ? -1 : 1;
      const width = (4 + rand() * 5) * h;
      clouds.push({
        id: `route-${n}`,
        role: "route",
        // Close enough to the route to be in a phone's narrow view when they are far ahead (it sees only about 6 heights each side at 40 heights).
        x: at.x + side * (2.5 + rand() * 8) * h,
        y: route.sea.y + (4.5 + rand() * 5.5) * h,
        z: at.z - rand() * 6 * h,
        width,
        puffs: puffsFor(rand, width, width * 0.18, 0.8, 7, false),
        drift: 0,
        wrap: 0,
        // They form far ahead (the camera sees a long way down the Sea) and clear once she is well past them.
        life: { in: { from: p - 0.095, to: p - 0.075 }, out: { from: p + 0.015, to: p + 0.04 } },
      });
    }
  }

  // Hiding Clouds: one to emerge from and a different one to leave behind, for every Pop-out Memory (Fly-bys have none).
  timeline.memories.forEach((m, i) => {
    const slot = slots[i];
    if (!slot || m.motion === "fly-by") return;
    const width = 1.55 * slot.width;
    const leaveStart = m.from + LEAVE_START * (m.to - m.from);
    const up = i % 2 === 0 ? 1 : -1;
    const make = (role: "arrive" | "leave"): Cloud => {
      const rand = mulberry32((role === "arrive" ? 3000 : 4000) + i);
      const arriving = role === "arrive";
      return {
        id: `${role}-${i}`,
        role,
        memory: i,
        // A little outward of the slot: the Memory's hidden self sits nearer the middle of the screen than its place.
        x: slot.x * 1.06 + (arriving ? 0 : (slot.side === "left" ? -1 : 1) * 0.1 * slot.width),
        y: slot.y + (arriving ? up * 0.04 : -up * 0.22) * slot.height,
        z: arriving ? HIDE_Z : HIDE_Z + 0.15,
        width,
        puffs: puffsFor(rand, width, 0.4, 0.95, 8, false),
        drift: 0,
        wrap: 0,
        life: arriving
          ? { in: { from: m.from - 0.03, to: m.from - 0.002 }, out: { from: m.from + 0.02, to: m.from + 0.045 } }
          : { in: { from: leaveStart - 0.035, to: leaveStart - 0.003 }, out: { from: m.to + 0.002, to: m.to + 0.03 } },
      };
    };
    clouds.push(make("arrive"), make("leave"));
  });

  // Nothing may reach the plane a settled Pop-out Memory sits on: pull any puff that would back to just short of it.
  // (Route Clouds are far out along the Sea, a long way from that plane, and are left as they are.)
  for (const c of clouds) {
    if (c.role === "route") continue;
    for (const p of c.puffs) p.z = Math.min(p.z, MEMORY_Z - 0.35 - c.z);
  }
  return clouds;
}

/** Puff positions are stored relative to the Cloud's centre, so `z` here is an offset; this is the absolute depth. */
export const puffDepth = (cloud: Cloud, puff: Puff) => cloud.z + puff.z;

export type CloudState = { x: number; alpha: number; scale: number };

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Where a Cloud is, and how formed, at a given scroll progress. A pure function, so scrolling back retraces it. */
export function cloudState(cloud: Cloud, progress: number): CloudState {
  if (cloud.role === "ambient") {
    const L = cloud.wrap;
    const x = ((((cloud.x + L / 2 - cloud.drift * progress) % L) + L) % L) - L / 2;
    const gone = cloud.retire ? smooth(phaseOf(cloud.retire, progress)) : 0;
    return { x, alpha: 1 - gone, scale: 1 };
  }
  const life = cloud.life!;
  const formed = smooth(phaseOf(life.in, progress)) * (1 - smooth(phaseOf(life.out, progress)));
  return { x: cloud.x, alpha: formed, scale: 0.7 + 0.3 * formed };
}
