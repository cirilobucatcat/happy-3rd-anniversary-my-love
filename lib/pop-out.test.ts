import { describe, expect, it } from "vitest";
import { ARRIVE_END, LEAVE_START, captionProgress, popOut } from "@/lib/pop-out";

const phases = (n: number, from = 0, to = 1) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

describe("popOut: a Memory's arrival, stay and departure over its own stretch of scroll", () => {
  it("starts out of sight, hidden behind its Cloud", () => {
    const s = popOut(0);
    expect(s.visible).toBe(false);
    expect(s.forward).toBe(0);
    expect(s.stage).toBe("hidden");
  });

  it("emerges and springs forward: it moves toward the camera, with a small bounce past its place", () => {
    const arriving = phases(60, 0.001, ARRIVE_END - 0.001).map((p) => popOut(p));
    expect(arriving.every((s) => s.visible)).toBe(true);
    expect(arriving.every((s) => s.stage === "arriving")).toBe(true);
    const forward = arriving.map((s) => s.forward);
    expect(Math.max(...forward)).toBeGreaterThan(1.03); // bounce: goes past its resting place
    expect(Math.max(...forward)).toBeLessThan(1.35); // but only a small one
    expect(forward[0]).toBeLessThan(0.1); // starts back behind the Cloud
  });

  it("settles from a tilt into place: tilted while arriving, exactly level and at rest once settled", () => {
    const tilts = phases(60, 0.001, ARRIVE_END - 0.001).map((p) => Math.abs(popOut(p).tilt));
    expect(Math.max(...tilts)).toBeGreaterThan(0.1);
    const settled = popOut(ARRIVE_END);
    expect(settled.forward).toBe(1);
    expect(settled.tilt).toBeCloseTo(0, 10);
    expect(settled.scale).toBe(1);
  });

  it("stays in front, perfectly still, for the whole time it is being read", () => {
    for (const p of phases(20, ARRIVE_END, LEAVE_START)) {
      const s = popOut(p);
      expect(s.stage).toBe("settled");
      expect(s.settled).toBe(true);
      expect(s.forward).toBe(1);
      expect(s.tilt).toBeCloseTo(0, 10);
    }
  });

  it("is only settled while it is in front: arriving and leaving Memories are not", () => {
    for (const p of [0.05, ARRIVE_END * 0.9, LEAVE_START + 0.01, 0.95]) {
      expect(popOut(p).settled).toBe(false);
    }
  });

  it("leaves backward, behind another Cloud, and ends out of sight", () => {
    const leaving = phases(40, LEAVE_START + 0.001, 0.999).map((p) => popOut(p));
    const forward = leaving.map((s) => s.forward);
    for (let i = 1; i < forward.length; i++) expect(forward[i]).toBeLessThanOrEqual(forward[i - 1] + 1e-9);
    expect(leaving.every((s) => s.stage === "leaving")).toBe(true);
    expect(popOut(1).visible).toBe(false);
    expect(popOut(1).forward).toBeCloseTo(0, 10);
  });

  it("is a pure function of phase, so scrolling back retraces the same pop-out", () => {
    const forward = [0.03, 0.12, 0.5, 0.8, 0.95].map((p) => popOut(p));
    const backward = [0.95, 0.8, 0.5, 0.12, 0.03].map((p) => popOut(p)).reverse();
    expect(backward).toEqual(forward);
  });

  it("clamps phases outside 0..1 to hidden", () => {
    expect(popOut(-0.5).visible).toBe(false);
    expect(popOut(1.5).visible).toBe(false);
  });
});

describe("captionProgress: the Caption's Write-on across a Memory's stretch of scroll", () => {
  it("has not started before the Memory emerges", () => {
    expect(captionProgress(0)).toBe(0);
  });

  it("is complete by the time the Memory has settled in front, and stays complete while it is read and leaves", () => {
    expect(captionProgress(ARRIVE_END)).toBe(1);
    expect(captionProgress(0.5)).toBe(1);
    expect(captionProgress(0.95)).toBe(1);
  });

  it("writes while the Memory arrives, getting further as she scrolls", () => {
    const p = phases(10, 0, ARRIVE_END).map(captionProgress);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThanOrEqual(p[i - 1]);
    expect(p.some((v) => v > 0 && v < 1)).toBe(true);
  });
});
