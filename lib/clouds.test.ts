import { describe, expect, it } from "vitest";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { cloudState, placeClouds, puffDepth, type Cloud } from "@/lib/clouds";
import { createCameraRig } from "@/lib/camera-rig";
import { MEMORY_Z, placeMemories } from "@/lib/memory-layout";
import { routeForAspect, visibleHalf } from "@/lib/route";
import { buildTimeline, scheduleOf } from "@/lib/timeline";

const timeline = buildTimeline(CHAPTERS);
const memories = layoutMemories(CHAPTERS);
const ASPECTS = [390 / 844, 1440 / 900];

function build(aspect: number) {
  const route = routeForAspect(aspect, scheduleOf(timeline));
  const slots = placeMemories({ aspect, memories, route, spans: timeline.memories });
  const clouds = placeClouds({ aspect, route, timeline, slots });
  return { route, slots, clouds };
}

const frontmost = (c: Cloud) => Math.max(...c.puffs.map((p) => puffDepth(c, p)));

describe.each(ASPECTS)("placeClouds (aspect %f)", (aspect) => {
  const { route, slots, clouds } = build(aspect);
  const ambient = clouds.filter((c) => c.role === "ambient");

  it("puts the ambient Clouds at several clearly different depths, so the camera drift shows real parallax", () => {
    const depths = new Set(ambient.map((c) => Math.round(c.z)));
    expect(depths.size).toBeGreaterThanOrEqual(4);
    const z = ambient.map((c) => c.z);
    expect(Math.max(...z) - Math.min(...z)).toBeGreaterThan(12);
  });

  it("is deterministic: the same inputs always place the same Clouds (a resize must not reshuffle the Sky)", () => {
    expect(build(aspect).clouds).toEqual(clouds);
  });

  it("keeps every Cloud puff behind the settled Memories, so a Memory is in front of every Cloud while it is read", () => {
    for (const c of clouds) expect(frontmost(c)).toBeLessThan(MEMORY_Z - 0.3);
  });

  it("keeps the ambient Clouds out of the Flyers' way: all of them sit behind the Flyers", () => {
    const flyerFront = Math.max(...route.samples.map((p) => p.z));
    for (const c of ambient) expect(frontmost(c)).toBeLessThan(flyerFront);
  });

  it("puts one Cloud pass Cloud over the Flyers at each Chapter change, with puffs both behind and in front of them", () => {
    const passes = clouds.filter((c) => c.role === "pass");
    expect(passes).toHaveLength(3);
    passes.forEach((cloud, i) => {
      const at = route.poseAt(timeline.passes[i].centre);
      expect(cloud.x).toBeCloseTo(at.x, 5);
      expect(cloud.y).toBeCloseTo(at.y, 5);
      expect(cloud.z).toBeCloseTo(at.z, 5);
      expect(cloud.width).toBeGreaterThanOrEqual(2.5 * route.flyerHeight); // big enough to hide them
      expect(cloud.puffs.some((p) => puffDepth(cloud, p) > at.z + 0.1)).toBe(true); // veils from the front
      expect(cloud.puffs.some((p) => puffDepth(cloud, p) < at.z - 0.1)).toBe(true); // and is soft behind
    });
  });

  it("gives every Pop-out Memory two different Clouds, one to emerge from and one to leave behind, both big enough to hide it", () => {
    memories.forEach((_, i) => {
      if (timeline.memories[i].motion === "fly-by") return;
      const arrive = clouds.find((c) => c.role === "arrive" && c.memory === i)!;
      const leave = clouds.find((c) => c.role === "leave" && c.memory === i)!;
      expect(arrive).toBeDefined();
      expect(leave).toBeDefined();
      expect(arrive.id).not.toBe(leave.id);
      expect(Math.hypot(arrive.x - leave.x, arrive.y - leave.y)).toBeGreaterThan(0.1 * slots[i].width);
      for (const c of [arrive, leave]) {
        expect(c.width).toBeGreaterThanOrEqual(slots[i].width);
        expect(Math.abs(c.x - slots[i].x)).toBeLessThan(slots[i].width * 0.4);
      }
    });
  });

  it("gives a Fly-by Memory no hiding Clouds: it comes out of the haze, not from behind a Cloud", () => {
    timeline.flyBys.forEach((f) => expect(clouds.filter((c) => c.memory === f.index)).toHaveLength(0));
  });

  it("strews route Clouds along the Sea (Year 2 only), above the water and out to the sides of the route, never in the Flyers' own path", () => {
    const routeClouds = clouds.filter((c) => c.role === "route");
    expect(routeClouds.length).toBeGreaterThan(12);
    for (const c of routeClouds) {
      expect(c.y).toBeGreaterThan(route.sea!.y + 3 * route.flyerHeight); // up in the sky, above the camera's eye level
      expect(c.life).toBeDefined();
    }
    // Spread down the whole route, with a nearby one at every stretch.
    const zs = routeClouds.map((c) => c.z);
    // ...all the way to where they stop (a little before the pull-up, so the camera never rises through one).
    expect(Math.min(...zs)).toBeLessThan(route.poseAt(timeline.pullUpFrom - 0.04).z + 10 * route.flyerHeight);
    for (const c of routeClouds) {
      const nearest = Math.min(...Array.from({ length: 200 }, (_, i) => {
        const p = route.poseAt(timeline.levelAt + ((timeline.pullUpFrom - timeline.levelAt) * i) / 199);
        return Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z);
      }));
      expect(nearest).toBeGreaterThan(3 * route.flyerHeight);
    }
  });

  it("has cleared every route Cloud before the Flyers pull up out of the water, so the camera never rises through one", () => {
    const routeClouds = clouds.filter((c) => c.role === "route");
    for (const c of routeClouds) expect(c.life!.out.to).toBeLessThanOrEqual(timeline.pullUpFrom + 1e-9);
  });

  describe("climb Clouds: they stream down past the camera through Year 3", () => {
    const climb = clouds.filter((c) => c.role === "climb");
    const h = route.flyerHeight;
    const pass = timeline.passes[2];
    const alive = (progress: number) => climb.filter((c) => cloudState(c, progress).alpha > 0.004);

    it("strews a sensible number of them for an iPhone: enough to cover the climb, few enough to draw at once", () => {
      expect(climb.length).toBeGreaterThan(20);
      expect(climb.length).toBeLessThanOrEqual(60);
      expect(climb.reduce((n, c) => n + c.puffs.length, 0)).toBeLessThanOrEqual(480);
      let most = 0;
      for (let i = 0; i <= 400; i++) most = Math.max(most, alive(pass.to + ((1 - pass.to) * i) / 400).length);
      expect(most).toBeLessThanOrEqual(14);
    });

    it("keeps some Clouds in the Sky at every moment of the climb, to the very end, so it never goes bare", () => {
      for (let i = 0; i <= 200; i++) {
        const progress = pass.to + 0.01 + ((timeline.rest.to - pass.to - 0.01) * i) / 200;
        expect(alive(progress).length, `at ${progress}`).toBeGreaterThanOrEqual(3);
      }
      expect(alive(1).length).toBeGreaterThanOrEqual(4);
    });

    it("has none formed before the climb: nothing appears while the camera swings round inside the Turn-around", () => {
      for (const c of climb) {
        expect(cloudState(c, pass.to).alpha).toBe(0);
        expect(cloudState(c, 0.3).alpha).toBe(0);
      }
    });

    it("hangs them on both sides of the Flyers' line, and in front of it and behind it", () => {
      const lineX = route.poseAt(pass.to + 0.05).x;
      const lineZ = route.poseAt(pass.to + 0.05).z;
      const left = climb.filter((c) => c.x < lineX).length;
      const right = climb.filter((c) => c.x > lineX).length;
      expect(left).toBeGreaterThan(climb.length * 0.3);
      expect(right).toBeGreaterThan(climb.length * 0.3);
      expect(climb.filter((c) => c.z < lineZ - 2 * h).length).toBeGreaterThan(climb.length * 0.3);
      // In front of the Flyers' line only where the view is wide enough to see them beside the Flyers (a laptop, not a phone).
      expect(climb.some((c) => c.z > lineZ + 0.2 * h)).toBe(aspect > 1);
    });

    it("forms each one above the top of the view and clears it below the bottom, so it streams down past the camera", () => {
      for (const c of climb) {
        const formed = route.poseAt(c.life!.in.to);
        expect(c.y - formed.y).toBeGreaterThan(8 * h);
        const gone = route.poseAt(c.life!.out.from);
        if (c.life!.out.from < 1) expect(c.y - gone.y).toBeLessThan(-8 * h);
      }
    });

    it("never lets the camera rise into one: the camera is always well clear of every puff", () => {
      const rig = createCameraRig({ route, blend: timeline.passes[1], turnAround: pass });
      for (let i = 0; i <= 300; i++) {
        const progress = pass.to + ((1 - pass.to) * i) / 300;
        const cam = rig.cameraAt(progress).position;
        for (const c of climb) {
          if (cloudState(c, progress).alpha < 0.004) continue;
          for (const p of c.puffs) {
            const gap = Math.hypot(c.x + p.x - cam[0], c.y + p.y - cam[1], puffDepth(c, p) - cam[2]);
            expect(gap).toBeGreaterThan(p.size / 2 + 0.5 * h);
          }
        }
      }
    });

    it("never veils the Flyers: any puff in front of them sits clear beside their column", () => {
      const xs = Array.from({ length: 201 }, (_, i) => route.poseAt(pass.to + ((1 - pass.to) * i) / 200).x);
      const lo = Math.min(...xs) - 0.8 * h;
      const hi = Math.max(...xs) + 0.8 * h;
      const flyerZ = route.poseAt(1).z;
      for (const c of climb) {
        for (const p of c.puffs) {
          if (puffDepth(c, p) <= flyerZ + 0.3 * h) continue; // behind them: they are drawn in front
          const x = c.x + p.x;
          expect(x - p.size / 2 > hi || x + p.size / 2 < lo).toBe(true);
        }
      }
    });

    it("forms as the camera rises towards a Cloud and clears once it is well past, and scrolling back retraces it", () => {
      const c = climb[Math.floor(climb.length / 2)];
      const life = c.life!;
      expect(cloudState(c, life.in.from - 0.001).alpha).toBe(0);
      expect(cloudState(c, life.in.to).alpha).toBe(1);
      expect(cloudState(c, life.out.to + 0.001).alpha).toBe(0);
      expect(cloudState(c, (life.in.to + life.out.from) / 2).alpha).toBe(1);
      // Scrolling on and back to the same place gives the same Cloud: the state depends only on progress.
      const before = cloudState(c, life.in.to);
      cloudState(c, life.out.to + 0.05);
      expect(cloudState(c, life.in.to)).toEqual(before);
    });

    it("has a well-formed life for every one (no zero-length window, in order), so nothing is ever NaN", () => {
      for (const c of climb) {
        const life = c.life!;
        expect(life.in.to).toBeGreaterThan(life.in.from);
        expect(life.out.to).toBeGreaterThan(life.out.from);
        expect(life.out.from).toBeGreaterThanOrEqual(life.in.to);
        for (const p of [0, pass.to, 0.7, 0.9, 1]) expect(Number.isFinite(cloudState(c, p).alpha)).toBe(true);
      }
    });
  });

  it("keeps ambient Clouds within the world they wrap around, however far she scrolls", () => {
    for (const c of ambient) {
      const half = visibleHalf(aspect, c.z).width;
      for (const p of [0, 0.25, 0.5, 0.75, 1]) {
        const { x } = cloudState(c, p);
        expect(Math.abs(x)).toBeLessThanOrEqual(half + 2 * c.width + 1e-6);
      }
    }
  });
});

