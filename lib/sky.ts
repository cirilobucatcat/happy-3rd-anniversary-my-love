export type SkyLayers = {
  dawn: number;
  day: number;
  sunset: number;
  rose: number;
  stars: number;
};

/** Progress (0..1) at which each gradient layer is fully visible. */
export const SKY_STOPS = { dawn: 0, day: 0.35, sunset: 0.7, rose: 1 } as const;

const STARS_START = 0.8;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Opacity of one layer: 1 at its own stop, falling linearly to 0 at the neighbouring stops. */
function tent(p: number, prev: number | null, own: number, next: number | null): number {
  if (p <= own) return prev === null ? 1 : clamp01((p - prev) / (own - prev));
  return next === null ? 1 : clamp01((next - p) / (next - own));
}

/** Maps scroll progress to the opacity of each Sky layer. Only opacity ever changes. */
export function skyLayers(progress: number): SkyLayers {
  const p = clamp01(progress);
  const { dawn, day, sunset, rose } = SKY_STOPS;
  return {
    dawn: tent(p, null, dawn, day),
    day: tent(p, dawn, day, sunset),
    sunset: tent(p, day, sunset, rose),
    rose: tent(p, sunset, rose, null),
    stars: clamp01((p - STARS_START) / (1 - STARS_START)),
  };
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
export function cloudTint(progress: number): [number, number, number] {
  const w = skyLayers(progress);
  const sum = w.dawn + w.day + w.sunset + w.rose || 1;
  const channel = (i: 0 | 1 | 2) =>
    (w.dawn * CLOUD_TINTS.dawn[i] + w.day * CLOUD_TINTS.day[i] + w.sunset * CLOUD_TINTS.sunset[i] + w.rose * CLOUD_TINTS.rose[i]) / sum;
  return [channel(0), channel(1), channel(2)];
}
