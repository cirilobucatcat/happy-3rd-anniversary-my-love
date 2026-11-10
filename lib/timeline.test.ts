import { describe, expect, it } from "vitest";
import { CHAPTERS, layoutMemories, type Chapter } from "@/content/memories";
import { placeClouds } from "@/lib/clouds";
import { placeMemories } from "@/lib/memory-layout";
import { popOut } from "@/lib/pop-out";
import { buildRoute, routeForAspect, TURNS, PORTRAIT_TURNS, visibleHalf, type Pose } from "@/lib/route";
import { SCREENS, buildTimeline, phaseOf, relaxedSeconds, scheduleOf } from "@/lib/timeline";

const timeline = buildTimeline(CHAPTERS);
const sweep = (from: number, to: number, n = 40) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

describe("buildTimeline: where everything happens along the scroll", () => {
  // 15 Pop-out Memories at 1.2 screens and 24 Fly-by Memories at 0.8.
  it("is about 54 screen heights long: the Chapters and Memories take about 46 of them, the Letter the rest", () => {
    expect(timeline.scrollScreens).toBeGreaterThanOrEqual(51);
    expect(timeline.scrollScreens).toBeLessThanOrEqual(57);
    const lastMemory = timeline.memories[timeline.memories.length - 1];
    expect(lastMemory.to * timeline.scrollScreens).toBeLessThanOrEqual(47);
  });

  it("gives each of the 15 Pop-out Memories 1.2 screens and each of the 24 Fly-by Memories 0.8", () => {
    expect(timeline.memories).toHaveLength(39);
    const screens = (m: { from: number; to: number }) => (m.to - m.from) * timeline.scrollScreens;
    const popOuts = timeline.memories.filter((m) => m.motion === "pop-out");
    const flyBys = timeline.memories.filter((m) => m.motion === "fly-by");
    expect(popOuts).toHaveLength(15);
    expect(flyBys).toHaveLength(24);
    for (const m of popOuts) expect(screens(m)).toBeCloseTo(1.2, 6);
    for (const m of flyBys) expect(screens(m)).toBeCloseTo(SCREENS.flyByMemory, 6);
    expect(SCREENS.flyByMemory).toBe(0.8);
  });

  it("takes 9.6 screens for the 12 pictures of Year 2", () => {
    const year2 = timeline.memories.filter((m) => m.chapterId === "year-2");
    expect(year2).toHaveLength(12);
    const span = (year2[year2.length - 1].to - year2[0].from) * timeline.scrollScreens;
    expect(span).toBeCloseTo(9.6, 6);
  });

  it("makes Years 2 and 3 Fly-bys and leaves How we met and Year 1 as Pop-outs", () => {
    for (const m of timeline.memories) {
      expect(m.motion).toBe(m.chapterId === "year-2" || m.chapterId === "year-3" ? "fly-by" : "pop-out");
    }
  });

  it("puts the Flyers alongside a Fly-by picture in the middle of its stretch, on alternating sides", () => {
    const flyBys = timeline.memories.filter((m) => m.motion === "fly-by");
    expect(timeline.flyBys).toHaveLength(24);
    timeline.flyBys.forEach((f, k) => {
      const m = flyBys[k];
      expect(f.index).toBe(m.index);
      expect(f.alongside).toBeCloseTo((m.from + m.to) / 2, 9);
      expect(f.side).toBe(k % 2 === 0 ? "left" : "right");
    });
  });

  it("hands the Sea only Year 2's 12 pictures, and hangs Year 3's 12 in the open Sky", () => {
    expect(timeline.seaFlyBys).toHaveLength(12);
    expect(timeline.skyFlyBys).toHaveLength(12);
    expect(timeline.flyBys.filter((f) => f.chapterId === "year-3")).toHaveLength(12);
    for (const f of timeline.seaFlyBys) expect(timeline.memories[f.index].chapterId).toBe("year-2");
    for (const f of timeline.skyFlyBys) expect(timeline.memories[f.index].chapterId).toBe("year-3");
    expect(timeline.seaFlyBys).toEqual(timeline.flyBys.slice(0, 12));
    expect(timeline.skyFlyBys).toEqual(timeline.flyBys.slice(12));
  });

  it("says which Fly-bys sit over water, so only those get a reflection", () => {
    for (const f of timeline.flyBys) expect(f.over).toBe(f.chapterId === "year-2" ? "sea" : "sky");
  });

  it("carries the sides on from Year 2 into Year 3: Year 2 ends on the right, so Year 3 opens on the left and keeps alternating", () => {
    expect(timeline.seaFlyBys[11].side).toBe("right");
    timeline.skyFlyBys.forEach((f, k) => expect(f.side).toBe(k % 2 === 0 ? "left" : "right"));
  });

  it("gives each Year 3 picture 0.8 screens, one after another", () => {
    timeline.skyFlyBys.forEach((f, k) => {
      const m = timeline.memories[f.index];
      expect((m.to - m.from) * timeline.scrollScreens).toBeCloseTo(SCREENS.flyByMemory, 6);
      if (k > 0) expect(m.from).toBeCloseTo(timeline.memories[timeline.skyFlyBys[k - 1].index].to, 9);
    });
  });

  it("starts writing Year 3's title inside the Turn-around, the third Cloud pass, and has it finished and faded before the first picture", () => {
    const year3 = timeline.chapters.find((c) => c.id === "year-3")!;
    const pass = timeline.passes[2];
    expect(year3.titleFrom).toBeGreaterThanOrEqual(pass.from);
    expect(year3.titleFrom).toBeLessThan(pass.to);
    expect(year3.fadeTo).toBeLessThan(timeline.memories[timeline.skyFlyBys[0].index].from);
  });

  it("has the Flyers level over the Sea a little after the dive pass (Year 1 to Year 2) has cleared, and well before the first picture", () => {
    const dive = timeline.passes[1];
    expect(timeline.levelAt).toBeGreaterThan(dive.to);
    expect(timeline.levelAt).toBeLessThan(timeline.flyBys[0].alongside);
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

  it("has the Flyers slow to a stop after the last Memory has gone and before the end of the scroll", () => {
    const last = timeline.memories[timeline.memories.length - 1];
    expect(timeline.rest.from).toBeGreaterThanOrEqual(last.to);
    expect(timeline.rest.to).toBeLessThanOrEqual(1);
    expect(timeline.rest.to).toBeGreaterThan(timeline.rest.from);
  });

  it("calls nothing the Turn-around but the Year 2 to Year 3 Cloud pass: the stretch where the Flyers come to rest is `rest`", () => {
    expect("turnAround" in timeline).toBe(false);
    expect("turnAroundFrom" in SCREENS).toBe(false);
    expect("turnAroundTo" in SCREENS).toBe(false);
    expect(SCREENS.restFrom).toBeLessThan(SCREENS.restTo);
  });

  it("has the Flyers start pulling up out of the Sea after the last Sea picture and before the Year 2 to Year 3 Cloud pass begins", () => {
    const lastSea = timeline.seaFlyBys[timeline.seaFlyBys.length - 1];
    expect(timeline.pullUpFrom).toBeGreaterThan(lastSea.alongside);
    expect(timeline.pullUpFrom).toBeLessThan(timeline.passes[2].from);
    // With room to pull up in: a few tenths of a screen before the pass.
    expect((timeline.passes[2].from - timeline.pullUpFrom) * timeline.scrollScreens).toBeGreaterThan(0.2);
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
  it("hands the route the moment the Flyers appear, the Cloud passes, when they level out over the Sea, Year 2's pictures, the pull-up and the slow-down to rest", () => {
    const schedule = scheduleOf(timeline);
    expect(schedule.start).toBe(timeline.flyersPop.from);
    expect(schedule.passes).toBe(timeline.passes);
    expect(schedule.levelAt).toBe(timeline.levelAt);
    expect(schedule.flyBys).toBe(timeline.seaFlyBys);
    expect(schedule.pullUpFrom).toBe(timeline.pullUpFrom);
    expect(schedule.restFrom).toBe(timeline.rest.from);
    expect(schedule.restAt).toBe(timeline.rest.to);
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

  it("comes after the Flyers have come to rest: they have settled before the greeting starts writing", () => {
    expect(letter.greeting.from).toBeGreaterThanOrEqual(timeline.rest.to);
  });

  it("brings the card up while the Flyers finish slowing, before the greeting", () => {
    expect(letter.card.from).toBeGreaterThanOrEqual(timeline.rest.from);
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

  it("takes about a minute at a relaxed pace, from the start of the slow-down to the end", () => {
    const seconds = relaxedSeconds({ ...timeline, scrollScreens: screens(1 - timeline.rest.from) });
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
  // About 54 screens at 6.5 seconds a screen: a little under 6 minutes, with a Memory for every Month.
  it("takes about 5.8 minutes to scroll through at a relaxed pace, with a Memory for every Month", () => {
    expect(relaxedSeconds(timeline)).toBeGreaterThanOrEqual(330);
    expect(relaxedSeconds(timeline)).toBeLessThanOrEqual(370);
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
  /** The same Chapters with `counts[i]` Memories each, repeating the real ones (each Chapter keeps its own kind and so the shape of its Memories). */
  const withCounts = (counts: number[]) =>
    CHAPTERS.map((chapter, i) => {
      const memories = Array.from({ length: counts[i] }, (_, k) => ({ ...chapter.memories[k % chapter.memories.length] }));
      return { ...chapter, memories } as Chapter;
    });

  it.each([
    ["a short story", [1, 1, 1, 1]],
    ["a longer one", [8, 9, 10, 11]],
    ["an uneven one", [2, 7, 1, 12]],
  ])("keeps the Cloud passes, the dive and the Flight path in step for %s", (_name, counts) => {
    const t = buildTimeline(withCounts(counts));
    expect(t.memories).toHaveLength(counts.reduce((a, b) => a + b, 0));
    expect(t.passes).toHaveLength(3);

    // Every Memory still gets out of the way of every Cloud pass.
    for (const pass of t.passes) {
      for (const p of sweep(pass.from, pass.to, 20)) {
        for (const m of t.memories) expect(popOut(phaseOf(m, p)).visible).toBe(false);
      }
    }

    // The Flyers still reach each Cloud pass and finish the fitted part (the dive) exactly when the timeline says, on
    // both route shapes: compared with the same route flown without a schedule, at the marked stretch's middle and end.
    const near = (a: Pose, b: Pose) => {
      expect(a.x).toBeCloseTo(b.x, 4);
      expect(a.y).toBeCloseTo(b.y, 4);
      expect(a.z).toBeCloseTo(b.z, 4);
    };
    for (const turns of [TURNS, PORTRAIT_TURNS]) {
      const plain = buildRoute(turns);
      const scheduled = buildRoute(turns, scheduleOf(t));
      const middles = plain.marks.filter((m) => m.kind === "cloud pass").map((m) => (m.from + m.to) / 2);
      expect(middles).toHaveLength(2);
      t.passes.slice(0, 2).forEach((pass, i) => near(scheduled.poseAt(pass.centre), plain.poseAt(middles[i])));
      near(scheduled.poseAt(t.passes[1].to), plain.poseAt(1));
      near(scheduled.poseAt(1), plain.poseAt(1));
    }
  });

  it.each([
    ["a short story", [1, 1, 1, 1]],
    ["a longer one", [8, 9, 10, 11]],
    ["an uneven one", [2, 7, 1, 12]],
  ])("still places every Memory and gives each Pop-out its own Clouds to arrive from and leave behind, for %s, on a phone and a laptop", (_name, counts) => {
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
        // Pop-out Memories emerge from and slip behind a Cloud; Fly-bys come out of the haze and have none.
        if (t.memories[i].motion === "fly-by") return expect(roles).toHaveLength(0);
        expect(roles).toContain("arrive");
        expect(roles).toContain("leave");
      });
      expect(clouds.filter((c) => c.role === "pass")).toHaveLength(3);
    }
  });
});
