import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/content/memories";
import { routeForAspect } from "@/lib/route";
import { BURST_COUNT, PALETTE, STARDUST_COUNT, STARDUST_SPAN, colourAt, stardustPieces, type Piece } from "@/lib/stardust";
import { buildTimeline, scheduleOf } from "@/lib/timeline";

const timeline = buildTimeline(CHAPTERS);
const pop = timeline.flyersPop;
const route = routeForAspect(390 / 844, scheduleOf(timeline));
const h = route.flyerHeight;

const stream = (progress: number, clock = 0) => stardustPieces(route, progress, clock, pop).filter((p) => !p.burst);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** How far a piece has drifted from the point on the Flight path where it was dropped. */
const drift = (p: Piece) => {
  const at = route.poseAt(p.birth);
  return Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z);
};

describe("Stardust", () => {
  it("is not there before the Flyers spring up", () => {
    expect(stardustPieces(route, pop.from - 0.01, 0, pop)).toHaveLength(0);
    expect(stardustPieces(route, pop.from, 0, pop)).toHaveLength(0);
  });

  it("streams about 120 pieces behind them once they are well under way", () => {
    for (const progress of [0.3, 0.5, 0.8]) {
      const n = stream(progress).length;
      expect(n).toBeGreaterThanOrEqual(STARDUST_COUNT - 2);
      expect(n).toBeLessThanOrEqual(STARDUST_COUNT + 1);
    }
  });

  it("runs from hot pink right behind the Flyers, through coral and orange, to gold at the tail", () => {
    const pieces = stream(0.5);
    const young = pieces.filter((p) => p.age < 0.04);
    const mid = pieces.filter((p) => p.age > 0.4 && p.age < 0.5);
    const old = pieces.filter((p) => p.age > 0.75);
    expect(young.length).toBeGreaterThan(0);
    expect(old.length).toBeGreaterThan(0);
    for (const p of young) expect(p.shade).toBeLessThan(0.1); // hot pink
    for (const p of mid) expect(Math.abs(p.shade - 2 / 3)).toBeLessThan(0.12); // orange, while still bright
    for (const p of old) expect(p.shade).toBeGreaterThan(0.95); // gold
    // In between, older always means further along, give or take the shimmer.
    const byAge = [...pieces].sort((a, b) => a.age - b.age);
    for (let i = 10; i < byAge.length; i++) expect(byAge[i].shade).toBeGreaterThan(byAge[i - 10].shade - 0.08);
  });

  it("keeps to the sky's pinks and oranges, strong enough to stand out against it", () => {
    const pink = colourAt(0);
    const gold = colourAt(1);
    expect(pink).toEqual([...PALETTE[0]]);
    expect(gold).toEqual([...PALETTE[PALETTE.length - 1]]);
    expect(pink[2]).toBeGreaterThan(pink[1]); // pink leans blue over green
    expect(gold[1]).toBeGreaterThan(gold[2]); // gold leans green over blue
    for (let t = 0; t <= 1; t += 0.05) {
      const [r, g, b] = colourAt(t);
      expect(r).toBeGreaterThan(0.95); // warm all the way: never a blue, green or violet
      expect(r - Math.min(g, b)).toBeGreaterThan(0.6); // saturated, not washed out to pastel
    }
  });

  it("mixes stars, sparkles and glitter dots, about one star to every two sparkles", () => {
    const pieces = stardustPieces(route, 0.9, 0, pop).filter((p) => !p.burst);
    const count = (shape: Piece["shape"]) => pieces.filter((p) => p.shape === shape).length;
    const ratio = count("star") / count("sparkle");
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.8);
    expect(count("dot")).toBeGreaterThan(5);
    expect(count("dot")).toBeLessThan(count("star"));
  });

  it("leaves each piece where it was dropped, only drifting out sideways as it ages", () => {
    const before = new Map(stream(0.5).map((p) => [p.id, p]));
    const after = stream(0.5 + STARDUST_SPAN / 2);
    let shared = 0;
    for (const p of after) {
      const q = before.get(p.id);
      if (!q) continue;
      shared++;
      expect(p.birth).toBe(q.birth);
      expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(h * 0.6); // the Flyers flew on, it stayed
      expect(drift(p)).toBeGreaterThanOrEqual(drift(q) - 1e-9);
    }
    expect(shared).toBeGreaterThan(STARDUST_COUNT / 3);
  });

  it("spreads from about the Flyers' own width to about twice that at the tail", () => {
    const pieces = stream(0.6);
    const young = pieces.filter((p) => p.age < 0.25).map(drift);
    const old = pieces.filter((p) => p.age > 0.75).map(drift);
    expect(mean(old)).toBeGreaterThan(mean(young) * 1.3);
    expect(Math.max(...young)).toBeLessThan(h * 0.85);
    expect(Math.max(...old)).toBeLessThan(h * 1.25);
  });

  it("shrinks and fades towards the tail, and is gone about 2.4 screens back", () => {
    const pieces = stream(0.5);
    const young = pieces.filter((p) => p.age > 0.1 && p.age < 0.3);
    const old = pieces.filter((p) => p.age > 0.7);
    expect(mean(old.map((p) => p.size))).toBeLessThan(mean(young.map((p) => p.size)) * 0.8);
    expect(mean(old.map((p) => p.alpha))).toBeLessThan(mean(young.map((p) => p.alpha)) * 0.5);
    for (const p of pieces) {
      expect(p.age).toBeGreaterThanOrEqual(0);
      expect(p.age).toBeLessThan(1);
      expect(0.5 - p.birth).toBeLessThan(STARDUST_SPAN);
    }
  });

  it("follows the scroll exactly (scrolling back rewinds it) and only twinkles with time", () => {
    const first = stream(0.5, 3);
    stream(0.7, 3);
    const back = stream(0.5, 3);
    expect(back).toEqual(first);

    const later = stream(0.5, 3.4);
    expect(later.map((p) => [p.id, p.x, p.y, p.z])).toEqual(first.map((p) => [p.id, p.x, p.y, p.z]));
    const twinkled = later.filter((p, i) => Math.abs(p.alpha - first[i].alpha) > 0.02);
    expect(twinkled.length).toBeGreaterThan(STARDUST_COUNT / 3);
  });

  it("bursts out in every pink and orange as the Flyers spring up, then clears", () => {
    const mid = pop.from + (pop.to - pop.from) * 0.8;
    const burst = stardustPieces(route, mid, 0, pop).filter((p) => p.burst);
    expect(burst).toHaveLength(BURST_COUNT);
    const at = route.poseAt(pop.from);
    for (const p of burst) {
      expect(Math.hypot(p.x - at.x, p.y - at.y)).toBeGreaterThan(h * 0.15);
      expect(p.alpha).toBeGreaterThan(0);
    }
    const shades = burst.map((p) => p.shade);
    expect(Math.min(...shades)).toBe(0);
    expect(Math.max(...shades)).toBe(1);

    const after = stardustPieces(route, pop.from + (pop.to - pop.from) * 3, 0, pop);
    expect(after.filter((p) => p.burst)).toHaveLength(0);
    // and scrolling back before the spring takes it all away again
    expect(stardustPieces(route, pop.from - 0.001, 0, pop)).toHaveLength(0);
  });
});
