import { describe, expect, it } from "vitest";
import { PINYON } from "@/lib/fonts/pinyon";
import { layoutText, strokeProgress, type ScriptFont } from "@/lib/write-on";

// A tiny font with known geometry, so expected values are worked out by hand, not by the code under test.
// "l" is one 100-unit vertical pen stroke; "t" is two strokes (100 vertical + 50 horizontal); advance 60.
// Each stroke is [pen width, x0, y0, x1, y1, ...]; `d` is the glyph's filled outline.
const TINY: ScriptFont = {
  unitsPerEm: 1000,
  ascent: 800,
  descent: -200,
  glyphs: {
    " ": { adv: 60, d: "", strokes: [] },
    l: { adv: 60, d: "M0 0L10 0L10 100L0 100Z", strokes: [[24, 0, 0, 0, 100]] },
    t: {
      adv: 60,
      d: "M0 0L10 0L10 100L0 100Z",
      strokes: [
        [20, 0, 0, 0, 100],
        [12, -25, 60, 25, 60],
      ],
    },
  },
  kern: { lt: -15 },
};

describe("layoutText", () => {
  it("makes one stroke per pen-down stroke, in writing order, with their lengths", () => {
    const text = layoutText("lt", TINY);
    expect(text.strokes.map((s) => s.length)).toEqual([100, 100, 50]);
    expect(text.totalLength).toBe(250);
  });

  it("keeps each stroke's own pen width", () => {
    const text = layoutText("lt", TINY);
    expect(text.strokes.map((s) => s.width)).toEqual([24, 20, 12]);
  });

  it("advances each glyph by its width, so the second letter starts 60 units to the right", () => {
    const text = layoutText("ll", TINY);
    expect(text.strokes[1].points[0]).toBe(60);
  });

  it("tightens a kerned pair: the t after an l sits 15 units closer", () => {
    const text = layoutText("lt", TINY);
    expect(text.strokes[1].points[0]).toBe(60 - 15);
  });

  it("places every glyph's filled outline at its pen position and baseline", () => {
    const text = layoutText("ll", TINY);
    expect(text.glyphs.map((g) => [g.x, g.y])).toEqual([
      [0, 800],
      [60, 800],
    ]);
    expect(text.glyphs[0].d).toBe("M0 0L10 0L10 100L0 100Z");
  });

  it("puts the page y axis downward: a stroke going up the glyph goes up the page", () => {
    const text = layoutText("l", TINY);
    const [, y0, , y1] = text.strokes[0].points;
    expect(y1).toBeLessThan(y0);
  });

  it("wraps onto a new line when the text is wider than maxWidth, keeping every stroke", () => {
    const one = layoutText("l l l", TINY);
    const wrapped = layoutText("l l l", TINY, { maxWidth: 150 });
    expect(wrapped.strokes).toHaveLength(one.strokes.length);
    expect(wrapped.height).toBeGreaterThan(one.height);
    expect(wrapped.width).toBeLessThanOrEqual(150);
  });

  it("skips characters the font does not have instead of throwing", () => {
    expect(() => layoutText("l\u{1F495}l", TINY)).not.toThrow();
    expect(layoutText("l\u{1F495}l", TINY).strokes).toHaveLength(2);
  });

  it("lays out real Captions with the bundled Pinyon Script font", () => {
    const text = layoutText("The very first hello", PINYON);
    expect(text.strokes.length).toBeGreaterThan(10);
    expect(text.glyphs).toHaveLength("Theveryfirsthello".length);
    expect(text.width).toBeGreaterThan(0);
  });

  it("has a pen path up to the dot on an i, so the dot is not left out when the letters are written on", () => {
    const i = PINYON.glyphs.i;
    const numbers = (i.d.match(/-?\d+/g) ?? []).map(Number);
    const outlineTop = Math.max(...numbers.filter((_, k) => k % 2 === 1)); // path data alternates x, y
    const penTop = Math.max(...i.strokes.flatMap((st) => st.filter((_, k) => k > 0 && k % 2 === 0)));
    expect(penTop).toBeGreaterThan(outlineTop - 0.08 * PINYON.unitsPerEm);
  });
});

describe("strokeProgress (Write-on progress)", () => {
  const lengths = [100, 100, 50]; // total 250

  it("draws nothing at 0 and everything at 1", () => {
    expect(strokeProgress(lengths, 0)).toEqual([0, 0, 0]);
    expect(strokeProgress(lengths, 1)).toEqual([1, 1, 1]);
  });

  it("draws stroke by stroke: the first stroke completes before the second starts", () => {
    // 100 of 250 units written = exactly the first stroke.
    expect(strokeProgress(lengths, 0.4)).toEqual([1, 0, 0]);
  });

  it("is part-way through the stroke being written", () => {
    // 150 of 250 units: first done, second half done.
    const r = strokeProgress(lengths, 0.6);
    expect(r[0]).toBe(1);
    expect(r[1]).toBeCloseTo(0.5);
    expect(r[2]).toBe(0);
  });

  it("undraws in reverse when progress goes back down (same input, same output)", () => {
    const forward = [0.2, 0.5, 0.9].map((p) => strokeProgress(lengths, p));
    const backward = [0.9, 0.5, 0.2].map((p) => strokeProgress(lengths, p)).reverse();
    expect(backward).toEqual(forward);
  });

  it("clamps progress outside 0..1", () => {
    expect(strokeProgress(lengths, -3)).toEqual([0, 0, 0]);
    expect(strokeProgress(lengths, 7)).toEqual([1, 1, 1]);
  });

  it("handles text with no strokes", () => {
    expect(strokeProgress([], 0.5)).toEqual([]);
  });
});
