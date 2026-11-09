import { Euler, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/content/memories";
import { buildTimeline, scheduleOf } from "@/lib/timeline";
import { PORTRAIT_TURNS, TURNS, buildRoute, routeForAspect, visibleHalf, type Pose, type Schedule } from "@/lib/route";

const STEPS = 1000;
const samples = (route: { poseAt(p: number): Pose }, from = 0, to = 1) =>
  Array.from({ length: STEPS + 1 }, (_, i) => route.poseAt(from + ((to - from) * i) / STEPS));

// Where the timeline puts the start, the Cloud passes, the pictures and the end, for the real content.
const TIMELINE = buildTimeline(CHAPTERS);
const SCHEDULE: Schedule = scheduleOf(TIMELINE);
const DIVE = SCHEDULE.passes[1];
const TURN_AROUND = SCHEDULE.passes[2];

/** The direction the model's chest points (local +x), as the scene turns it. */
const chest = (p: Pose) => new Vector3(1, 0, 0).applyEuler(new Euler(p.roll, p.yaw, p.pitch, "YZX"));

/** The way the nose points, in world axes (+x right, +y up, +z at the camera). */
const heading = (p: Pose) => ({
  x: Math.cos(p.pitch) * Math.cos(p.yaw),
  y: Math.sin(p.pitch),
  z: -Math.cos(p.pitch) * Math.sin(p.yaw),
});

describe.each([
  ["landscape", TURNS],
  ["portrait", PORTRAIT_TURNS],
])("buildRoute: the fitted %s Flight path (How we met and Year 1)", (_name, turns) => {
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

  it("dives steeply at the end: the last stretch heads clearly downward, into the Year 1 to Year 2 Cloud pass", () => {
    const end = route.poseAt(1);
    expect(Math.sin(end.pitch)).toBeLessThan(-0.9);
    const dives = samples(route).filter((s) => Math.sin(s.pitch) < -0.9);
    expect(dives.length).toBeGreaterThan(20);
  });

  it("loops exactly once: the nose goes all the way round upside down, one time", () => {
    const pitches = samples(route).map((s) => s.pitch);
    // One loop is 2*pi of pitch; the climb and dive angles come on top, so look for the single trip over the top.
    const highest = Math.max(...pitches);
    const lowest = Math.min(...pitches);
    expect(highest - lowest).toBeGreaterThan(2 * Math.PI - 0.2);
    expect(highest - lowest).toBeLessThan(2 * Math.PI + 1.8);
    const overTheTop = pitches.filter((p, i) => i > 0 && pitches[i - 1] < Math.PI && p >= Math.PI).length;
    expect(overTheTop).toBe(1);
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

  it("measures how far along the path the Flyers are, and finds the pose at any distance", () => {
    expect(route.distanceAt(0)).toBe(0);
    expect(route.distanceAt(1)).toBeCloseTo(route.length, 6);
    expect(route.distanceAt(0.5)).toBeGreaterThan(route.distanceAt(0.4));
    const mid = route.poseAt(0.5);
    const there = route.poseAtDistance(route.distanceAt(0.5));
    expect(there.x).toBeCloseTo(mid.x, 6);
    expect(there.y).toBeCloseTo(mid.y, 6);
    expect(route.poseAtDistance(-3)).toEqual(route.poseAt(0));
    expect(route.poseAtDistance(route.length + 3)).toEqual(route.poseAt(1));
  });
});

describe("the portrait Flight path turns back left, banking into the turn and levelling out", () => {
  const route = buildRoute(PORTRAIT_TURNS);
  it("swings away from the camera (-z) in a full U-turn, with a left bank", () => {
    const all = samples(route);
    expect(Math.max(...all.map((s) => s.yaw))).toBeGreaterThan(Math.PI - 0.01);
    expect(Math.min(...all.map((s) => s.z))).toBeLessThan(-1);
    expect(Math.min(...all.map((s) => s.roll))).toBeLessThan(-0.5);
    expect(route.poseAt(1).roll).toBeCloseTo(0);
  });
});

describe.each([
  ["landscape", TURNS],
  ["portrait", PORTRAIT_TURNS],
])("the %s Flight path in depth: the two Cloud passes of the fitted part", (_name, turns) => {
  const route = buildRoute(turns, SCHEDULE);
  const passes = route.marks.filter((m) => m.kind === "cloud pass");

  /** The sample pose at a fraction of the way along the path (what the Flyers pass through, whatever the timing). */
  const atPath = (f: number) => {
    const g = f * (route.samples.length - 1);
    return route.samples[Math.min(route.samples.length - 1, Math.round(g))];
  };

  it("has exactly two Cloud passes: How we met to Year 1, and the dive that ends Year 1", () => {
    expect(passes).toHaveLength(2);
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

  it("makes the second Cloud pass a steep dive", () => {
    const entry = atPath(passes[1].from);
    expect(Math.sin(entry.pitch)).toBeLessThan(-0.9);
  });

  it("puts the Flyers in the middle of each Cloud pass exactly when the timeline says the Chapter changes", () => {
    passes.forEach((pass, i) => {
      const mid = atPath((pass.from + pass.to) / 2);
      const pose = route.poseAt(SCHEDULE.passes[i].centre);
      expect(pose.x).toBeCloseTo(mid.x, 1);
      expect(pose.y).toBeCloseTo(mid.y, 1);
      expect(pose.z).toBeCloseTo(mid.z, 1);
    });
  });

  it("ends the fitted part exactly where the dive pass ends on the timeline", () => {
    const end = route.poseAt(DIVE.to);
    expect(end).toEqual(route.poseAt(1));
  });

  it("waits at the start of the path until the scheduled start, then flies on from there", () => {
    const first = route.poseAt(0);
    expect(route.poseAt(SCHEDULE.start / 2)).toEqual(first);
    expect(route.poseAt(SCHEDULE.start)).toEqual(first);
    const later = route.poseAt(SCHEDULE.start + 0.03);
    expect(Math.hypot(later.x - first.x, later.y - first.y, later.z - first.z)).toBeGreaterThan(0.3);
  });

  it("keeps a steady pace: the opening and Year 1 fly at similar speeds", () => {
    const anchors = [SCHEDULE.start, SCHEDULE.passes[0].centre, SCHEDULE.passes[1].centre];
    const distance = (p: number) => route.distanceAt(p);
    const speeds = anchors.slice(1).map((p, i) => (distance(p) - distance(anchors[i])) / (p - anchors[i]));
    expect(Math.min(...speeds)).toBeGreaterThan(0);
    expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(4);
  });

  it("without a schedule the path is untouched: progress is simply distance flown", () => {
    const plain = buildRoute(turns);
    expect(plain.poseAt(0.5)).toEqual(plain.poseAt(0.5));
    expect(plain.marks).toHaveLength(2);
    expect(plain.anchors).toHaveLength(0);
  });
});

describe("routeForAspect (fitted to the viewport, then over the Sea)", () => {
  // 390x844 and 360x640 phones, a square window, a laptop and a wide monitor.
  const aspects = [390 / 844, 360 / 640, 1, 1440 / 900, 1920 / 1080];

  for (const aspect of aspects) {
    it(`keeps the whole Flyers on screen at every progress up to the dive (aspect ${aspect.toFixed(2)})`, () => {
      const fitted = routeForAspect(aspect, SCHEDULE);
      const radius = fitted.flyerHeight * 0.75; // generous: includes trailing hair and dress
      for (let i = 0; i <= STEPS; i++) {
        const pose = fitted.poseAt((DIVE.to * i) / STEPS);
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

    it(`dives into the Cloud pass within the screen, with room to spare below the Flyers (aspect ${aspect.toFixed(2)})`, () => {
      const fitted = routeForAspect(aspect, SCHEDULE);
      const entry = fitted.poseAt(DIVE.from);
      const half = visibleHalf(aspect, entry.z);
      expect(entry.y).toBeGreaterThan(-half.height); // still on screen as it enters the Cloud
    });
  }

  it("starts the Flyers on the left of the screen, where they pop up", () => {
    for (const a of aspects) {
      const start = routeForAspect(a, SCHEDULE).poseAt(0);
      expect(start.x).toBeLessThan(-0.25 * visibleHalf(a, start.z).width); // clearly left of the middle
    }
  });

  it("refits when the viewport changes shape (phone is taller than laptop)", () => {
    const span = (s: readonly Pose[], k: "x" | "y") => Math.max(...s.map((p) => p[k])) - Math.min(...s.map((p) => p[k]));
    const fittedPart = (aspect: number) => {
      const r = routeForAspect(aspect, SCHEDULE);
      return samples(r, 0, DIVE.to);
    };
    const phone = fittedPart(390 / 844);
    const laptop = fittedPart(1440 / 900);
    expect(span(phone, "x") / span(phone, "y")).toBeLessThan(span(laptop, "x") / span(laptop, "y"));
  });

  it("keeps the loop continuous after fitting: pitch still travels one extra turn, with no jumps", () => {
    const fitted = routeForAspect(390 / 844, SCHEDULE);
    const pitches = samples(fitted, 0, DIVE.to).map((s) => s.pitch);
    for (let i = 1; i < pitches.length; i++) expect(Math.abs(pitches[i] - pitches[i - 1])).toBeLessThan(0.1);
    const turned = Math.max(...pitches) - Math.min(...pitches);
    expect(turned).toBeGreaterThan(2 * Math.PI - 0.2);
    expect(turned).toBeLessThan(2 * Math.PI + 1.8);
  });

  it("keeps heading and bank unchanged by fitting", () => {
    const route = buildRoute(PORTRAIT_TURNS);
    const fitted = routeForAspect(390 / 844);
    expect(fitted.poseAt(1).yaw).toBeCloseTo(route.poseAt(1).yaw);
    expect(Math.min(...fitted.samples.map((s) => s.roll))).toBeCloseTo(Math.min(...route.samples.map((s) => s.roll)));
  });

  describe.each(aspects)("the Sea leg joined on (aspect %f)", (aspect) => {
    const route = routeForAspect(aspect, SCHEDULE);
    const H = route.flyerHeight;

    it("has a Sea below the Flyers once there is a schedule with pictures, and none before", () => {
      expect(route.sea).not.toBeNull();
      expect(routeForAspect(aspect).sea).toBeNull();
      expect(routeForAspect(aspect, { ...SCHEDULE, flyBys: [] }).sea).toBeNull();
    });

    it("carries on from the dive without a jump at the join", () => {
      const before = route.poseAt(DIVE.to - 1e-4);
      const after = route.poseAt(DIVE.to + 1e-4);
      expect(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z)).toBeLessThan(0.5);
    });

    it("is level, heading into the screen and just above the water when the timeline says it is level", () => {
      const level = route.poseAt(SCHEDULE.levelAt);
      expect(Math.sin(level.pitch)).toBeCloseTo(0, 1);
      expect(heading(level).z).toBeLessThan(-0.99);
      expect(level.y - route.sea!.y).toBeGreaterThan(0.4 * H);
      expect(level.y - route.sea!.y).toBeLessThan(1.1 * H);
    });

    it("is alongside each picture exactly when the timeline says, on that picture's side", () => {
      const centre = route.poseAt(SCHEDULE.levelAt).x;
      SCHEDULE.flyBys.forEach((f) => {
        const offset = route.poseAt(f.alongside).x - centre;
        expect(f.side === "left" ? -offset : offset).toBeGreaterThan(0.5 * H);
      });
    });

    it("eases slower beside each picture and speeds up between pictures", () => {
      const speed = (p: number) => {
        const d = 0.0003;
        const a = route.poseAt(p - d);
        const b = route.poseAt(p + d);
        return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (2 * d);
      };
      const f = SCHEDULE.flyBys;
      for (const k of [1, 3, 5, 8]) {
        expect(speed(f[k].alongside)).toBeLessThan(0.7 * speed((f[k].alongside + f[k + 1].alongside) / 2));
      }
    });

    it("comes to rest by the end of the scroll", () => {
      expect(route.poseAt(SCHEDULE.restAt)).toEqual(route.poseAt(1));
    });

    it("ends the Sea leg with Year 2: no weave, slow zone or rest in Year 3, and Year 2 is flown exactly as it is without a Year 3 leg", () => {
      // The same schedule with the Turn-around's Cloud pass missing has nothing after the Sea leg.
      const seaOnly = routeForAspect(aspect, { ...SCHEDULE, passes: SCHEDULE.passes.slice(0, 2) });
      for (let p = SCHEDULE.levelAt; p <= SCHEDULE.pullUpFrom; p += 0.002) {
        const a = route.poseAt(p);
        const b = seaOnly.poseAt(p);
        expect(a.x).toBeCloseTo(b.x, 6);
        expect(a.y).toBeCloseTo(b.y, 6);
        expect(a.z).toBeCloseTo(b.z, 6);
      }
    });

    it("never jumps anywhere along the whole route", () => {
      let last = route.poseAt(0);
      for (let i = 1; i <= 4000; i++) {
        const p = route.poseAt(i / 4000);
        expect(Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z)).toBeLessThan(0.6);
        last = p;
      }
    });
  });
  describe.each(aspects)("the climb leg joined on (aspect %f)", (aspect) => {
    const route = routeForAspect(aspect, SCHEDULE);
    const H = route.flyerHeight;
    const speed = (p: number, d = 0.0003) => {
      const a = route.poseAt(p - d);
      const b = route.poseAt(p + d);
      return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / (2 * d);
    };

    it("carries on from the Sea leg without a jump in position or pose, and scrolling back retraces it", () => {
      const step = 1e-4;
      for (let p = SCHEDULE.pullUpFrom - 0.0006; p <= SCHEDULE.pullUpFrom + 0.003; p += step) {
        const a = route.poseAt(p);
        const b = route.poseAt(p + step);
        expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.2 * H);
        expect(Math.abs(b.yaw - a.yaw) + Math.abs(b.pitch - a.pitch) + Math.abs(b.roll - a.roll)).toBeLessThan(0.05);
      }
      const forward = [0.4, 0.6, 0.8].map((p) => route.poseAt(p));
      expect([0.8, 0.6, 0.4].map((p) => route.poseAt(p)).reverse()).toEqual(forward);
    });

    it("pulls up out of the water before the Turn-around's Cloud pass and is heading straight up as it begins", () => {
      const before = route.poseAt(TURN_AROUND.from - 0.0004);
      const after = route.poseAt(TURN_AROUND.from + 0.0004);
      expect((after.y - before.y) / Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z)).toBeGreaterThan(0.99);
      expect(route.poseAt(TURN_AROUND.from).y).toBeGreaterThan(route.sea!.y + 2 * H);
    });

    it("swings round inside the Turn-around's Cloud pass: facing into the screen going in, towards the camera side coming out", () => {
      expect(chest(route.poseAt(TURN_AROUND.from)).z).toBeLessThan(-0.3);
      expect(chest(route.poseAt(TURN_AROUND.to)).z).toBeGreaterThan(0.99);
    });

    it("changes pose slowly outside that pass: no turn of more than half a turn a screen, from the pull-up to the rest", () => {
      const screen = 1 / TIMELINE.scrollScreens;
      for (let p = SCHEDULE.pullUpFrom; p <= SCHEDULE.restAt - 0.001; p += 0.001) {
        if (p > TURN_AROUND.from - 0.001 && p < TURN_AROUND.to + 0.001) continue;
        const a = route.poseAt(p);
        const b = route.poseAt(p + 0.001);
        const turned = Math.hypot(b.yaw - a.yaw, b.pitch - a.pitch, b.roll - a.roll);
        expect(turned / (0.001 / screen)).toBeLessThan(3.2); // radians a screen: the pull-up at its busiest is about 2.7
        expect(Number.isFinite(turned)).toBe(true);
      }
    });

    it("climbs straight up, facing +z, with a slight sway, at a steady pace through Year 3", () => {
      const out = route.poseAt(TURN_AROUND.to);
      const rest = TIMELINE.rest;
      for (let p = TURN_AROUND.to + 0.002; p <= rest.from - 0.001; p += 0.002) {
        const pose = route.poseAt(p);
        expect(chest(pose).z).toBeGreaterThan(0.97);
        expect(pose.y).toBeGreaterThan(route.poseAt(p - 0.002).y);
        expect(Math.abs(pose.x - out.x)).toBeLessThan(1.0 * H);
        expect(pose.z).toBeCloseTo(out.z, 5);
      }
      const speeds = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => speed(TURN_AROUND.to + 0.01 + f * (rest.from - TURN_AROUND.to - 0.02)));
      expect(Math.max(...speeds) / Math.min(...speeds)).toBeLessThan(1.1);
    });

    it("flies Year 3 at the same pace as between Year 2's pictures", () => {
      const between = (a: number, b: number) => speed((SCHEDULE.flyBys[a].alongside + SCHEDULE.flyBys[b].alongside) / 2);
      const year2 = between(4, 5);
      const year3 = speed((TURN_AROUND.to + TIMELINE.rest.from) / 2);
      expect(year3 / year2).toBeGreaterThan(0.85);
      expect(year3 / year2).toBeLessThan(1.15);
    });

    it("slows to a stop at the rest point, below the Letter, and stays there", () => {
      let previous = Infinity;
      for (let p = TIMELINE.rest.from + 0.001; p < TIMELINE.rest.to - 0.001; p += 0.001) {
        expect(speed(p)).toBeLessThanOrEqual(previous + 1e-6);
        previous = speed(p);
      }
      expect(speed(TIMELINE.rest.to - 0.0006, 0.0003)).toBeLessThan(0.1 * speed(TIMELINE.rest.from - 0.001));
      expect(route.poseAt(SCHEDULE.restAt)).toEqual(route.poseAt(1));
      expect(chest(route.poseAt(1)).z).toBeGreaterThan(0.97);
    });
  });
});
