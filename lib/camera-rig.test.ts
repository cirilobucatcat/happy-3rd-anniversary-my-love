import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/content/memories";
import { CAMERA_DRIFT, createCameraRig, type CameraState } from "@/lib/camera-rig";
import { CAMERA, routeForAspect } from "@/lib/route";
import { buildTimeline, scheduleOf } from "@/lib/timeline";

const timeline = buildTimeline(CHAPTERS);
const schedule = scheduleOf(timeline);
const dive = timeline.passes[1];
const ASPECTS = [390 / 844, 1440 / 900];

const setup = (aspect: number) => {
  const route = routeForAspect(aspect, schedule);
  return { route, rig: createCameraRig({ route, blend: dive }), h: route.flyerHeight };
};

/** The camera as three.js would hold it, so we can ask where the Flyers land on the screen. */
function realCamera(state: CameraState, aspect: number) {
  const camera = new PerspectiveCamera(CAMERA.fov, aspect, 0.1, 400);
  camera.position.set(...state.position);
  camera.lookAt(new Vector3(...state.target));
  camera.rotateZ(state.roll);
  camera.updateMatrixWorld();
  return camera;
}
const screenOf = (state: CameraState, aspect: number, p: { x: number; y: number; z: number }) => {
  const v = new Vector3(p.x, p.y, p.z).project(realCamera(state, aspect));
  return { x: v.x, y: v.y, inFront: v.z < 1 };
};
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sweep = (from: number, to: number, n = 60) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

