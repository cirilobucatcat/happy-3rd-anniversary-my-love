import { describe, expect, it } from "vitest";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { placeClouds } from "@/lib/clouds";
import { placeMemories } from "@/lib/memory-layout";
import { popOut } from "@/lib/pop-out";
import { buildRoute, routeForAspect, TURNS, PORTRAIT_TURNS, visibleHalf, type Pose } from "@/lib/route";
import { buildTimeline, phaseOf, relaxedSeconds, scheduleOf } from "@/lib/timeline";

const timeline = buildTimeline(CHAPTERS);
const sweep = (from: number, to: number, n = 40) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

describe("buildTimeline: where everything happens along the scroll", () => {
  it("is about 38 screen heights long: the Chapters and Memories take about 30 of them, the Letter the rest", () => {
    expect(timeline.scrollScreens).toBeGreaterThanOrEqual(35);
    expect(timeline.scrollScreens).toBeLessThanOrEqual(41);
    const lastMemory = timeline.memories[timeline.memories.length - 1];
    expect(lastMemory.to * timeline.scrollScreens).toBeLessThanOrEqual(31);
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

describe("the Intro", () => {
  it("is the first thing on the scroll, and has cleared the screen before the first Chapter title starts writing", () => {
    expect(timeline.intro.from).toBe(0);
    expect(timeline.intro.to).toBeGreaterThan(0);
    expect(timeline.introFade.from).toBeGreaterThan(0);
    expect(timeline.introFade.to).toBeLessThanOrEqual(timeline.intro.to);
    expect(timeline.intro.to).toBeLessThanOrEqual(timeline.chapters[0].titleFrom);
    expect(timeline.chapters[0].from).toBeCloseTo(timeline.intro.to);
  });

  it("is the first of the page's invisible sections, so the page is as long as the scroll", () => {
    expect(timeline.spacers[0].kind).toBe("intro");
    const total = timeline.spacers.reduce((sum, s) => sum + s.screens, 0);
    expect(total).toBeCloseTo(timeline.scrollScreens);
  });
});

describe("Chapter openers", () => {
  it("writes each date after its title has begun, and has it complete before the first Memory emerges", () => {
    for (const chapter of timeline.chapters) {
      const first = timeline.memories.find((m) => m.chapterId === chapter.id)!;
      expect(chapter.dateFrom).toBeGreaterThan(chapter.titleFrom);
      expect(chapter.dateTo).toBeGreaterThan(chapter.dateFrom);
      expect(chapter.dateTo).toBeLessThanOrEqual(chapter.fadeFrom);
      expect(chapter.dateTo).toBeLessThanOrEqual(first.from);
    }
  });
});

describe("the Letter", () => {
  const { letter } = timeline;
  const screens = (progress: number) => progress * timeline.scrollScreens;

  it("comes after the Turn-around: the Flyers have settled before the greeting starts writing", () => {
    expect(letter.greeting.from).toBeGreaterThanOrEqual(timeline.turnAround.to);
  });

  it("brings the card up while the Flyers finish turning, before the greeting", () => {
    expect(letter.card.from).toBeGreaterThanOrEqual(timeline.turnAround.from);
    expect(letter.card.to).toBeLessThanOrEqual(letter.greeting.from);
  });

  it("runs greeting, then body, then Closing line, with no overlap", () => {
    expect(letter.greeting.to).toBeLessThanOrEqual(letter.body.from);
    expect(letter.body.to).toBeLessThanOrEqual(letter.closing.from);
  });

  it("finishes the Closing line before the scroll ends, so it stays on screen with room to spare", () => {
    expect(letter.closing.to).toBeLessThan(1);
    expect(screens(1 - letter.closing.to)).toBeGreaterThanOrEqual(0.3);
  });

  it("takes about a minute at a relaxed pace, from the start of the Turn-around to the end", () => {
    const seconds = relaxedSeconds({ ...timeline, scrollScreens: screens(1 - timeline.turnAround.from) });
    expect(seconds).toBeGreaterThanOrEqual(40);
    expect(seconds).toBeLessThanOrEqual(75);
  });

  it("gives a longer Letter more scroll, up to a limit, and a shorter one a sensible minimum", () => {
    const body = (words: number) => {
      const t = buildTimeline(CHAPTERS, { letterWords: words });
      return (t.letter.body.to - t.letter.body.from) * t.scrollScreens;
    };
    expect(body(300)).toBeGreaterThan(body(120));
    expect(body(120)).toBeGreaterThan(body(40));
    expect(body(40)).toBeGreaterThanOrEqual(2);
    expect(body(5000)).toBeLessThanOrEqual(16);
  });
});

describe("pacing", () => {
  it("takes about 4 minutes to scroll through at a relaxed pace", () => {
    expect(relaxedSeconds(timeline)).toBeGreaterThanOrEqual(210);
    expect(relaxedSeconds(timeline)).toBeLessThanOrEqual(270);
  });

  it("adds roughly ten seconds for each Memory added", () => {
    const withMemories = (count: number) => {
      const chapters = structuredClone(CHAPTERS);
      const spare = chapters[1].memories[0];
      chapters[1].memories = Array.from({ length: count }, () => ({ ...spare }));
      return relaxedSeconds(buildTimeline(chapters));
    };
    const perMemory = withMemories(6) - withMemories(5);
    expect(perMemory).toBeGreaterThanOrEqual(6);
    expect(perMemory).toBeLessThanOrEqual(12);
  });
});

const visibleHalfWidth = (aspect: number, z: number) => visibleHalf(aspect, z).width;

describe("adding or removing Memories", () => {
  const withCounts = (counts: number[]) =>
    CHAPTERS.map((chapter, i) => ({
      ...chapter,
      memories: Array.from({ length: counts[i] }, (_, k) => ({ ...chapter.memories[k % chapter.memories.length] })),
    }));

  it.each([
    ["a short story", [1, 1, 1, 1]],
    ["a longer one", [8, 9, 10, 11]],
    ["an uneven one", [2, 7, 1, 12]],
  ])("keeps the Cloud passes, the Turn-around and the Flight path in step for %s", (_name, counts) => {
    const t = buildTimeline(withCounts(counts));
    expect(t.memories).toHaveLength(counts.reduce((a, b) => a + b, 0));
    expect(t.passes).toHaveLength(3);

    // Every Memory still gets out of the way of every Cloud pass.
    for (const pass of t.passes) {
      for (const p of sweep(pass.from, pass.to, 20)) {
        for (const m of t.memories) expect(popOut(phaseOf(m, p)).visible).toBe(false);
      }
    }

    // The Flyers still reach each Cloud pass and finish the Turn-around exactly when the timeline says, on both
    // route shapes: compared with the same route flown without a schedule, at the marked stretch's own middle and end.
    const near = (a: Pose, b: Pose) => {
      expect(a.x).toBeCloseTo(b.x, 4);
      expect(a.y).toBeCloseTo(b.y, 4);
      expect(a.z).toBeCloseTo(b.z, 4);
    };
    for (const turns of [TURNS, PORTRAIT_TURNS]) {
      const plain = buildRoute(turns);
      const scheduled = buildRoute(turns, scheduleOf(t));
      const middles = plain.marks.filter((m) => m.kind === "cloud pass").map((m) => (m.from + m.to) / 2);
      expect(middles).toHaveLength(3);
      t.passes.forEach((pass, i) => near(scheduled.poseAt(pass.centre), plain.poseAt(middles[i])));
      near(scheduled.poseAt(t.turnAround.to), plain.poseAt(1));
      near(scheduled.poseAt(1), plain.poseAt(1));
    }
  });

  it.each([
    ["a short story", [1, 1, 1, 1]],
    ["a longer one", [8, 9, 10, 11]],
    ["an uneven one", [2, 7, 1, 12]],
  ])("still places every Memory and gives each its own Clouds to arrive from and leave behind, for %s, on a phone and a laptop", (_name, counts) => {
    const chapters = withCounts(counts);
    const t = buildTimeline(chapters);
    const memories = layoutMemories(chapters);
    for (const aspect of [390 / 844, 1440 / 900]) {
      const route = routeForAspect(aspect, scheduleOf(t));
      const slots = placeMemories({ aspect, memories, route, spans: t.memories });
      expect(slots).toHaveLength(memories.length);
      for (const slot of slots) {
        expect(Number.isFinite(slot.x) && Number.isFinite(slot.y)).toBe(true);
        expect(Math.abs(slot.x) + slot.width / 2).toBeLessThanOrEqual(visibleHalfWidth(aspect, slot.z) + 1e-6);
      }
      const clouds = placeClouds({ aspect, route, timeline: t, slots });
      memories.forEach((_m, i) => {
        const roles = clouds.filter((c) => c.memory === i).map((c) => c.role);
        expect(roles).toContain("arrive");
        expect(roles).toContain("leave");
      });
      expect(clouds.filter((c) => c.role === "pass")).toHaveLength(3);
    }
  });
});
