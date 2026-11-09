import { describe, expect, it } from "vitest";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { MEMORY_Z, placeMemories } from "@/lib/memory-layout";
import { ARRIVE_END, LEAVE_START } from "@/lib/pop-out";
import { CAMERA, routeForAspect, visibleHalf } from "@/lib/route";
import { buildTimeline, scheduleOf } from "@/lib/timeline";

const memories = layoutMemories(CHAPTERS);
const timeline = buildTimeline(CHAPTERS);
const ASPECTS = [360 / 640, 390 / 844, 0.8, 1, 1440 / 900, 1920 / 1080];

describe.each(ASPECTS)("placeMemories (aspect %f)", (aspect) => {
  const route = routeForAspect(aspect, scheduleOf(timeline));
  const slots = placeMemories({ aspect, memories, route, spans: timeline.memories });
  const half = visibleHalf(aspect, MEMORY_Z);

  it("fits every Memory, frame and handwritten line, on the screen", () => {
    expect(slots).toHaveLength(memories.length);
    for (const s of slots) {
      expect(s.x - s.width / 2).toBeGreaterThanOrEqual(-half.width);
      expect(s.x + s.width / 2).toBeLessThanOrEqual(half.width);
      expect(s.y + s.height / 2).toBeLessThanOrEqual(half.height);
      expect(s.y - s.height / 2 - s.lineHeight).toBeGreaterThanOrEqual(-half.height);
    }
  });

  it("keeps the Flyers off the handwritten line while a Memory is being read, so they never block it", () => {
    let covered = 0;
    let looked = 0;
    slots.forEach((s, i) => {
      const span = timeline.memories[i];
      const d = CAMERA.distance - s.z;
      for (let k = 0; k <= 40; k++) {
        const phase = ARRIVE_END + ((LEAVE_START - ARRIVE_END) * k) / 40;
        const f = route.poseAt(span.from + phase * (span.to - span.from));
        const fd = CAMERA.distance - f.z;
        const r = (0.5 * route.flyerHeight) / fd; // a little smaller than the placement's own margin
        const [fx, fy] = [f.x / fd, f.y / fd];
        const x0 = (s.x - s.width / 2) / d;
        const x1 = (s.x + s.width / 2) / d;
        const y1 = (s.y - s.height / 2) / d;
        const y0 = (s.y - s.height / 2 - s.lineHeight) / d;
        looked += 1;
        if (fx + r > x0 && fx - r < x1 && fy + r > y0 && fy - r < y1) covered += 1;
      }
    });
    expect(covered / looked).toBeLessThan(0.03);
  });

  it("keeps the usual alternating sides when the Flyers are not in the way", () => {
    const usual = placeMemories({ aspect, memories, route: { ...route, poseAt: () => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }) } as typeof route, spans: timeline.memories });
    // Parked in the middle of the Sky the Flyers favour neither side, so every Memory keeps its own.
    usual.forEach((s, i) => expect(s.side).toBe(memories[i].side));
  });
});
