import type { Span } from "@/lib/timeline";

export type SkyLayers = {
  dawn: number;
  day: number;
  sunset: number;
  rose: number;
  stars: number;
};

export type Mood = "dawn" | "day" | "sunset" | "rose";

/** A scroll progress at which the Sky is wholly one mood. Between two stops it blends from one to the other. */
export type SkyStop = { progress: number; mood: Mood };

/** The old fixed stops, used when no timeline is given: dawn, day at 0.35, sunset at 0.7, rose at the end. */
export const DEFAULT_SKY_STOPS: readonly SkyStop[] = [
  { progress: 0, mood: "dawn" },
  { progress: 0.35, mood: "day" },
  { progress: 0.7, mood: "sunset" },
  { progress: 1, mood: "rose" },
];

/**
 * The Sky follows the Chapters (not fixed scroll positions): dawn pink through How we met, bright day through Year 1
 * (each change blends inside the Cloud pass between them, where the Clouds hide it), day turning to sunset over the Sea
 * through Year 2, and sunset deepening to rose through Year 3 and the Letter.
 */
export function skyStopsOf(timeline: { passes: readonly Span[] }): readonly SkyStop[] {
  const [toYear1, toYear2, toYear3] = timeline.passes;
  if (!toYear1 || !toYear2 || !toYear3) return DEFAULT_SKY_STOPS;
  return [
    { progress: 0, mood: "dawn" },
    { progress: toYear1.from, mood: "dawn" },
    { progress: toYear1.to, mood: "day" },
    { progress: toYear2.to, mood: "day" },
    { progress: toYear3.from, mood: "sunset" },
    { progress: toYear3.to, mood: "sunset" },
    { progress: 1, mood: "rose" },
  ];
}

const STARS_START = 0.8;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Maps scroll progress to the opacity of each Sky layer. Only opacity ever changes. */
export function skyLayers(progress: number, stops: readonly SkyStop[] = DEFAULT_SKY_STOPS): SkyLayers {
  const p = clamp01(progress);
  const out: SkyLayers = { dawn: 0, day: 0, sunset: 0, rose: 0, stars: clamp01((p - STARS_START) / (1 - STARS_START)) };
  if (p <= stops[0].progress) {
    out[stops[0].mood] = 1;
    return out;
  }
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (p <= b.progress) {
      const t = b.progress === a.progress ? 1 : (p - a.progress) / (b.progress - a.progress);
      out[a.mood] += 1 - t;
      out[b.mood] += t;
      return out;
    }
  }
  out[stops[stops.length - 1].mood] = 1;
  return out;
}

/**
 * The layers are stacked in the DOM (dawn at the bottom, rose on top), so showing each at its
 * own `skyLayers` weight would let the page background bleed through mid-fade. This converts the
 * weights into per-layer opacities that composite to exactly the weighted blend: dawn stays
 * fully opaque and each later layer fades in over everything beneath it.
 */
export function stackedOpacities(w: SkyLayers): Pick<SkyLayers, "dawn" | "day" | "sunset" | "rose"> {
  const dawn = 1;
  const day = w.day / (w.dawn + w.day || 1);
  const sunset = w.sunset / (w.dawn + w.day + w.sunset || 1);
  const rose = w.rose / (w.dawn + w.day + w.sunset + w.rose || 1);
  return { dawn, day, sunset, rose };
}

/** Cloud colour at each Sky stage, as 0..1 RGB: white-pink dawn, bright white day, orange-pink sunset, rose at the Letter. */
const CLOUD_TINTS = {
  dawn: [1, 0.9, 0.95],
  day: [1, 1, 1],
  sunset: [1, 0.78, 0.68],
  rose: [1, 0.74, 0.84],
} as const;

/** The tint the Clouds take at this scroll progress: the stage colours blended by the Sky's own layer weights. */
export function cloudTint(progress: number, stops: readonly SkyStop[] = DEFAULT_SKY_STOPS): [number, number, number] {
  const w = skyLayers(progress, stops);
  const sum = w.dawn + w.day + w.sunset + w.rose || 1;
  const channel = (i: 0 | 1 | 2) =>
    (w.dawn * CLOUD_TINTS.dawn[i] + w.day * CLOUD_TINTS.day[i] + w.sunset * CLOUD_TINTS.sunset[i] + w.rose * CLOUD_TINTS.rose[i]) / sum;
  return [channel(0), channel(1), channel(2)];
}
