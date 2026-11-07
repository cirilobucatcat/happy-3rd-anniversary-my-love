/**
 * Pop-out: how a Memory arrives, stays and leaves, as a pure function of how far through its own stretch of scroll
 * she is (`phase`, 0 to 1). It emerges from behind a Cloud and springs forward with a small bounce, settling from a
 * tilt into place; it stays still in front of every Cloud while it is read; then it slips back behind another Cloud.
 *
 * `forward` is the Memory's depth relative to its Clouds: 0 is hidden behind them, 1 is in its place in front of all
 * of them, and the bounce takes it a little past 1. Because the output depends only on `phase`, scrolling back
 * retraces the same motion in reverse.
 */

/** The Memory has fully arrived (is settled) at this phase. */
export const ARRIVE_END = 0.28;
/** The Memory starts to leave at this phase. */
export const LEAVE_START = 0.74;
/** The Caption starts writing as the Memory emerges. */
const CAPTION_START = 0.06;

export type PopOutStage = "hidden" | "arriving" | "settled" | "leaving";

export type PopOutState = {
  stage: PopOutStage;
  visible: boolean;
  /** True only while the Memory is in front of the Clouds and at rest (the only time it answers a Wiggle). */
  settled: boolean;
  /** 0 behind its Cloud, 1 in place; a little over 1 during the bounce. */
  forward: number;
  /** Extra tilt in radians, positive towards the Memory's outer edge; 0 once settled. */
  tilt: number;
  scale: number;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Ease-out that overshoots by roughly 10 to 15% before settling exactly on 1. */
const easeOutBack = (t: number, s = 1.9) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

const HIDDEN: PopOutState = { stage: "hidden", visible: false, settled: false, forward: 0, tilt: 0, scale: 0.7 };

export function popOut(phase: number): PopOutState {
  if (!(phase > 0) || phase >= 1) return { ...HIDDEN };

  if (phase < ARRIVE_END) {
    const t = phase / ARRIVE_END;
    const forward = easeOutBack(t);
    return {
      stage: "arriving",
      visible: true,
      settled: false,
      forward,
      // A swing that dies away: the frame rocks into place instead of sliding.
      tilt: 0.5 * (1 - t) ** 2 * Math.cos(2 * Math.PI * 1.25 * t),
      scale: 0.7 + 0.3 * forward,
    };
  }

  if (phase <= LEAVE_START) {
    return { stage: "settled", visible: true, settled: true, forward: 1, tilt: 0, scale: 1 };
  }

  const t = (phase - LEAVE_START) / (1 - LEAVE_START);
  const away = smooth(t);
  return { stage: "leaving", visible: true, settled: false, forward: 1 - away, tilt: -0.18 * away, scale: 1 - 0.25 * away };
}

/** How much of the Caption is written (0 to 1): it finishes by the time the Memory has settled, and stays written. */
export function captionProgress(phase: number): number {
  return clamp01((phase - CAPTION_START) / (ARRIVE_END - CAPTION_START));
}

/**
 * The Flyers spring up on the left once the first Chapter title has finished writing: from nothing, with a small
 * bounce past full size, settling at exactly full size. `phase` is how far through the pop she has scrolled (0 to 1).
 * Like everything here it depends only on `phase`, so scrolling back shrinks them away along the same curve.
 */
export function flyersPop(phase: number): { visible: boolean; scale: number } {
  if (!(phase > 0)) return { visible: false, scale: 0 };
  return { visible: true, scale: phase >= 1 ? 1 : easeOutBack(phase, 2.2) };
}

/** A small fixed tilt per Memory, between about -2.7 and +2.7 degrees. */
export function baseTilt(index: number): number {
  return (((index * 37) % 7) - 3) * 0.9;
}
