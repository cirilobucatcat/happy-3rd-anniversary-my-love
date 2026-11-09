import { Euler, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { buildClimbLeg, type ClimbPlan } from "@/lib/climb-route";
import { makeRoute, type Pose } from "@/lib/route";

const H = 1.2; // Flyers' height in world units
/** Where the Sea leg ends: low over the water, heading into the screen (-z), mid-weave, banked a little. */
const START: Pose = { x: 0.9, y: -3, z: -40, yaw: Math.PI / 2 + 0.25, pitch: 0.04, roll: -0.35 };
// Timed like the real page (about 54 screens): the pull-up takes 0.35 screens, the Cloud pass 0.5, the climb about 11,
// and the slow-down 1.8. Speeds are world units per unit of progress (12.5 Flyer heights a screen at cruise).
const SCREEN = 1 / 54;
const PLAN: ClimbPlan = {
  flyerHeight: H,
  from: 0.5,
  pass: { from: 0.5 + 0.35 * SCREEN, to: 0.5 + 0.85 * SCREEN },
  slowFrom: 0.5 + 11 * SCREEN,
  restAt: 0.5 + 12.8 * SCREEN,
  entrySpeed: 600,
  cruiseSpeed: 12.5 * H * 54,
};

/** The leg as a Route, so poseAt works through its anchors exactly as the real one will. */
function build(start: Pose = START, plan: ClimbPlan = PLAN) {
  const leg = buildClimbLeg(start, plan);
  const last = leg.samples.length - 1;
  const anchors = leg.anchors.map(([p, i]) => [p, i / last] as const);
  return { leg, route: makeRoute(leg.samples, [], anchors) };
}

/** The direction the model's chest points (local +x) and the top of its head (local +y), in world axes, as the scene turns it. */
const rotate = (pose: Pose, v: Vector3) => v.clone().applyEuler(new Euler(pose.roll, pose.yaw, pose.pitch, "YZX"));
const chest = (pose: Pose) => rotate(pose, new Vector3(1, 0, 0));
const head = (pose: Pose) => rotate(pose, new Vector3(0, 1, 0));
const speed = (r: { poseAt(p: number): Pose }, p: number, d = 0.0004) => {
  const a = r.poseAt(p - d);
  const b = r.poseAt(p + d);
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (2 * d);
};

describe("buildClimbLeg: the pull-up, the swing in the Cloud pass, and the climb", () => {
  const { leg, route: r } = build();

  it("starts exactly where the Sea leg ends, heading the way it was heading", () => {
    expect(leg.samples[0]).toEqual(START);
    const next = r.poseAt(PLAN.from + 0.002);
    expect(next.z).toBeLessThan(START.z); // still going into the screen to begin with
    expect(next.y).toBeGreaterThanOrEqual(START.y);
  });

  it("pulls up out of the water: by the time the Cloud pass begins the path heads straight up", () => {
    const before = r.poseAt(PLAN.pass.from - 0.0006);
    const after = r.poseAt(PLAN.pass.from + 0.0006);
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const dz = after.z - before.z;
    expect(dy / Math.hypot(dx, dy, dz)).toBeGreaterThan(0.99);
    expect(r.poseAt(PLAN.pass.from).y - START.y).toBeGreaterThan(1.5 * H);
  });

  it("does the big turn of the pose inside the Cloud pass: facing -z going in, facing +z coming out", () => {
    const into = r.poseAt(PLAN.pass.from);
    const out = r.poseAt(PLAN.pass.to);
    expect(into.yaw).toBeCloseTo(Math.PI / 2, 1);
    expect(Math.abs(out.yaw - into.yaw)).toBeGreaterThan(Math.PI - 0.1);
    expect(chest(into).z).toBeLessThan(-0.3); // chest into the screen, head tipped up
    expect(chest(out).z).toBeGreaterThan(0.99);
  });

  it("changes pose only gently outside the Cloud pass, and the big turn is inside it", () => {
    // How fast the pose turns, as one number: the size of the change in (yaw, pitch, roll) per unit of progress.
    const rate = (p: number) => {
      const d = 0.0002;
      const a = r.poseAt(p - d);
      const b = r.poseAt(p + d);
      return Math.hypot(b.yaw - a.yaw, b.pitch - a.pitch, b.roll - a.roll) / (2 * d);
    };
    let outside = 0;
    let inside = 0;
    for (let p = PLAN.from + 0.0002; p < PLAN.restAt - 0.0002; p += 0.0002) {
      if (p >= PLAN.pass.from && p <= PLAN.pass.to) inside = Math.max(inside, rate(p));
      else outside = Math.max(outside, rate(p));
    }
    expect(inside).toBeGreaterThan(2.5 * outside);
    expect(outside * SCREEN).toBeLessThan(5); // radians per screen: under a third of a turn, even at the pull-up's busiest
  });

  it("never gets near straight up in pitch, where yaw, pitch and roll go awkward", () => {
    for (const s of leg.samples) expect(Math.abs(s.pitch)).toBeLessThan(1.4);
  });

  it("climbs straight up facing +z after the pass, upright, with the head up", () => {
    for (let p = PLAN.pass.to; p <= PLAN.restAt; p += 0.01) {
      const pose = r.poseAt(p);
      expect(chest(pose).z).toBeGreaterThan(0.97);
      expect(head(pose).y).toBeGreaterThan(0.97);
    }
  });

  it("rises all the way and sways only slightly: bounded sideways drift, none in depth", () => {
    const at = r.poseAt(PLAN.pass.to);
    let widest = 0;
    let last = at.y;
    for (let p = PLAN.pass.to; p <= PLAN.restAt; p += 0.002) {
      const pose = r.poseAt(p);
      expect(pose.y).toBeGreaterThanOrEqual(last - 1e-9);
      last = pose.y;
      expect(pose.z).toBeCloseTo(at.z, 6);
      widest = Math.max(widest, Math.abs(pose.x - at.x));
    }
    expect(widest).toBeGreaterThan(0.2 * H); // it does sway...
    expect(widest).toBeLessThan(1.0 * H); // ...but only slightly
    expect(r.poseAt(PLAN.restAt).y - at.y).toBeGreaterThan(40 * H);
  });

  it("leans a little into the sway, and never more than a few degrees", () => {
    let seen = 0;
    for (let p = PLAN.pass.to; p <= PLAN.restAt; p += 0.002) {
      const roll = Math.abs(r.poseAt(p).roll);
      seen = Math.max(seen, roll);
    }
    expect(seen).toBeGreaterThan(0.02);
    expect(seen).toBeLessThan(0.2);
  });

  it("keeps a steady pace through the climb, then slows to a stop at the rest point", () => {
    for (let p = PLAN.pass.to + 0.02; p <= PLAN.slowFrom - 0.005; p += 0.02) {
      expect(speed(r, p)).toBeGreaterThan(0.95 * PLAN.cruiseSpeed);
      expect(speed(r, p)).toBeLessThan(1.05 * PLAN.cruiseSpeed);
    }
    let previous = Infinity;
    for (let p = PLAN.slowFrom + 0.002; p < PLAN.restAt - 0.002; p += 0.002) {
      expect(speed(r, p)).toBeLessThanOrEqual(previous + 1e-6);
      previous = speed(r, p);
    }
    expect(speed(r, PLAN.restAt - 0.0006, 0.0003)).toBeLessThan(0.1 * PLAN.cruiseSpeed);
    expect(r.poseAt(PLAN.restAt)).toEqual(r.poseAt(1));
  });

  it("joins the Sea leg's pace: it starts at the speed the Sea leg left off at", () => {
    expect(speed(r, PLAN.from + 0.001, 0.0005)).toBeGreaterThan(0.8 * PLAN.entrySpeed);
    expect(speed(r, PLAN.from + 0.001, 0.0005)).toBeLessThan(1.25 * PLAN.entrySpeed);
  });

  it("never jumps: neighbouring samples are close together and the angles move in small steps", () => {
    for (let i = 1; i < leg.samples.length; i++) {
      const a = leg.samples[i - 1];
      const b = leg.samples[i];
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.5);
      expect(Math.abs(b.yaw - a.yaw)).toBeLessThan(0.2);
      expect(Math.abs(b.pitch - a.pitch)).toBeLessThan(0.2);
      expect(Math.abs(b.roll - a.roll)).toBeLessThan(0.2);
    }
  });

  it("is a pure function of progress, so scrolling back up retraces the same poses", () => {
    const ps = [0.5, 0.505, 0.51, 0.6, 0.73];
    const forward = ps.map((p) => r.poseAt(p));
    const backward = [...ps].reverse().map((p) => r.poseAt(p)).reverse();
    expect(backward).toEqual(forward);
  });

  it("keeps a loop's extra turn: a start pitch of one full turn ends facing +z at one full turn, not zero", () => {
    const { route } = build({ ...START, pitch: 2 * Math.PI + 0.04 });
    expect(route.poseAt(PLAN.pass.to).pitch).toBeCloseTo(2 * Math.PI, 1);
    expect(chest(route.poseAt(PLAN.restAt)).z).toBeGreaterThan(0.99);
  });

  it("works whichever way the Sea leg was heading when it ended (the weave swings either side)", () => {
    for (const yaw of [Math.PI / 2 - 0.4, Math.PI / 2 + 0.4]) {
      const { route } = build({ ...START, yaw, roll: yaw < Math.PI / 2 ? 0.4 : -0.4 });
      expect(chest(route.poseAt(PLAN.restAt)).z).toBeGreaterThan(0.99);
      expect(route.poseAt(PLAN.pass.from).y).toBeGreaterThan(START.y + 1.5 * H);
    }
  });
});
