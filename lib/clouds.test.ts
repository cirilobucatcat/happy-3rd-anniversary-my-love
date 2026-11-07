import { describe, expect, it } from "vitest";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { cloudState, placeClouds, puffDepth, type Cloud } from "@/lib/clouds";
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

  it("gives every Memory two different Clouds, one to emerge from and one to leave behind, both big enough to hide it", () => {
    memories.forEach((_, i) => {
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

  it("shows ambient Clouds all the time, drifting sideways as she scrolls (nearer ones faster)", () => {
    expect(cloudState(ambient, 0).alpha).toBe(1);
    expect(cloudState(ambient, 1).alpha).toBe(1);
    expect(cloudState(ambient, 0.5).x).not.toBe(cloudState(ambient, 0.4).x);
    const near = clouds.filter((c) => c.role === "ambient").sort((a, b) => b.z - a.z)[0];
    const far = clouds.filter((c) => c.role === "ambient").sort((a, b) => a.z - b.z)[0];
    const moved = (c: Cloud) => Math.abs(cloudState(c, 0.01).x - cloudState(c, 0).x);
    // Compare as a share of the view at that depth: the nearer Cloud sweeps past faster.
    expect(moved(near) / visibleHalf(1, near.z).width).toBeGreaterThan(moved(far) / visibleHalf(1, far.z).width);
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
