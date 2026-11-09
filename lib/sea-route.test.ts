import { describe, expect, it } from "vitest";
import { buildSeaLeg, type SeaPlan } from "@/lib/sea-route";
import { makeRoute, type Pose } from "@/lib/route";

const H = 1.2; // Flyers' height in world units
const START: Pose = { x: 3, y: -2, z: 1, yaw: 0, pitch: -1.25, roll: 0 };
// Year 2's 12 pictures; the Sea leg ends a little after the last one.
const PICTURES = Array.from({ length: 12 }, (_, k) => ({
  alongside: 0.3 + k * 0.012,
  side: k % 2 === 0 ? ("left" as const) : ("right" as const),
}));
const PLAN: SeaPlan = { flyerHeight: H, from: 0.12, levelAt: 0.2, pictures: PICTURES, endAt: 0.3 + 11 * 0.012 + 0.003 };

/** The leg as a Route, so poseAt works through its anchors exactly as the real one will. */
function route(plan: SeaPlan = PLAN) {
  const leg = buildSeaLeg(START, plan);
  const last = leg.samples.length - 1;
  const anchors = leg.anchors.map(([p, i]) => [p, i / last] as const);
  return { leg, route: makeRoute(leg.samples, [], anchors) };
}

describe("buildSeaLeg: Year 2 over the Sea, in world units", () => {
  const { leg, route: r } = route();

  it("carries on from the dive: it starts where the fitted flight left off, heading the same way", () => {
    const first = r.poseAt(PLAN.from);
    expect(Math.hypot(first.x - START.x, first.y - START.y, first.z - START.z)).toBeLessThan(0.3);
    expect(first.pitch).toBeLessThan(-1);
  });

  it("pulls out of the dive and is level and heading away from where it began by the time it is over the Sea", () => {
    const level = r.poseAt(PLAN.levelAt);
    expect(level.pitch).toBeCloseTo(0, 1);
    expect(level.yaw).toBeCloseTo(Math.PI / 2, 1); // nose towards -z, into the screen
    expect(Math.abs(level.roll)).toBeLessThan(0.05);
  });

  it("flies low: above the water by a little under the Flyers' own height, all the way, however it swoops", () => {
    for (let p = PLAN.levelAt; p <= PLAN.endAt; p += 0.002) {
      const above = r.poseAt(p).y - leg.seaY;
      expect(above).toBeGreaterThan(0.3 * H);
      expect(above).toBeLessThan(1.3 * H);
    }
  });

  it("swoops a little up and down, not flat and not wildly", () => {
    const ys = Array.from({ length: 400 }, (_, i) => r.poseAt(PLAN.levelAt + ((PLAN.endAt - PLAN.levelAt) * i) / 399).y);
    const range = Math.max(...ys) - Math.min(...ys);
    expect(range).toBeGreaterThan(0.15 * H);
    expect(range).toBeLessThan(0.8 * H);
  });

  it("weaves toward each picture's side: alongside a picture on the left they are left of the line they began on, on the right they are right of it", () => {
    const centre = r.poseAt(PLAN.levelAt).x;
    PICTURES.forEach((pic) => {
      const offset = r.poseAt(pic.alongside).x - centre;
      expect(pic.side === "left" ? -offset : offset).toBeGreaterThan(0.5 * H);
    });
  });

  it("is heading straight ahead as they come alongside a picture, banks into the turn there, and swings across between two pictures", () => {
    // Pictures 1 and 2 (not the first, whose approach is a long, gentle drift): one on the right, the next on the left.
    const [, a, b] = PICTURES;
    // Alongside: the weave has reached its side, so the nose points straight into the screen and they are turning back.
    expect(Math.abs(r.poseAt(a.alongside).yaw - Math.PI / 2)).toBeLessThan(0.1);
    expect(Math.abs(r.poseAt(a.alongside).roll)).toBeGreaterThan(0.2);
    expect(Math.abs(r.poseAt(a.alongside).roll)).toBeLessThan(0.7);
    // Turning away from a picture on the right means turning left: a left bank is negative, a right bank positive.
    expect(r.poseAt(a.alongside).roll).toBeLessThan(0);
    expect(r.poseAt(b.alongside).roll).toBeGreaterThan(0);
    // Half way across, the nose is swung towards the next picture's side (the left, so towards -x).
    const across = r.poseAt((a.alongside + b.alongside) / 2);
    expect(across.yaw).toBeGreaterThan(Math.PI / 2 + 0.1);
  });

  it("eases slower as they come alongside a picture and speeds up between pictures", () => {
    const speed = (p: number) => {
      const d = 0.0004;
      const a = r.poseAt(p - d);
      const b = r.poseAt(p + d);
      return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (2 * d);
    };
    for (let k = 1; k < 11; k++) {
      const at = speed(PICTURES[k].alongside);
      const between = speed((PICTURES[k].alongside + PICTURES[k + 1].alongside) / 2);
      expect(at).toBeLessThan(0.7 * between);
    }
  });

  it("covers the same ground between pictures every time (the pictures are evenly spaced)", () => {
    const zAt = (k: number) => r.poseAt(PICTURES[k].alongside).z;
    const gap = (k: number) => zAt(k) - zAt(k + 1);
    expect(gap(2)).toBeGreaterThan(0);
    for (const k of [3, 5, 8]) {
      expect(gap(k) / gap(2)).toBeGreaterThan(0.9);
      expect(gap(k) / gap(2)).toBeLessThan(1.1);
    }
  });

  it("ends with Year 2: no slow-down or rest, so it is still flying at the pace of the last picture when the next leg takes over", () => {
    expect(leg.anchors[leg.anchors.length - 1][0]).toBeCloseTo(PLAN.endAt, 3);
    expect(r.poseAt(PLAN.endAt)).toEqual(r.poseAt(1));
    // Moving at the end, and at the speed the leg says it leaves at (measured over the last sliver of it).
    const d = 0.0002;
    const end = r.poseAt(PLAN.endAt);
    const before = r.poseAt(PLAN.endAt - d);
    const leaving = Math.hypot(end.x - before.x, end.y - before.y, end.z - before.z) / d;
    expect(leaving).toBeGreaterThan(0.5 * leg.pace);
    expect(leaving / leg.exitSpeed).toBeGreaterThan(0.9);
    expect(leaving / leg.exitSpeed).toBeLessThan(1.15);
    expect(leg.exitSpeed).toBeLessThanOrEqual(leg.pace);
  });

  it("is a pure function of progress, so scrolling back up retraces the same poses", () => {
    const forward = [0.15, 0.31, 0.38, 0.43].map((p) => r.poseAt(p));
    const backward = [0.43, 0.38, 0.31, 0.15].map((p) => r.poseAt(p)).reverse();
    expect(backward).toEqual(forward);
  });

  it("never jumps: neighbouring samples are close together, and never fold back on themselves", () => {
    for (let i = 1; i < leg.samples.length; i++) {
      const a = leg.samples[i - 1];
      const b = leg.samples[i];
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.5);
      expect(Math.abs(b.yaw - a.yaw)).toBeLessThan(0.2);
      expect(Math.abs(b.pitch - a.pitch)).toBeLessThan(0.2);
    }
  });

  it("keeps a loop's extra turn: a start pitch of one full turn plus the dive angle pulls out to one full turn, not zero", () => {
    const turned = buildSeaLeg({ ...START, pitch: 2 * Math.PI - 1.25 }, PLAN);
    const level = makeRoute(turned.samples, [], turned.anchors.map(([p, i]) => [p, i / (turned.samples.length - 1)] as const)).poseAt(PLAN.levelAt);
    expect(level.pitch).toBeCloseTo(2 * Math.PI, 1);
  });

  it("works from the dive heading either way round (portrait dives heading left)", () => {
    const left = route({ ...PLAN });
    const portrait = buildSeaLeg({ ...START, yaw: Math.PI }, PLAN);
    const rr = makeRoute(portrait.samples, [], portrait.anchors.map(([p, i]) => [p, i / (portrait.samples.length - 1)] as const));
    expect(rr.poseAt(PLAN.levelAt).yaw).toBeCloseTo(Math.PI / 2, 1);
    expect(left.leg.samples.length).toBeGreaterThan(100);
  });
});