describe("cloudState: when a Cloud is there", () => {
  const { clouds } = build(390 / 844);
  const pass = clouds.find((c) => c.role === "pass")!;
  const first = clouds.find((c) => c.role === "arrive" && c.memory === 0)!;
  const ambient = clouds.find((c) => c.role === "ambient")!;

  it("shows ambient Clouds all through the fixed side view, drifting sideways as she scrolls (nearer ones faster)", () => {
    const dive = timeline.passes[1];
    expect(cloudState(ambient, 0).alpha).toBe(1);
    expect(cloudState(ambient, dive.from).alpha).toBe(1);
    expect(cloudState(ambient, 0.3).x).not.toBe(cloudState(ambient, 0.2).x);
    const near = clouds.filter((c) => c.role === "ambient").sort((a, b) => b.z - a.z)[0];
    const far = clouds.filter((c) => c.role === "ambient").sort((a, b) => a.z - b.z)[0];
    const moved = (c: Cloud) => Math.abs(cloudState(c, 0.01).x - cloudState(c, 0).x);
    // Compare as a share of the view at that depth: the nearer Cloud sweeps past faster.
    expect(moved(near) / visibleHalf(1, near.z).width).toBeGreaterThan(moved(far) / visibleHalf(1, far.z).width);
  });

  it("clears the ambient Clouds away inside the dive's Cloud pass, when the camera leaves the side view, and keeps them gone", () => {
    const dive = timeline.passes[1];
    let previous = 1;
    for (let i = 0; i <= 20; i++) {
      const alpha = cloudState(ambient, dive.from + ((dive.to - dive.from) * i) / 20).alpha;
      expect(alpha).toBeLessThanOrEqual(previous + 1e-12);
      previous = alpha;
    }
    expect(cloudState(ambient, dive.to).alpha).toBe(0);
    expect(cloudState(ambient, 1).alpha).toBe(0);
    expect(cloudState(ambient, dive.from - 0.01).alpha).toBe(1); // and they are back if she scrolls up
  });

  it("forms a route Cloud far ahead of the Flyers and clears it once she is well past", () => {
    const routeCloud = clouds.filter((c) => c.role === "route")[5];
    const life = routeCloud.life!;
    expect(cloudState(routeCloud, life.in.from - 0.01).alpha).toBe(0);
    expect(cloudState(routeCloud, life.in.to).alpha).toBe(1);
    expect(cloudState(routeCloud, life.out.to + 0.01).alpha).toBe(0);
  });

  it("forms a Cloud pass Cloud around the Chapter change and clears it away afterwards", () => {
    const centre = timeline.passes[0].centre;
    expect(cloudState(pass, centre).alpha).toBe(1);
    expect(cloudState(pass, 0).alpha).toBe(0);
    expect(cloudState(pass, 1).alpha).toBe(0);
  });

  it("has a Memory's hiding Cloud fully formed before the Memory starts to emerge", () => {
    expect(cloudState(first, timeline.memories[0].from).alpha).toBe(1);
  });
});
