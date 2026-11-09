import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { createCameraRig } from "@/lib/camera-rig";
import { FLY_BY, flyByClarity, labelProgress, placeFlyBys } from "@/lib/fly-by";
import { CAMERA, routeForAspect } from "@/lib/route";
import { buildTimeline, scheduleOf } from "@/lib/timeline";

const H = 1; // clarity is worked out in Flyer heights, so these tests use 1
const at = (heights: number) => heights * H;

describe("flyByClarity: how clear a picture is from how far ahead of the Flyers it is", () => {
  it("is fully clear while the Flyers are alongside, a little before and a little after", () => {
    for (const d of [-0.3, 0, 0.3, 0.8]) expect(flyByClarity(at(d), H)).toBe(1);
  });

  it("is lost in the haze while far away, ahead or behind", () => {
    expect(flyByClarity(at(FLY_BY.farAhead), H)).toBe(0);
    expect(flyByClarity(at(FLY_BY.farAhead + 30), H)).toBe(0);
    expect(flyByClarity(at(-FLY_BY.farBehind), H)).toBe(0);
    expect(flyByClarity(at(-FLY_BY.farBehind - 30), H)).toBe(0);
  });

  it("comes clear steadily as the Flyers close in, and fades steadily after they pass", () => {
    let previous = 0;
    for (let d = FLY_BY.farAhead; d >= 0; d -= 0.1) {
      const c = flyByClarity(at(d), H);
      expect(c).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = c;
    }
    previous = 1;
    for (let d = 0; d >= -FLY_BY.farBehind; d -= 0.1) {
      const c = flyByClarity(at(d), H);
      expect(c).toBeLessThanOrEqual(previous + 1e-12);
      previous = c;
    }
  });

  it("never bounces or overshoots, and never jumps", () => {
    let last = flyByClarity(at(-12), H);
    for (let d = -12; d <= 14; d += 0.01) {
      const c = flyByClarity(at(d), H);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      expect(Math.abs(c - last)).toBeLessThan(0.03);
      last = c;
    }
  });

  it("depends only on the distance, so scrolling back retraces it", () => {
    expect(flyByClarity(at(3.3), H)).toBe(flyByClarity(at(3.3), H));
  });

  it("is in terms of the Flyers' own height, so a bigger Flyers' route scales it up", () => {
    expect(flyByClarity(3.3 * 2.5, 2.5)).toBeCloseTo(flyByClarity(3.3, 1), 12);
  });

  it("keeps the next picture hidden while the Flyers are alongside one, since pictures are about 8 heights apart", () => {
    expect(flyByClarity(at(8), H)).toBeLessThan(0.1);
  });
});

describe("labelProgress: the Month label writes on as the picture clears", () => {
  it("is not started while the picture is lost in the haze", () => {
    expect(labelProgress(at(FLY_BY.farAhead), H)).toBe(0);
    expect(labelProgress(at(FLY_BY.farAhead + 5), H)).toBe(0);
  });

  it("is complete when the Flyers are alongside, and stays complete after", () => {
    expect(labelProgress(at(FLY_BY.clearHalf), H)).toBe(1);
    expect(labelProgress(0, H)).toBe(1);
    expect(labelProgress(at(-3), H)).toBe(1);
    expect(labelProgress(at(-FLY_BY.farBehind - 5), H)).toBe(1);
  });

  it("writes steadily as they close in, and unwrites in reverse when she scrolls back", () => {
    let previous = 0;
    for (let d = FLY_BY.farAhead; d >= FLY_BY.clearHalf; d -= 0.1) {
      const l = labelProgress(at(d), H);
      expect(l).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = l;
    }
  });
});

const timeline = buildTimeline(CHAPTERS);
const schedule = scheduleOf(timeline);
const all = layoutMemories(CHAPTERS);
const flyByMemories = timeline.flyBys.map((f) => all[f.index]);

