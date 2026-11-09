import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/content/memories";
import { CAMERA_DRIFT, createCameraRig, type CameraState } from "@/lib/camera-rig";
import { CAMERA, routeForAspect } from "@/lib/route";
import { buildTimeline, scheduleOf } from "@/lib/timeline";

const timeline = buildTimeline(CHAPTERS);
const schedule = scheduleOf(timeline);
const dive = timeline.passes[1];
const turnAround = timeline.passes[2];
const ASPECTS = [390 / 844, 1440 / 900];

const setup = (aspect: number) => {
  const route = routeForAspect(aspect, schedule);
  return { route, rig: createCameraRig({ route, blend: dive, turnAround }), h: route.flyerHeight };
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
  describe("Chase camera through the pull-up, up to the Turn-around", () => {
    it("is exactly as it was in Year 2: the Sea leg is the same with or without the face-on camera", () => {
      const without = createCameraRig({ route, blend: dive });
      for (const p of sweep(schedule.levelAt, schedule.pullUpFrom, 60)) expect(rig.cameraAt(p)).toEqual(without.cameraAt(p));
      for (const p of sweep(0, dive.to, 60)) expect(rig.cameraAt(p)).toEqual(without.cameraAt(p));
    });

    it("keeps the Flyers on the screen, and never looks straight up (where the view would spin), as they pull up out of the water", () => {
      for (const p of sweep(schedule.pullUpFrom, turnAround.from, 60)) {
        const state = rig.cameraAt(p);
        expect(state.mode).toBe("chase");
        const s = screenOf(state, aspect, route.poseAt(p));
        expect(s.inFront).toBe(true);
        expect(Math.abs(s.x)).toBeLessThan(0.5);
        expect(Math.abs(s.y)).toBeLessThan(0.9);
        const forward = [state.target[0] - state.position[0], state.target[1] - state.position[1], state.target[2] - state.position[2]];
        expect(Math.abs(forward[1]) / Math.hypot(...forward)).toBeLessThan(0.9);
      }
    });
  });

  describe("face-on mode, from the Turn-around on (the Face-on climb)", () => {
    const climb = sweep(turnAround.to, 1, 80);
    const rest = timeline.rest;

    it("is in front of the Flyers on the +z side, above them, looking at them", () => {
      for (const p of climb) {
        const state = rig.cameraAt(p);
        expect(state.mode).toBe("face-on");
        const f = route.poseAt(p);
        const forward = [state.target[0] - state.position[0], state.target[1] - state.position[1], state.target[2] - state.position[2]];
        const length = Math.hypot(...forward);
        expect(forward[2] / length).toBeLessThan(-0.95); // looking into the screen, at the Flyers' chests
        expect(state.position[2] - f.z).toBeGreaterThan(7 * h);
        expect(state.position[2] - f.z).toBeLessThan(11 * h);
        expect(state.position[1]).toBeGreaterThan(f.y); // from a little above
        expect(state.position[1] - f.y).toBeLessThan(5 * h);
      }
    });

    it("keeps the Flyers at the same place on the screen, low in the middle, through Year 3, while the world moves past", () => {
      const at = (p: number) => screenOf(rig.cameraAt(p), aspect, route.poseAt(p));
      const first = at(turnAround.to);
      for (const p of climb) {
        const s = at(p);
        expect(s.inFront).toBe(true);
        expect(s.y).toBeLessThan(-0.5); // the lower third
        expect(s.y).toBeGreaterThan(-0.8);
        expect(Math.abs(s.x)).toBeLessThan(0.05);
        expect(Math.abs(s.x - first.x)).toBeLessThan(0.03);
        expect(Math.abs(s.y - first.y)).toBeLessThan(0.03);
      }
      // The camera climbs with them: it keeps its height above them while the world slides down past.
      const lift = (p: number) => rig.cameraAt(p).position[1] - route.poseAt(p).y;
      for (const p of climb) expect(lift(p)).toBeCloseTo(lift(turnAround.to), 6);
      expect(rig.cameraAt(rest.from).position[1]).toBeGreaterThan(rig.cameraAt(turnAround.to).position[1] + 40 * h);
    });

    it("shows the climb's slight sway as the world swinging, not the Flyers sliding: the aim turns a little each way", () => {
      const turns = climb.map((p) => {
        const s = rig.cameraAt(p);
        return (s.target[0] - s.position[0]) / Math.hypot(s.target[0] - s.position[0], s.target[2] - s.position[2]);
      });
      expect(Math.max(...turns)).toBeGreaterThan(0.015);
      expect(Math.min(...turns)).toBeLessThan(-0.015);
      expect(Math.max(...turns.map(Math.abs))).toBeLessThan(0.25); // a few degrees to ten, never more
    });

    it("tilts a hair into the Flyers' lean, and never more than a degree or two", () => {
      for (const p of climb) {
        const { roll } = rig.cameraAt(p);
        expect(Math.abs(roll)).toBeLessThan(0.04);
        const lean = route.poseAt(p).roll;
        if (Math.abs(lean) > 0.05) expect(Math.sign(roll)).toBe(Math.sign(lean));
      }
    });

    it("ends with the Flyers at rest, face on, low enough that the whole Letter card sits clear above their heads", () => {
      expect(rig.cameraAt(schedule.restAt)).toEqual(rig.cameraAt(1));
      const end = rig.cameraAt(1);
      const f = route.poseAt(1);
      const centre = screenOf(end, aspect, f);
      const top = screenOf(end, aspect, { ...f, y: f.y + 0.5 * h });
      const bottom = screenOf(end, aspect, { ...f, y: f.y - 0.5 * h });
      // The Letter card's bottom edge is at most 68% of the way down the screen (app/globals.css): -0.36 on the screen's own scale.
      expect(top.y).toBeLessThan(-0.4);
      expect(bottom.y).toBeGreaterThan(-0.95);
      expect(centre.y).toBeLessThan(-0.5);
    });

    it("is a pure function of progress, so scrolling back up retraces it", () => {
      const ps = [turnAround.to + 0.01, rest.from, 0.9];
      const forward = ps.map((p) => rig.cameraAt(p));
      const backward = [...ps].reverse().map((p) => rig.cameraAt(p)).reverse();
      expect(backward).toEqual(forward);
    });
  });

  describe("the blend inside the Turn-around's Cloud pass", () => {
    const mid = (turnAround.from + turnAround.to) / 2;

    it("starts as the Chase camera, passes through a blend, and ends as the face-on camera, with no visible jump", () => {
      expect(rig.cameraAt(turnAround.from).mode).toBe("chase");
      expect(rig.cameraAt(mid).mode).toBe("blend");
      expect(rig.cameraAt(turnAround.to).mode).toBe("face-on");
      // Equal values at both ends of the blend: a hair either side of each end is hardly different.
      for (const end of [turnAround.from, turnAround.to]) {
        const a = rig.cameraAt(end - 1e-5);
        const b = rig.cameraAt(end + 1e-5);
        expect(dist(a.position, b.position)).toBeLessThan(0.05 * h);
        expect(dist(a.target, b.target)).toBeLessThan(0.1 * h);
        expect(Math.abs(a.roll - b.roll)).toBeLessThan(0.002);
      }
    });

    it("moves without a jump: no step in position, aim or tilt is larger than a smooth sweep needs", () => {
      const states = sweep(turnAround.from - 0.002, turnAround.to + 0.002, 400).map((p) => rig.cameraAt(p));
      for (let i = 1; i < states.length; i++) {
        expect(dist(states[i].position, states[i - 1].position)).toBeLessThan(0.8 * h);
        expect(dist(states[i].target, states[i - 1].target)).toBeLessThan(2.5 * h);
        expect(Math.abs(states[i].roll - states[i - 1].roll)).toBeLessThan(0.01);
      }
    });

    it("goes from behind the Flyers to in front without passing through them, and keeps them on the screen all the way", () => {
      for (const p of sweep(turnAround.from, turnAround.to, 60)) {
        const state = rig.cameraAt(p);
        const f = route.poseAt(p);
        expect(dist(state.position, [f.x, f.y, f.z])).toBeGreaterThan(3 * h);
        const s = screenOf(state, aspect, f);
        expect(s.inFront).toBe(true);
        expect(Math.abs(s.x)).toBeLessThan(0.9);
        expect(Math.abs(s.y)).toBeLessThan(0.9);
        const forward = [state.target[0] - state.position[0], state.target[1] - state.position[1], state.target[2] - state.position[2]];
        expect(Math.abs(forward[1]) / Math.hypot(...forward)).toBeLessThan(0.95); // never straight up or down
      }
    });

    it("runs the other way when she scrolls back", () => {
      const there = rig.cameraAt(mid);
      rig.cameraAt(turnAround.to + 0.05);
      expect(rig.cameraAt(mid)).toEqual(there);
      expect(rig.cameraAt(turnAround.from - 0.01).mode).toBe("chase");
    });
  });
});
