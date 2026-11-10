import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/content/memories";
import { DEFAULT_SKY_STOPS, cloudTint, skyLayers, skyStopsOf, stackedOpacities } from "@/lib/sky";
import { buildTimeline } from "@/lib/timeline";

describe("skyLayers", () => {
  it("is pure dawn pink at progress 0", () => {
    expect(skyLayers(0)).toEqual({ dawn: 1, day: 0, sunset: 0, rose: 0, stars: 0 });
  });

  it("is bright pink day at progress 0.35", () => {
    const s = skyLayers(0.35);
    expect(s.day).toBeCloseTo(1);
    expect(s.dawn).toBeCloseTo(0);
    expect(s.sunset).toBeCloseTo(0);
  });

  it("is sunset at progress 0.7", () => {
    const s = skyLayers(0.7);
    expect(s.sunset).toBeCloseTo(1);
    expect(s.day).toBeCloseTo(0);
    expect(s.rose).toBeCloseTo(0);
  });

  it("is deep rose with stars at progress 1", () => {
    const s = skyLayers(1);
    expect(s.rose).toBeCloseTo(1);
    expect(s.sunset).toBeCloseTo(0);
    expect(s.stars).toBeCloseTo(1);
  });

  it("cross-fades halfway between dawn and day", () => {
    const s = skyLayers(0.175);
    expect(s.dawn).toBeCloseTo(0.5);
    expect(s.day).toBeCloseTo(0.5);
  });

  it("keeps stars hidden through the day and sunset", () => {
    expect(skyLayers(0.35).stars).toBe(0);
    expect(skyLayers(0.7).stars).toBe(0);
  });

  it("brings the stars in exactly as the rose sky comes in", () => {
    for (const p of [0.75, 0.8, 0.9, 0.97]) expect(skyLayers(p).stars).toBeCloseTo(skyLayers(p).rose, 12);
  });

  it("fades stars in only near the end", () => {
    const s = skyLayers(0.9);
    expect(s.stars).toBeGreaterThan(0);
    expect(s.stars).toBeLessThan(1);
  });

  it("clamps progress outside 0..1", () => {
    expect(skyLayers(-3)).toEqual(skyLayers(0));
    expect(skyLayers(7)).toEqual(skyLayers(1));
  });
});

describe("stackedOpacities", () => {
  it("keeps dawn fully opaque underneath so no page background shows through", () => {
    for (const p of [0, 0.1, 0.175, 0.35, 0.5, 0.7, 0.9, 1]) {
      expect(stackedOpacities(skyLayers(p)).dawn).toBe(1);
    }
  });

  it("fades the incoming layer over the outgoing one (halfway dawn to day)", () => {
    const s = stackedOpacities(skyLayers(0.175));
    expect(s.day).toBeCloseTo(0.5);
    expect(s.sunset).toBe(0);
    expect(s.rose).toBe(0);
  });

  it("covers the earlier layers completely once a later layer is fully in", () => {
    expect(stackedOpacities(skyLayers(0.35)).day).toBeCloseTo(1);
    expect(stackedOpacities(skyLayers(0.7)).sunset).toBeCloseTo(1);
    expect(stackedOpacities(skyLayers(1)).rose).toBeCloseTo(1);
  });

  it("blends sunset into deep rose halfway between them", () => {
    const s = stackedOpacities(skyLayers(0.85));
    expect(s.sunset).toBe(1);
    expect(s.rose).toBeCloseTo(0.5);
  });
});

describe("cloudTint: the Clouds take the colour of the Sky stage", () => {
  const [r0, g0, b0] = cloudTint(0);
  const [r1, g1, b1] = cloudTint(0.35);
  const [r2, g2, b2] = cloudTint(0.7);
  const [r3, g3, b3] = cloudTint(1);

  it("is white-pink at dawn: pale, with a little more red than blue-green", () => {
    expect(r0).toBe(1);
    expect(g0).toBeGreaterThan(0.85);
    expect(b0).toBeGreaterThan(0.9);
    expect(g0).toBeLessThan(1);
  });

  it("is bright white by day", () => {
    expect([r1, g1, b1]).toEqual([1, 1, 1]);
  });

  it("is orange-pink at sunset: red high, blue clearly lowest", () => {
    expect(r2).toBeGreaterThan(g2);
    expect(g2).toBeGreaterThan(b2);
    expect(b2).toBeLessThan(0.8);
  });

  it("is rose-tinted at the Letter: pink, with green lowest", () => {
    expect(r3).toBeGreaterThan(b3);
    expect(b3).toBeGreaterThan(g3);
  });

  it("changes smoothly between stages", () => {
    const mid = cloudTint(0.525); // halfway between day and sunset
    expect(mid[2]).toBeLessThan(1);
    expect(mid[2]).toBeGreaterThan(b2);
  });
});

