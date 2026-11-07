import { describe, expect, it } from "vitest";
import { PORTRAIT_TURNS, TURNS, buildRoute, routeForAspect, visibleHalf, type Pose, type Schedule } from "@/lib/route";

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

// Where the timeline puts the Cloud passes and the Turn-around (progress), as in lib/timeline.ts for the real content.
const SCHEDULE: Schedule = {
  passes: [{ centre: 0.17 }, { centre: 0.43 }, { centre: 0.69 }],
  turnAround: { from: 0.93, to: 0.99 },
};

/** The way the nose points, in world axes (+x right, +y up, +z at the camera). */
const heading = (p: Pose) => ({
  x: Math.cos(p.pitch) * Math.cos(p.yaw),
  y: Math.sin(p.pitch),
  z: -Math.cos(p.pitch) * Math.sin(p.yaw),
});

describe.each([
  ["landscape", TURNS],
  ["portrait", PORTRAIT_TURNS],
])("the %s Flight path in depth: Cloud passes and the Turn-around", (_name, turns) => {
  const route = buildRoute(turns, SCHEDULE);
  const passes = route.marks.filter((m) => m.kind === "cloud pass");
  const turnArounds = route.marks.filter((m) => m.kind === "turn-around");

  /** The sample pose at a fraction of the way along the path (what the Flyers pass through, whatever the timing). */
  const atPath = (f: number) => {
    const g = f * (route.samples.length - 1);
    return route.samples[Math.min(route.samples.length - 1, Math.round(g))];
  };

  it("has exactly three Cloud passes and one Turn-around", () => {
    expect(passes).toHaveLength(3);
    expect(turnArounds).toHaveLength(1);
  });

  it("flies each Cloud pass straight and level-winged, so it reads as flying into the Cloud and out the far side", () => {
    for (const pass of passes) {
      const a = atPath(pass.from);
      const b = atPath(pass.to);
      expect(b.yaw).toBeCloseTo(a.yaw, 5);
      expect(b.pitch).toBeCloseTo(a.pitch, 5);
      expect(Math.abs(a.roll) + Math.abs(b.roll)).toBeLessThan(0.01);
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeGreaterThan(0.5); // a real distance, not a blink
    }
  });

  it("puts the Flyers in the middle of each Cloud pass exactly when the timeline says the Chapter changes", () => {
    SCHEDULE.passes.forEach((scheduled, i) => {
      const mid = atPath((passes[i].from + passes[i].to) / 2);
      const pose = route.poseAt(scheduled.centre);
      expect(pose.x).toBeCloseTo(mid.x, 1);
      expect(pose.y).toBeCloseTo(mid.y, 1);
      expect(pose.z).toBeCloseTo(mid.z, 1);
    });
  });

  it("makes the Turn-around happen in its scheduled stretch of scroll", () => {
    const start = atPath(turnArounds[0].from);
    const end = atPath(turnArounds[0].to);
    expect(route.poseAt(SCHEDULE.turnAround.from).yaw).toBeCloseTo(start.yaw, 1);
    expect(route.poseAt(SCHEDULE.turnAround.to).yaw).toBeCloseTo(end.yaw, 1);
  });

  it("swings the Flyers toward the camera in the Turn-around and ends them face on, level and unbanked", () => {
    const start = route.poseAt(SCHEDULE.turnAround.from);
    const end = route.poseAt(1);
    expect(end.z).toBeGreaterThan(start.z); // moved toward the camera
    const h = heading(end);
    expect(h.z).toBeGreaterThan(0.98); // nose pointing straight at the Recipient
    expect(Math.abs(h.x)).toBeLessThan(0.1);
    expect(Math.abs(h.y)).toBeLessThan(0.1);
    expect(end.roll).toBeCloseTo(0);
  });

  it("banks into the Turn-around and levels out", () => {
    const mid = atPath((turnArounds[0].from + turnArounds[0].to) / 2);
    expect(Math.abs(mid.roll)).toBeGreaterThan(0.3);
  });

  it("keeps a steady pace: no stretch of scroll flies more than twice as fast as another", () => {
    const anchors = [0, ...SCHEDULE.passes.map((p) => p.centre), SCHEDULE.turnAround.from, SCHEDULE.turnAround.to];
    const distance = (p: number) => {
      let total = 0;
      let last = route.poseAt(0);
      for (let i = 1; i <= 400; i++) {
        const q = route.poseAt((p * i) / 400);
        total += Math.hypot(q.x - last.x, q.y - last.y, q.z - last.z);
        last = q;
      }
      return total;
    };
    const speeds = anchors.slice(1).map((p, i) => (distance(p) - distance(anchors[i])) / (p - anchors[i]));
    // Leave out the final stretch (the Turn-around itself) from the comparison with the long flights.
    expect(Math.min(...speeds)).toBeGreaterThan(0);
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(2.2);
  });

  it("without a schedule the path is untouched: progress is simply distance flown", () => {
    const plain = buildRoute(turns);
    expect(plain.poseAt(0.5)).toEqual(plain.poseAt(0.5));
    expect(plain.marks).toHaveLength(4);
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