describe.each(ASPECTS)("cameraAt (aspect %f)", (aspect) => {
  const { route, rig, h } = setup(aspect);

  describe("fixed mode, up to the dive", () => {
    it("looks at the middle of the Sky from the usual distance, drifting a few degrees as she scrolls", () => {
      const start = rig.cameraAt(0);
      expect(start.target).toEqual([0, 0, 0]);
      expect(dist(start.position, [0, 0, 0])).toBeCloseTo(CAMERA.distance, 6);
      expect(start.roll).toBe(0);
      const angleAt = (p: number) => Math.atan2(rig.cameraAt(p).position[0], rig.cameraAt(p).position[2]);
      expect(angleAt(0)).toBeCloseTo(-CAMERA_DRIFT, 6);
      expect(angleAt(0.2)).toBeGreaterThan(angleAt(0.1));
      expect(CAMERA_DRIFT).toBeLessThan(0.1); // under about 6 degrees
    });

    it("is exactly the old fixed camera until the dive pass begins", () => {
      for (const p of sweep(0, dive.from, 20)) {
        const state = rig.cameraAt(p);
        expect(state.mode).toBe("fixed");
        expect(state.target).toEqual([0, 0, 0]);
      }
    });
  });

  describe("Chase camera, from the dive to the end of Year 2", () => {
    const year2 = sweep(schedule.levelAt, schedule.pullUpFrom, 80); // the Sea leg; the pull-up and the climb after it are for ticket 08b

    it("is behind the Flyers, above them, looking the way they are heading", () => {
      for (const p of year2) {
        const state = rig.cameraAt(p);
        expect(state.mode).toBe("chase");
        const f = route.poseAt(p);
        const ahead = [state.target[0] - state.position[0], state.target[1] - state.position[1], state.target[2] - state.position[2]];
        const toFlyers = [f.x - state.position[0], f.y - state.position[1], f.z - state.position[2]];
        // The Flyers are in front of the camera, and nearer than where it is looking.
        expect(ahead[0] * toFlyers[0] + ahead[1] * toFlyers[1] + ahead[2] * toFlyers[2]).toBeGreaterThan(0);
        expect(dist(state.position, [f.x, f.y, f.z])).toBeGreaterThan(4 * h);
        expect(dist(state.position, [f.x, f.y, f.z])).toBeLessThan(9 * h);
        expect(state.position[1]).toBeGreaterThan(f.y); // above them
        expect(state.position[2]).toBeGreaterThan(f.z - 0.1 * h); // and behind (they head into -z)
      }
    });

    it("keeps the Flyers low in the middle of the screen, backs to us, so the Sea and Sky show ahead", () => {
      for (const p of year2) {
        const f = route.poseAt(p);
        const s = screenOf(rig.cameraAt(p), aspect, f);
        expect(s.inFront).toBe(true);
        expect(s.y).toBeLessThan(-0.3); // the lower third
        expect(s.y).toBeGreaterThan(-0.8);
        expect(Math.abs(s.x)).toBeLessThan(0.2);
      }
    });

    it("tilts a few degrees into each bank, the same way the Flyers lean, and never more than that", () => {
      let seenLeft = false;
      let seenRight = false;
      for (const p of year2) {
        const bank = route.poseAt(p).roll;
        const { roll } = rig.cameraAt(p);
        expect(Math.abs(roll)).toBeLessThan(0.14); // about 8 degrees
        if (Math.abs(bank) > 0.3) {
          expect(Math.sign(roll)).toBe(-Math.sign(bank)); // left bank (negative) rolls the view left (positive)
          if (bank < 0) seenLeft = true;
          else seenRight = true;
        }
      }
      expect(seenLeft && seenRight).toBe(true);
    });

    it("stays above the water, and the Sea's horizon sits above the Flyers on the screen", () => {
      for (const p of year2) {
        const state = rig.cameraAt(p);
        expect(state.position[1]).toBeGreaterThan(route.sea!.y + 0.8 * h);
        const f = route.poseAt(p);
        const horizon = screenOf(state, aspect, { x: state.position[0], y: state.position[1], z: state.position[2] - 300 });
        expect(horizon.y).toBeGreaterThan(screenOf(state, aspect, f).y);
      }
    });

    it("comes to rest with the Flyers at the end, and holds still", () => {
      expect(rig.cameraAt(schedule.restAt)).toEqual(rig.cameraAt(1));
    });

    it("is a pure function of progress, so scrolling back up retraces it", () => {
      const forward = [0.3, 0.45, 0.6, 0.8].map((p) => rig.cameraAt(p));
      const backward = [0.8, 0.6, 0.45, 0.3].map((p) => rig.cameraAt(p)).reverse();
      expect(backward).toEqual(forward);
    });
  });

  describe("the blend inside the dive's Cloud pass", () => {
    it("starts as the fixed camera and ends as the Chase camera", () => {
      expect(rig.cameraAt(dive.from).mode).toBe("fixed");
      expect(rig.cameraAt(dive.to).mode).toBe("chase");
      const mid = rig.cameraAt((dive.from + dive.to) / 2);
      expect(mid.mode).toBe("blend");
    });

    it("moves without a jump: no step in position, aim or tilt is larger than a smooth sweep needs", () => {
      const states = sweep(dive.from - 0.002, dive.to + 0.002, 400).map((p) => rig.cameraAt(p));
      let longest = 0;
      for (let i = 1; i < states.length; i++) {
        longest = Math.max(longest, dist(states[i].position, states[i - 1].position), dist(states[i].target, states[i - 1].target));
        expect(Math.abs(states[i].roll - states[i - 1].roll)).toBeLessThan(0.02);
      }
      expect(longest).toBeLessThan(1.5);
    });

    it("keeps the Flyers in front of the camera and on the screen all the way through the swing", () => {
      for (const p of sweep(dive.from, dive.to, 40)) {
        const s = screenOf(rig.cameraAt(p), aspect, route.poseAt(p));
        expect(s.inFront).toBe(true);
        expect(Math.abs(s.x)).toBeLessThan(0.9);
        expect(Math.abs(s.y)).toBeLessThan(0.9);
      }
    });

    it("runs the other way when she scrolls back", () => {
      const p = (dive.from + dive.to) / 2;
      const there = rig.cameraAt(p);
      rig.cameraAt(dive.to + 0.05);
      expect(rig.cameraAt(p)).toEqual(there);
      expect(rig.cameraAt(dive.from - 0.05).mode).toBe("fixed");
    });
  });
});
