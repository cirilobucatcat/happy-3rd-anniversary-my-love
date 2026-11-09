/**
 * Fly-by: how a Memory appears in Year 2 (and Year 3 for now). The picture hangs still beside the route, upright and
 * facing the camera, lost in a pink haze while the Flyers are far from it, fully clear while they are alongside,
 * and hazy again once they have passed. Nothing bounces or scales in.
 *
 * Everything here depends only on where the Flyers are along the route (the distance to the picture), so scrolling back
 * retraces it exactly. Distances are measured in Flyer heights, so the same rule works on a phone and a laptop.
 */
import type { LineKind } from "@/content/memories";
import type { CameraRig } from "@/lib/camera-rig";
import { FRAME_SHARE, MAT_SHARE, lineShare, type Slot } from "@/lib/memory-layout";
import { CAMERA, PORTRAIT_BELOW, type FittedRoute } from "@/lib/route";

/** The haze, in Flyer heights of route between the Flyers and the picture (positive = the picture is still ahead). */
export const FLY_BY = {
  /** Fully clear while the picture is within this distance, ahead or behind: the Flyers are alongside. */
  clearHalf: 1.0,
  /** Gone into the haze when the picture is this far ahead (just under the 8 heights between two pictures). */
  farAhead: 9,
  /**
   * Gone into the haze when it is this far behind. The camera trails the Flyers by about 6.5 heights, so a picture they
   * have passed reaches the camera about then: it must have faded before it swells up and fills the screen.
   */
  farBehind: 4.5,
} as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * How clear a picture is, 0 (lost in the haze) to 1 (fully clear), given how far ahead of the Flyers it is along the
 * route (`ahead`, in world units; negative once they have passed it) and the Flyers' height.
 */
export function flyByClarity(ahead: number, flyerHeight: number): number {
  const d = ahead / flyerHeight;
  if (Math.abs(d) <= FLY_BY.clearHalf) return 1;
  if (d > 0) return 1 - smooth(clamp01((d - FLY_BY.clearHalf) / (FLY_BY.farAhead - FLY_BY.clearHalf)));
  return 1 - smooth(clamp01((-d - FLY_BY.clearHalf) / (FLY_BY.farBehind - FLY_BY.clearHalf)));
}

/** How much of the Month label is written: it writes on as the picture clears, is complete alongside, and stays written. */
export function labelProgress(ahead: number, flyerHeight: number): number {
  const d = ahead / flyerHeight;
  if (d <= FLY_BY.clearHalf) return 1;
  return smooth(clamp01((FLY_BY.farAhead - d) / (FLY_BY.farAhead - FLY_BY.clearHalf)));
}

/* ---------- Where each picture hangs ---------- */

/** The lowest edge of the picture block (label included) when the Flyers are alongside: just above the Flyers' heads, as a share of half the screen's height. */
const BLOCK_BOTTOM = -0.1;
/** The most of the screen's height a picture and its label may take, as a share of half the height (so it stays in the upper part). */
const BLOCK_MAX = 0.9;

export type FlyByPlacement = {
  /** The frame's centre and size in world units, in the same form as a Pop-out Memory's slot. */
  slot: Slot;
  /** Turn about the vertical axis that makes the picture face the camera. */
  yaw: number;
  /** How far along the route (world units) the Flyers are when they are alongside it. */
  distance: number;
};

export type PlaceFlyBysInput = {
  aspect: number;
  /** The Memories that are Fly-bys, in order (their photo shape and kind of handwritten line). */
  memories: readonly { ratio: number; kind: LineKind }[];
  flyBys: readonly { alongside: number; side: "left" | "right" }[];
  route: FittedRoute;
  camera: CameraRig;
};

/**
 * Places every picture by looking through the camera at the moment the Flyers are alongside it: it is put in the upper
 * left or right of that view, at the same share of the width as a Pop-out Memory (about 70% on a phone, up to 40% on
 * a laptop), with its lowest edge above the Flyers' heads. From there it simply stays where it is in the world.
 */
export function placeFlyBys({ aspect, memories, flyBys, route, camera }: PlaceFlyBysInput): FlyByPlacement[] {
  const tan = Math.tan((CAMERA.fov / 2) * (Math.PI / 180));
  const phone = aspect < PORTRAIT_BELOW;
  const inset = 2 * (FRAME_SHARE + MAT_SHARE);

  return flyBys.map((fly, k) => {
    const { ratio, kind } = memories[k];
    const state = camera.cameraAt(fly.alongside);
    const flyers = route.poseAt(fly.alongside);

    // The camera's own axes: forward, right and up.
    const [px, py, pz] = state.position;
    let fx = state.target[0] - px;
    let fy = state.target[1] - py;
    let fz = state.target[2] - pz;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl;
    fy /= fl;
    fz /= fl;
    let rx = fy * 0 - fz * 1; // forward x world up (0, 1, 0)
    let ry = fz * 0 - fx * 0;
    let rz = fx * 1 - fy * 0;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;

    // The camera tilts into a bank, so the screen's right and up are the world's turned by that much. The picture itself
    // hangs upright, so on a tilted screen its corners lie a little further out than a level one's; allow for that.
    const cos = Math.cos(state.roll);
    const sin = Math.sin(state.roll);
    const sx = [rx * cos + ux * sin, ry * cos + uy * sin, rz * cos + uz * sin]; // screen right
    const sy = [-rx * sin + ux * cos, -ry * sin + uy * cos, -rz * sin + uz * cos]; // screen up

    // How far in front of the camera the Flyers are, and so how much of the world it sees there.
    const depth = (flyers.x - px) * fx + (flyers.y - py) * fy + (flyers.z - pz) * fz;
    const halfH = tan * depth;
    const halfW = halfH * aspect;

    const share = lineShare(kind);
    let width = (phone ? (aspect < 0.7 ? 0.7 : 0.52) : 0.4) * 2 * halfW;
    const block = (w: number) => (w * (1 - inset)) / ratio + w * inset + w * share;
    if (block(width) > BLOCK_MAX * halfH) width *= (BLOCK_MAX * halfH) / block(width);
    const height = (width * (1 - inset)) / ratio + width * inset;
    const lineHeight = width * share;
    const blockHeight = height + lineHeight;

    // Half the screen space the block takes once the tilt is counted.
    const reachX = (width / 2) * Math.abs(cos) + (blockHeight / 2) * Math.abs(sin);
    const reachY = (blockHeight / 2) * Math.abs(cos) + (width / 2) * Math.abs(sin);
    const edge = phone ? 0.04 : 0.12;
    const outward = halfW - 2 * halfW * edge - reachX;
    const across = fly.side === "left" ? -outward : outward;
    // The block's centre; the frame's centre is half the label's height above that.
    const up = BLOCK_BOTTOM * halfH + reachY + lineHeight / 2;

    return {
      slot: {
        side: fly.side,
        x: px + fx * depth + sx[0] * across + sy[0] * up,
        y: py + fy * depth + sx[1] * across + sy[1] * up,
        z: pz + fz * depth + sx[2] * across + sy[2] * up,
        width,
        height,
        lineHeight,
      },
      // Turn the picture to face back along the camera's line of sight (horizontally).
      yaw: Math.atan2(-fx, -fz),
      distance: route.distanceAt(fly.alongside),
    };
  });
}