describe("Sky moods follow the Chapters", () => {
  const timeline = buildTimeline(CHAPTERS);
  const stops = skyStopsOf(timeline);
  const [toYear1, toYear2, toYear3] = timeline.passes;
  const at = (p: number) => skyLayers(p, stops);
  const chapter = (id: string) => timeline.chapters.find((c) => c.id === id)!;
  const middle = (c: { from: number; to: number }) => (c.from + c.to) / 2;

  it("is dawn pink through How we met", () => {
    expect(at(0).dawn).toBe(1);
    expect(at(middle(chapter("met"))).dawn).toBe(1);
    expect(at(toYear1.from).dawn).toBe(1);
  });

  it("is bright day through Year 1", () => {
    expect(at(toYear1.to).day).toBe(1);
    expect(at(middle(chapter("year-1"))).day).toBe(1);
    expect(at(toYear2.from).day).toBe(1);
  });

  it("changes across each Chapter change inside the Cloud pass, steadily, with the old mood gone before the pass ends", () => {
    for (const [pass, from, to] of [
      [toYear1, "dawn", "day"],
      [toYear2, "day", "day"],
    ] as const) {
      if (from === to) continue;
      let previous = -1;
      for (let i = 0; i <= 20; i++) {
        const p = pass.from + ((pass.to - pass.from) * i) / 20;
        const w = at(p)[to];
        expect(w).toBeGreaterThanOrEqual(previous - 1e-12);
        previous = w;
      }
      expect(at(pass.from)[from]).toBe(1);
      expect(at(pass.to)[to]).toBe(1);
    }
  });

  it("turns from day to sunset over the Sea in Year 2, and is sunset by the end of it", () => {
    const year2 = chapter("year-2");
    expect(at(year2.from + (year2.to - year2.from) * 0.1).day).toBeGreaterThan(0.6);
    const mid = at(middle(year2));
    expect(mid.day).toBeGreaterThan(0.1);
    expect(mid.sunset).toBeGreaterThan(0.1);
    expect(at(toYear3.from).sunset).toBe(1);
  });

  it("deepens from sunset into rose through the climb, and is deep rose by the Letter", () => {
    const year3 = chapter("year-3");
    expect(at(toYear3.to).sunset).toBe(1);
    expect(at(middle(year3)).rose).toBeGreaterThan(0.2);
    expect(at(middle(year3)).rose).toBeLessThan(0.8);
    expect(at(timeline.letter.card.from).rose).toBe(1);
    expect(at(timeline.letter.card.from).sunset).toBe(0);
    expect(at(1).rose).toBe(1);
  });

  it("brings the stars in as the Flyers rise in Year 3: none before, steadily more through the climb, all of them by the Letter", () => {
    for (const p of [0, 0.3, toYear2.from, toYear3.from, toYear3.to]) expect(at(p).stars).toBe(0);
    let previous = 0;
    for (let i = 0; i <= 50; i++) {
      const p = toYear3.to + ((timeline.letter.card.from - toYear3.to) * i) / 50;
      const stars = at(p).stars;
      expect(stars).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = stars;
    }
    expect(at(middle(chapter("year-3"))).stars).toBeGreaterThan(0.15);
    expect(at(middle(chapter("year-3"))).stars).toBeLessThan(0.85);
    expect(at(timeline.letter.card.from).stars).toBe(1);
    expect(at(1).stars).toBe(1);
  });

  it("always adds up to one whole mood, so the Sky never goes thin between layers", () => {
    for (let p = 0; p <= 1; p += 0.01) {
      const w = at(p);
      expect(w.dawn + w.day + w.sunset + w.rose).toBeCloseTo(1, 9);
    }
  });

  it("tints the Clouds with the mood: orange-pink by the end of Year 2, white by day", () => {
    expect(cloudTint(toYear2.from, stops)).toEqual([1, 1, 1]);
    const [r, g, b] = cloudTint(toYear3.from, stops);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it("falls back to the old fixed stops when no timeline is given", () => {
    expect(skyLayers(0.35).day).toBeCloseTo(1);
    expect(skyStopsOf({ passes: [] })).toEqual(DEFAULT_SKY_STOPS);
  });
});
