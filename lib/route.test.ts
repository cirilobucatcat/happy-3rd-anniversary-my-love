import { describe, expect, it } from "vitest";
import { PORTRAIT_TURNS, TURNS, buildRoute, routeForAspect, visibleHalf, type Pose } from "@/lib/route";

const STEPS = 1000;
const samples = (route: { poseAt(p: number): Pose }) =>
  Array.from({ length: STEPS + 1 }, (_, i) => route.poseAt(i / STEPS));

describe.each([
  ["landscape", TURNS],
  ["portrait", PORTRAIT_TURNS],
])("buildRoute: the %s Flight path", (_name, turns) => {
  const route = buildRoute(turns);

  it("starts flying to the right, level and unbanked", () => {
    const start = route.poseAt(0);
    expect(start.yaw).toBeCloseTo(0);
    expect(start.pitch).toBeCloseTo(0);
    expect(start.roll).toBeCloseTo(0);
  });

  it("moves right at first", () => {
    expect(route.poseAt(0.05).x).toBeGreaterThan(route.poseAt(0).x);
  });

  it("climbs: some stretch of the path heads clearly upward", () => {
    const climbs = samples(route).filter((s) => s.pitch > 0.4 && s.pitch < Math.PI / 2 - 0.2);
    expect(climbs.length).toBeGreaterThan(20);
  });

  it("dives: some stretch of the path heads clearly downward", () => {
    const dives = samples(route).filter((s) => s.pitch < -0.4);
    expect(dives.length).toBeGreaterThan(20);
  });

  it("loops exactly once: pitch accumulates one full turn and no more", () => {
    const pitches = samples(route).map((s) => s.pitch);
    const turned = Math.max(...pitches) - Math.min(...pitches);
    // One loop is 2*pi of pitch on top of the dive and climb angles; two loops would be at least 4*pi.
    expect(turned).toBeGreaterThan(2 * Math.PI);
    expect(turned).toBeLessThan(2 * Math.PI + 1.8);
  });

  it("turns left: it swings away from the camera and banks into the turn, then levels out", () => {
    const all = samples(route);
    expect(Math.max(...all.map((s) => s.yaw))).toBeGreaterThan(Math.PI - 0.01); // a full U-turn
    expect(Math.min(...all.map((s) => s.z))).toBeLessThan(-1); // away from the camera (-z) = a left turn
    expect(Math.min(...all.map((s) => s.roll))).toBeLessThan(-0.5); // left bank is negative roll
    expect(route.poseAt(1).roll).toBeCloseTo(0);
  });

  it("is a pure function of progress, so scrolling back up retraces the same poses", () => {
    const forward = [0.1, 0.4, 0.6, 0.9].map((p) => route.poseAt(p));
    const backward = [0.9, 0.6, 0.4, 0.1].map((p) => route.poseAt(p)).reverse();
    expect(backward).toEqual(forward);
  });

  it("never jumps: neighbouring samples are close together", () => {
    const all = samples(route);
    for (let i = 1; i < all.length; i++) {
      const d = Math.hypot(all[i].x - all[i - 1].x, all[i].y - all[i - 1].y, all[i].z - all[i - 1].z);
      expect(d).toBeLessThan(0.1);
    }
  });

  it("clamps progress outside 0..1", () => {
    expect(route.poseAt(-2)).toEqual(route.poseAt(0));
    expect(route.poseAt(5)).toEqual(route.poseAt(1));
  });
});

describe("the landscape route ends flying back to the left", () => {
  it("heads in the -x direction at the end", () => {
    const route = buildRoute(TURNS);
    const all = samples(route);
    expect(Math.cos(route.poseAt(1).yaw)).toBeLessThan(-0.95);
    expect(route.poseAt(1).x).toBeLessThan(Math.max(...all.map((s) => s.x)) - 1);
  });
});

describe("routeForAspect (fitted to the viewport)", () => {
  // 390x844 and 360x640 phones, a square window, a laptop and a wide monitor.
  const aspects = [390 / 844, 360 / 640, 1, 1440 / 900, 1920 / 1080];

  for (const aspect of aspects) {
    it(`keeps the whole Flyers on screen at every progress (aspect ${aspect.toFixed(2)})`, () => {
      const fitted = routeForAspect(aspect);
      const radius = fitted.flyerHeight * 0.75; // generous: includes trailing hair and dress
      for (let i = 0; i <= STEPS; i++) {
        const pose = fitted.poseAt(i / STEPS);
        const half = visibleHalf(aspect, pose.z);
        expect(Math.abs(pose.x) + radius).toBeLessThanOrEqual(half.width + 1e-6);
        expect(Math.abs(pose.y) + radius).toBeLessThanOrEqual(half.height + 1e-6);
      }
    });

    it(`keeps the Flyers big enough to read (aspect ${aspect.toFixed(2)})`, () => {
      const fitted = routeForAspect(aspect);
      const half = visibleHalf(aspect, 0);
      expect(fitted.flyerHeight).toBeGreaterThanOrEqual(0.1 * 2 * half.height);
    });
  }

  it("refits when the viewport changes shape (phone is taller than laptop)", () => {
    const phone = routeForAspect(390 / 844).samples;
    const laptop = routeForAspect(1440 / 900).samples;
    const span = (s: readonly Pose[], k: "x" | "y") => Math.max(...s.map((p) => p[k])) - Math.min(...s.map((p) => p[k]));
    expect(span(phone, "x") / span(phone, "y")).toBeLessThan(span(laptop, "x") / span(laptop, "y"));
  });

  it("keeps a loop continuous after fitting: pitch still travels one extra turn, with no jumps", () => {
    const fitted = routeForAspect(390 / 844);
    const pitches = fitted.samples.map((s) => s.pitch);
    for (let i = 1; i < pitches.length; i++) expect(Math.abs(pitches[i] - pitches[i - 1])).toBeLessThan(0.05);
    const turned = Math.max(...pitches) - Math.min(...pitches);
    expect(turned).toBeGreaterThan(2 * Math.PI);
    expect(turned).toBeLessThan(2 * Math.PI + 1.8);
  });

  it("keeps heading and bank unchanged by fitting", () => {
    const route = buildRoute(TURNS);
    const fitted = routeForAspect(1440 / 900);
    expect(fitted.poseAt(1).yaw).toBeCloseTo(route.poseAt(1).yaw);
    expect(Math.min(...fitted.samples.map((s) => s.roll))).toBeCloseTo(Math.min(...route.samples.map((s) => s.roll)));
  });
});
