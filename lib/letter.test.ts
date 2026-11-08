import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/content/memories";
import { letterView, letterWords, liftFor } from "@/lib/letter";
import { buildTimeline } from "@/lib/timeline";

// Hand-made stretches of scroll so every expected number can be worked out on paper. They are multiples of 1/16, which
// are exact in floating point, so "halfway" really is 0.5 and not 0.5000000000000001.
const spans = {
  card: { from: 0.0625, to: 0.125 },
  greeting: { from: 0.125, to: 0.1875 },
  body: { from: 0.1875, to: 0.6875 },
  closing: { from: 0.6875, to: 0.8125 },
};

describe("letterWords", () => {
  it("counts the words of the body, across paragraphs", () => {
    expect(letterWords({ greeting: "My love,", body: ["One two three.", "Four  five\nsix seven."], closing: "Done." })).toBe(7);
  });

  it("is zero for an empty body", () => {
    expect(letterWords({ greeting: "Hi", body: [], closing: "Bye" })).toBe(0);
  });
});

describe("letterView: what the Letter shows at each point of the scroll", () => {
  const lines = 8;

  it("shows nothing before the card rises", () => {
    expect(letterView(spans, 0, lines)).toEqual({ card: 0, greeting: 0, lines: Array(lines).fill(0), closing: 0 });
  });

  it("raises the card first, then writes the greeting on it", () => {
    const rising = letterView(spans, 0.09375, lines);
    expect(rising.card).toBeCloseTo(0.5);
    expect(rising.greeting).toBe(0);

    const greeting = letterView(spans, 0.15625, lines);
    expect(greeting.card).toBe(1);
    expect(greeting.greeting).toBeCloseTo(0.5);
    expect(greeting.lines.every((l) => l === 0)).toBe(true);
  });

  it("shows the body line by line: at the halfway point the first four of eight lines are in and the rest are not", () => {
    const view = letterView(spans, 0.4375, lines);
    expect(view.greeting).toBe(1);
    expect(view.lines.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(view.lines.slice(4)).toEqual([0, 0, 0, 0]);
  });

  it("eases one line in at a time, always in order", () => {
    // A line and a half in: 1.5 / 8 of the way through the body, which is 0.1875 + 0.5 * 0.1875 = 0.28125.
    const view = letterView(spans, 0.28125, lines);
    expect(view.lines[0]).toBe(1);
    expect(view.lines[1]).toBeCloseTo(0.5);
    expect(view.lines[2]).toBe(0);

    for (let i = 0; i <= 1000; i++) {
      const l = letterView(spans, i / 1000, lines).lines;
      for (let k = 1; k < l.length; k++) expect(l[k - 1]).toBeGreaterThanOrEqual(l[k]);
    }
  });

  it("writes the Closing line last: only once every line is in", () => {
    for (let i = 0; i <= 1000; i++) {
      const view = letterView(spans, i / 1000, lines);
      if (view.closing > 0) expect(view.lines.every((l) => l === 1)).toBe(true);
    }
    expect(letterView(spans, 0.75, lines).closing).toBeCloseTo(0.5);
  });

  it("keeps everything, the Closing line included, on screen at the end", () => {
    for (const progress of [0.8125, 0.9, 1]) {
      expect(letterView(spans, progress, lines)).toEqual({ card: 1, greeting: 1, lines: Array(lines).fill(1), closing: 1 });
    }
  });

  it("gives the same view for the same progress, so scrolling back undoes it", () => {
    const forward = [0.09, 0.16, 0.5, 0.75].map((p) => letterView(spans, p, lines));
    const backward = [0.75, 0.5, 0.16, 0.09].map((p) => letterView(spans, p, lines)).reverse();
    expect(backward).toEqual(forward);
  });

  it("copes with a Letter that has no body lines", () => {
    const view = letterView(spans, 0.4375, 0);
    expect(view.lines).toEqual([]);
    expect(view.greeting).toBe(1);
  });

  it("works on the real timeline: the Closing line is fully written at the very end of the page", () => {
    const { letter } = buildTimeline(CHAPTERS);
    const end = letterView(letter, 1, 18);
    expect(end.closing).toBe(1);
    expect(end.lines.every((l) => l === 1)).toBe(true);
  });
});

describe("liftFor: sliding a long Letter up so the newest line stays in view", () => {
  // Greeting, three lines and the Closing line, with the bottom of each in pixels down the Letter.
  const bottoms = [40, 80, 120, 160, 220];

  it("does not move a Letter that fits in the window", () => {
    expect(liftFor(bottoms, [1, 1, 1, 1, 1], 300)).toBe(0);
  });

  it("does not move anything before the first piece is in", () => {
    expect(liftFor(bottoms, [0, 0, 0, 0, 0], 100)).toBe(0);
  });

  it("lifts a long Letter just enough to keep the last visible piece inside the window", () => {
    // Everything in, window of 150: the Closing line's bottom (220) must sit at 150, so lift by 70.
    expect(liftFor(bottoms, [1, 1, 1, 1, 1], 150)).toBe(70);
    // Only the first three pieces in: their bottom is 120, which fits.
    expect(liftFor(bottoms, [1, 1, 1, 0, 0], 150)).toBe(0);
  });

  it("slides smoothly as the newest piece comes in", () => {
    // The fourth piece half in: its bottom is half way from 120 to 160, i.e. 140, which still fits in 150...
    expect(liftFor(bottoms, [1, 1, 1, 0.5, 0], 150)).toBe(0);
    // ...and the Closing line half in is half way from 160 to 220, i.e. 190: lift by 40.
    expect(liftFor(bottoms, [1, 1, 1, 1, 0.5], 150)).toBe(40);
  });

  it("leaves a margin below the newest piece when asked", () => {
    expect(liftFor(bottoms, [1, 1, 1, 1, 1], 150, 20)).toBe(90);
  });
});
