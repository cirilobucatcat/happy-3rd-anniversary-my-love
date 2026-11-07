import { describe, expect, it } from "vitest";
import { skyLayers } from "@/lib/sky";

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
