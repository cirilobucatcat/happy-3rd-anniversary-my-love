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
