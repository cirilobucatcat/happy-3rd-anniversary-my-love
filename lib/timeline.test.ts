import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/content/memories";
import { popOut } from "@/lib/pop-out";
import { buildTimeline, phaseOf, scheduleOf } from "@/lib/timeline";

const timeline = buildTimeline(CHAPTERS);
const sweep = (from: number, to: number, n = 40) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

describe("buildTimeline: where everything happens along the scroll", () => {
  it("is about 32 screen heights long", () => {
    expect(timeline.scrollScreens).toBeGreaterThanOrEqual(31);
    expect(timeline.scrollScreens).toBeLessThanOrEqual(33);
  });

  it("writes each Chapter title slowly (over at least a screen of scrolling) and holds it long enough to read", () => {
    const screens = (progress: number) => progress * timeline.scrollScreens;
    for (const chapter of timeline.chapters) {
      expect(screens(chapter.titleTo - chapter.titleFrom)).toBeGreaterThanOrEqual(1);
      expect(screens(chapter.fadeFrom - chapter.titleTo)).toBeGreaterThanOrEqual(0.45);
    }
  });

  it("pops the Flyers up only after the first Chapter title has finished writing, and before the first Memory emerges", () => {
    const first = timeline.chapters[0];
    expect(timeline.flyersPop.from).toBeGreaterThanOrEqual(first.titleTo);
    expect(timeline.flyersPop.to).toBeGreaterThan(timeline.flyersPop.from);
    expect(timeline.flyersPop.to).toBeLessThanOrEqual(timeline.memories[0].from);
  });

  it("gives every Memory its own stretch of scroll, in order, inside 0..1", () => {
    const all = timeline.memories;
    expect(all).toHaveLength(CHAPTERS.flatMap((c) => c.memories).length);
    for (let i = 0; i < all.length; i++) {
      expect(all[i].from).toBeGreaterThanOrEqual(0);
      expect(all[i].to).toBeLessThanOrEqual(1);
      expect(all[i].to).toBeGreaterThan(all[i].from);
    }
  });

  it("has a Cloud pass at each of the three Chapter changes, and none elsewhere", () => {
    expect(timeline.passes).toHaveLength(3);
    const firstOf = (chapterId: string) => timeline.memories.find((m) => m.chapterId === chapterId)!;
    const lastOf = (chapterId: string) => [...timeline.memories].reverse().find((m) => m.chapterId === chapterId)!;
    CHAPTERS.slice(0, -1).forEach((chapter, i) => {
      const pass = timeline.passes[i];
      expect(pass.centre).toBeGreaterThan(lastOf(chapter.id).to);
      expect(pass.centre).toBeLessThan(firstOf(CHAPTERS[i + 1].id).from);
    });
  });

  it("keeps every Memory out of sight during a Cloud pass, so the Flyers are only ever veiled by Clouds", () => {
    for (const pass of timeline.passes) {
      for (const p of sweep(pass.from, pass.to)) {
        for (const m of timeline.memories) expect(popOut(phaseOf(m, p)).visible).toBe(false);
      }
    }
  });

  it("writes each Chapter title in full before that Chapter's first Memory emerges", () => {
    for (const chapter of timeline.chapters) {
      const first = timeline.memories.find((m) => m.chapterId === chapter.id)!;
      expect(chapter.titleFrom).toBeLessThan(chapter.titleTo);
      expect(chapter.titleTo).toBeLessThanOrEqual(first.from);
      // ...and has cleared the screen by then, so the first Memory is not competing with it.
      expect(chapter.fadeFrom).toBeGreaterThanOrEqual(chapter.titleTo);
      expect(chapter.fadeTo).toBeLessThanOrEqual(first.from);
    }
  });

  it("makes the Turn-around after the last Memory has gone and before the end of the scroll", () => {
    const last = timeline.memories[timeline.memories.length - 1];
    expect(timeline.turnAround.from).toBeGreaterThanOrEqual(last.to);
    expect(timeline.turnAround.to).toBeLessThanOrEqual(1);
    expect(timeline.turnAround.to).toBeGreaterThan(timeline.turnAround.from);
  });
});

describe("phaseOf", () => {
  const m = { from: 0.2, to: 0.4 };
  it("is 0 before, 1 after, and linear through a Memory's stretch", () => {
    expect(phaseOf(m, 0)).toBe(0);
    expect(phaseOf(m, 0.3)).toBeCloseTo(0.5);
    expect(phaseOf(m, 0.9)).toBe(1);
  });
});

describe("scheduleOf", () => {
  it("hands the route the moment the Flyers appear, the Cloud passes and the Turn-around", () => {
    const schedule = scheduleOf(timeline);
    expect(schedule.start).toBe(timeline.flyersPop.from);
    expect(schedule.passes).toBe(timeline.passes);
    expect(schedule.turnAround).toBe(timeline.turnAround);
  });
});
