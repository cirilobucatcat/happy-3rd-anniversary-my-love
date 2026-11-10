import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/content/memories";
import { createCameraRig } from "@/lib/camera-rig";
import { SEA_FALL, seaStrength } from "@/lib/sea";
import { routeForAspect } from "@/lib/route";
import { buildTimeline, scheduleOf } from "@/lib/timeline";

const timeline = buildTimeline(CHAPTERS);
const dive = timeline.passes[1];
const turnAround = timeline.passes[2];

describe("seaStrength: how much of the Sea shows", () => {
  it("is not there before the dive's Cloud pass, comes up inside it, and is whole once the pass has cleared", () => {
    expect(seaStrength(dive.from, dive, 3)).toBe(0);
    expect(seaStrength(dive.to, dive, 3)).toBe(1);
    const mid = seaStrength((dive.from + dive.to) / 2 + 0.001, dive, 3);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("is whole at any height up to where the climb begins to leave it behind, so Year 2 is flown exactly as before", () => {
    for (const height of [-2, 0, 1, 3, SEA_FALL.from]) expect(seaStrength(dive.to + 0.1, dive, height)).toBe(1);
  });

  it("falls away steadily as the camera rises, to nothing, with no jump", () => {
    let last = 1;
    for (let height = SEA_FALL.from; height <= SEA_FALL.to + 5; height += 0.05) {
      const s = seaStrength(0.8, dive, height);
      expect(s).toBeLessThanOrEqual(last + 1e-12);
      expect(last - s).toBeLessThan(0.03);
      last = s;
    }
    expect(last).toBe(0);
  });

  it("stays gone however high the camera goes", () => {
    for (const height of [SEA_FALL.to, SEA_FALL.to + 1, 80, 160]) expect(seaStrength(1, dive, height)).toBe(0);
  });

  it("still behaves as it did when no height is given", () => {
    expect(seaStrength(dive.to, dive)).toBe(1);
  });
});

describe.each([
  ["phone", 390 / 844],
  ["laptop", 1440 / 900],
])("the Sea along the whole story (%s)", (_name, aspect) => {
  const route = routeForAspect(aspect, scheduleOf(timeline));
  const rig = createCameraRig({ route, blend: dive, turnAround });
  const strengthAt = (p: number) => seaStrength(p, dive, (rig.cameraAt(p).position[1] - route.sea!.y) / route.flyerHeight);

  it("is whole through the whole of Year 2, until the Flyers pull up out of it", () => {
    for (let p = dive.to; p <= timeline.pullUpFrom; p += 0.002) expect(strengthAt(p)).toBe(1);
  });

  it("is below the camera at the start of the climb, and has fallen away to nothing before the Letter", () => {
    expect(strengthAt(turnAround.to)).toBeGreaterThan(0.5);
    expect(strengthAt(timeline.letter.card.from)).toBe(0);
    expect(strengthAt(1)).toBe(0);
  });

  it("falls away steadily through the climb without a pop, and comes back the same way when she scrolls up", () => {
    const at = (i: number) => timeline.pullUpFrom + i * 0.0005;
    const count = Math.floor((1 - timeline.pullUpFrom) / 0.0005);
    const forward: number[] = [];
    for (let i = 0; i <= count; i++) forward.push(strengthAt(at(i)));
    for (let i = 1; i < forward.length; i++) expect(Math.abs(forward[i] - forward[i - 1])).toBeLessThan(0.05);
    // Scrolling back up over the same stretch gives the same values, in reverse.
    const backward: number[] = [];
    for (let i = count; i >= 0; i--) backward.push(strengthAt(at(i)));
    expect(backward.reverse()).toEqual(forward);
  });

  it("is gone (so not drawn at all) for most of Year 3, once the Sea is out of the frame", () => {
    let gone = 0;
    let total = 0;
    for (let p = turnAround.to; p <= 1; p += 0.001) {
      total += 1;
      if (strengthAt(p) < 0.002) gone += 1;
    }
    expect(gone / total).toBeGreaterThan(0.7);
  });
});
