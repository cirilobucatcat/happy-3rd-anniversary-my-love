export type RevealInput = {
  /** Document-space top of the Memory's frame (px, untransformed layout position). */
  top: number;
  height: number;
  scrollY: number;
  viewportHeight: number;
  side: "left" | "right";
};

export type RevealState = { opacity: number; x: number; y: number; rotate: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

/**
 * How far a Memory has arrived. It starts hidden as its frame rises into the bottom of the
 * viewport, and is settled by the time the frame is about 30% from the top.
 * Only transform and opacity values come out of this.
 */
export function revealState({ top, height, scrollY, viewportHeight: vh, side }: RevealInput): RevealState {
  const arrived = easeOut(clamp01((scrollY + vh - top) / (vh * 0.7)));
  const outward = side === "left" ? -1 : 1;
  // After arriving, keep a gentle upward drift as it passes (parallax).
  const passing = (top + height / 2 - scrollY - vh / 2) / vh;
  return {
    opacity: arrived,
    x: (1 - arrived) * 48 * outward,
    y: (1 - arrived) * 90 + passing * -28,
    rotate: (1 - arrived) * 7 * outward,
  };
}

/** A small fixed tilt per Memory, between about -2.7 and +2.7 degrees. */
export function baseTilt(index: number): number {
  return (((index * 37) % 7) - 3) * 0.9;
}
