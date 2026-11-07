/**
 * Where a Memory sits in the 3D world. A settled Memory is on one plane (`MEMORY_Z`), nearer the camera than every
 * Cloud; while it pops out it travels back and forth between `HIDDEN_Z` (behind its Cloud) and that plane.
 * Sizes are worked out from what the camera sees at that depth, so a Memory takes the same share of the screen
 * whatever the viewport: about 70% of the width on a phone and 40% on a laptop, usually alternating left and right
 * (`placeMemories` may swap a side or nudge a Memory up or down to keep the Flyers off its Caption).
 */
import { ARRIVE_END, LEAVE_START } from "@/lib/pop-out";
import { CAMERA, PORTRAIT_BELOW, visibleHalf, type FittedRoute } from "@/lib/route";
import type { Span } from "@/lib/timeline";

/** Depth of a settled Memory. Every Cloud puff stays behind it. */
export const MEMORY_Z = 2.5;
/** Depth of a Memory hiding behind its Cloud (just before it pops out). */
export const HIDDEN_Z = 0;


/** Frame plus cream mat, each side, as a share of the Memory's outer width. */
export const FRAME_SHARE = 0.062;
export const MAT_SHARE = 0.022;
/** Room kept under the frame for the Caption (up to two lines), as a share of the outer width. */
export const CAPTION_SHARE = 0.34;

export type Slot = {
  side: "left" | "right";
  /** Centre of the frame. */
  x: number;
  y: number;
  z: number;
  /** Outer size of the frame (photo, mat and frame together). */
  width: number;
  height: number;
  /** Height reserved under the frame for the Caption. */
  captionHeight: number;
};

/** The photo's size inside a frame of this outer width. */
export function photoSize(outerWidth: number, ratio: number) {
  const width = outerWidth * (1 - 2 * (FRAME_SHARE + MAT_SHARE));
  return { width, height: width / ratio };
}

/** Depth of a Memory for a given `forward` (see lib/pop-out.ts): 0 behind its Cloud, 1 in its place. */
export const memoryDepth = (forward: number) => HIDDEN_Z + (MEMORY_Z - HIDDEN_Z) * forward;

export function memorySlot(aspect: number, ratio: number, side: "left" | "right"): Slot {
  const half = visibleHalf(aspect, MEMORY_Z);
  const phone = aspect < PORTRAIT_BELOW;
  // Phones: 70% of the width. Squarer screens (a tablet held upright) are wide enough to give the Flyers room beside it.
  let width = (phone ? (aspect < 0.7 ? 0.7 : 0.52) : 0.4) * 2 * half.width;

  // The photo's shape can make a Memory tall; keep it, and its Caption, within about 78% of the height.
  const inset = 2 * (FRAME_SHARE + MAT_SHARE);
  const tall = (w: number) => (w * (1 - inset)) / ratio + w * inset + w * CAPTION_SHARE;
  const limit = 0.78 * 2 * half.height;
  if (tall(width) > limit) width *= limit / tall(width);

  const height = (width * (1 - inset)) / ratio + width * inset;
  const captionHeight = width * CAPTION_SHARE;
  const edge = phone ? 0.04 : 0.12; // gap to the screen edge, as a share of the width
  const outward = half.width - 2 * half.width * edge - width / 2;
  return {
    side,
    x: side === "left" ? -outward : outward,
    // Frame and Caption are centred as one block, a touch above the middle of the screen; the frame is the top of it.
    y: 0.03 * 2 * half.height + captionHeight / 2,
    z: MEMORY_Z,
    width,
    height,
    captionHeight,
  };
}

/* ---------- Keeping the Flyers off the Captions ---------- */

export type PlaceMemoriesInput = {
  aspect: number;
  /** Each Memory's photo shape and preferred side (they alternate left and right). */
  memories: readonly { ratio: number; side: "left" | "right" }[];
  route: FittedRoute;
  /** Each Memory's stretch of scroll, from the timeline. */
  spans: readonly Span[];
};

/** Share of the view's half-height a Memory may be nudged up or down. */
const SHIFTS = Array.from({ length: 33 }, (_, i) => (i - 16) * 0.04); // -0.64 to +0.64 in small steps

/**
 * The Flyers are drawn in front of every Memory, and while one Memory is being read they stay in roughly one part
 * of the Sky. So each Memory takes the side and height where its Caption is least covered by them: the side it
 * would alternate to, and the middle of the screen, win unless the Flyers are in the way.
 */
export function placeMemories({ aspect, memories, route, spans }: PlaceMemoriesInput): Slot[] {
  const half = visibleHalf(aspect, MEMORY_Z);
  const distance = CAMERA.distance - MEMORY_Z;
  const reach = 0.55 * route.flyerHeight;

  return memories.map((memory, i) => {
    // Where the Flyers are while this Memory is on screen, in the same units as the Memory (screen shares of `distance`).
    const flyers: { x: number; y: number; r: number; weight: number }[] = [];
    for (let k = 0; k <= 36; k++) {
      const phase = 0.08 + (0.9 * k) / 36;
      const pose = route.poseAt(spans[i].from + phase * (spans[i].to - spans[i].from));
      const d = CAMERA.distance - pose.z;
      const settled = phase >= ARRIVE_END && phase <= LEAVE_START;
      flyers.push({ x: pose.x / d, y: pose.y / d, r: reach / d, weight: settled ? 1 : 0.4 });
    }
    const covered = (x0: number, x1: number, y0: number, y1: number) =>
      flyers.reduce(
        (sum, f) => sum + (f.x + f.r > x0 / distance && f.x - f.r < x1 / distance && f.y + f.r > y0 / distance && f.y - f.r < y1 / distance ? f.weight : 0),
        0,
      );

    const usual = memorySlot(aspect, memory.ratio, memory.side);
    let best: { slot: Slot; score: number } | null = null;
    for (const side of [memory.side, memory.side === "left" ? "right" : "left"] as const) {
      const base = memorySlot(aspect, memory.ratio, side);
      for (const shift of SHIFTS) {
        const y = base.y + shift * half.height;
        const top = y + base.height / 2;
        const bottom = y - base.height / 2 - base.captionHeight;
        if (top > 0.97 * half.height || bottom < -0.97 * half.height) continue;
        const x0 = base.x - base.width / 2;
        const x1 = base.x + base.width / 2;
        const caption = covered(x0, x1, bottom, y - base.height / 2);
        const frame = covered(x0, x1, y - base.height / 2, top);
        // Strong dislike of a covered Caption, mild of a covered frame; a gentle pull toward the usual side and height.
        const score = 3 * caption + 0.3 * frame + (side === memory.side ? 0 : 0.6) + Math.abs(shift) * 2;
        if (!best || score < best.score) best = { slot: { ...base, y }, score };
      }
    }
    return best ? best.slot : usual;
  });
}