describe.each([
  ["phone", 390 / 844],
  ["laptop", 1440 / 900],
])("placeFlyBys (%s)", (_name, aspect) => {
  const route = routeForAspect(aspect, schedule);
  const rig = createCameraRig({ route, blend: timeline.passes[1] });
  const placed = placeFlyBys({ aspect, memories: flyByMemories, flyBys: timeline.flyBys, route, camera: rig });

  /** Where a world point lands on the screen at the moment the Flyers are alongside picture k (-1..1 each way). */
  const screen = (k: number, x: number, y: number, z: number) => {
    const state = rig.cameraAt(timeline.flyBys[k].alongside);
    const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 400);
    camera.position.set(...state.position);
    camera.lookAt(new Vector3(...state.target));
    camera.rotateZ(state.roll);
    camera.updateMatrixWorld();
    const v = new Vector3(x, y, z).project(camera);
    return { x: v.x, y: v.y };
  };

  it("places one picture for every Fly-by Memory, with the distance along the route at which the Flyers are alongside", () => {
    expect(placed).toHaveLength(24);
    placed.forEach((p, k) => expect(p.distance).toBeCloseTo(route.distanceAt(timeline.flyBys[k].alongside), 9));
    for (let k = 1; k < placed.length; k++) expect(placed[k].distance).toBeGreaterThan(placed[k - 1].distance);
  });

  it("hangs each picture in the upper left or the upper right of the screen, on the side the timeline gives it", () => {
    placed.forEach((p, k) => {
      const frame = screen(k, p.slot.x, p.slot.y, p.slot.z);
      expect(Math.sign(frame.x)).toBe(timeline.flyBys[k].side === "left" ? -1 : 1);
      expect(frame.y).toBeGreaterThan(0);
    });
  });

  it("takes about the same share of the screen as a Pop-out Memory: about 70% of the width on a phone, up to 40% on a laptop", () => {
    placed.forEach((p, k) => {
      const left = screen(k, p.slot.x - (p.slot.width / 2) * Math.cos(p.yaw), p.slot.y, p.slot.z + (p.slot.width / 2) * Math.sin(p.yaw));
      const right = screen(k, p.slot.x + (p.slot.width / 2) * Math.cos(p.yaw), p.slot.y, p.slot.z - (p.slot.width / 2) * Math.sin(p.yaw));
      const share = (right.x - left.x) / 2;
      if (aspect < 0.7) {
        expect(share).toBeGreaterThan(0.55);
        expect(share).toBeLessThan(0.75);
      } else {
        // Up to 40%; a tall photo is held smaller so it stays in the part of the screen above the Flyers.
        expect(share).toBeGreaterThan(0.15);
        expect(share).toBeLessThan(0.42);
      }
    });
  });

  it("is fully on the screen when the Flyers are alongside, with the Month label under the frame", () => {
    placed.forEach((p, k) => {
      const topY = p.slot.y + p.slot.height / 2;
      const bottomY = p.slot.y - p.slot.height / 2 - p.slot.lineHeight;
      const half = p.slot.width / 2;
      // The picture's own width runs along (cos yaw, 0, -sin yaw).
      for (const [sign, y] of [
        [-1, topY],
        [1, bottomY],
        [-1, bottomY],
        [1, topY],
      ] as const) {
        const s = screen(k, p.slot.x + sign * half * Math.cos(p.yaw), y, p.slot.z - sign * half * Math.sin(p.yaw));
        expect(Math.abs(s.x)).toBeLessThan(1.0);
        expect(Math.abs(s.y)).toBeLessThan(1.0);
      }
    });
  });

  it("never covers the Flyers: its lowest edge, label included, stays clear above their heads", () => {
    placed.forEach((p, k) => {
      const f = route.poseAt(timeline.flyBys[k].alongside);
      const heads = screen(k, f.x, f.y + 0.6 * route.flyerHeight, f.z);
      const bottom = screen(k, p.slot.x, p.slot.y - p.slot.height / 2 - p.slot.lineHeight, p.slot.z);
      expect(bottom.y).toBeGreaterThan(heads.y);
    });
  });

  it("keeps the next picture lost in the haze while the Flyers are alongside one, using the real spacing of the route", () => {
    for (let k = 0; k + 1 < placed.length; k++) {
      if (timeline.flyBys[k + 1].index !== timeline.flyBys[k].index + 1) continue;
      const ahead = placed[k + 1].distance - placed[k].distance;
      expect(flyByClarity(ahead, route.flyerHeight)).toBeLessThan(0.1);
    }
  });

  it("never covers the Flyers at any moment, not just when they are alongside: while it is still visible, the Flyers are clear of its frame on the screen", () => {
    const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 400);
    placed.forEach((p, k) => {
      const a = timeline.flyBys[k].alongside;
      for (let i = 0; i <= 60; i++) {
        const progress = a - 0.02 + (0.04 * i) / 60;
        const away = p.distance - route.distanceAt(progress);
        if (flyByClarity(away, route.flyerHeight) < 0.15) continue; // faint enough to be a haze, not a cover
        const state = rig.cameraAt(progress);
        camera.position.set(...state.position);
        camera.lookAt(new Vector3(...state.target));
        camera.rotateZ(state.roll);
        camera.updateMatrixWorld();
        const toScreen = (x: number, y: number, z: number) => new Vector3(x, y, z).project(camera);
        const half = p.slot.width / 2;
        const top = p.slot.y + p.slot.height / 2;
        const bottom = p.slot.y - p.slot.height / 2 - p.slot.lineHeight;
        const corners = [-1, 1].flatMap((sx) =>
          [top, bottom].map((y) => toScreen(p.slot.x + sx * half * Math.cos(p.yaw), y, p.slot.z - sx * half * Math.sin(p.yaw))),
        );
        const xs = corners.map((c) => c.x);
        const ys = corners.map((c) => c.y);
        const f = route.poseAt(progress);
        const flyers = [toScreen(f.x, f.y, f.z), toScreen(f.x, f.y + 0.5 * route.flyerHeight, f.z)];
        for (const v of flyers) {
          const inside = v.x > Math.min(...xs) && v.x < Math.max(...xs) && v.y > Math.min(...ys) && v.y < Math.max(...ys);
          expect(inside).toBe(false);
        }
      }
    });
  });

  it("hangs upright and faces the camera", () => {
    placed.forEach((p, k) => {
      const state = rig.cameraAt(timeline.flyBys[k].alongside);
      const toCamera = [state.position[0] - p.slot.x, state.position[2] - p.slot.z];
      // The picture's front (+z turned by its yaw) points at the camera, give or take the camera's own sideways offset.
      const front = [Math.sin(p.yaw), Math.cos(p.yaw)];
      const cos = (front[0] * toCamera[0] + front[1] * toCamera[1]) / Math.hypot(toCamera[0], toCamera[1]);
      expect(cos).toBeGreaterThan(0.9);
    });
  });

  it("hangs just above the water", () => {
    placed.forEach((p) => {
      const bottom = p.slot.y - p.slot.height / 2 - p.slot.lineHeight;
      expect(bottom).toBeGreaterThan(route.sea!.y);
      expect(bottom - route.sea!.y).toBeLessThan(4 * route.flyerHeight);
    });
  });
});
