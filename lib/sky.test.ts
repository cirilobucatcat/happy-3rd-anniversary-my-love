import { describe, expect, it } from "vitest";
import { cloudTint, skyLayers, stackedOpacities } from "@/lib/sky";

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
