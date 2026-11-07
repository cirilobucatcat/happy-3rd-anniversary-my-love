import { ExtrudeGeometry, Path, Shape } from "three";

/** Frame thickness as a share of its outer width. */
const DEPTH_SHARE = 0.032;

/**
 * A picture frame with real thickness: a rounded rectangular ring, extruded and bevelled so its edges catch the light.
 * `outerW` x `outerH` is the finished outer size and `openW` x `openH` the opening it leaves, both in world units.
 * Centred on the origin, facing +z, with its thickness shared evenly either side of z = 0.
 */
export function createFrameGeometry(outerW: number, outerH: number, openW: number, openH: number): ExtrudeGeometry {
  const border = (outerW - openW) / 2;
  const depth = outerW * DEPTH_SHARE;
  const bevelSize = border * 0.32;
  const bevelThickness = depth * 0.45;

  // The bevel grows the outline outward by `bevelSize`, so start that much smaller (and the hole that much bigger).
  const ow = outerW - 2 * bevelSize;
  const oh = outerH - 2 * bevelSize;
  const radius = Math.min(border * 0.55, ow / 4, oh / 4);

  const shape = new Shape();
  shape.moveTo(-ow / 2 + radius, -oh / 2);
  shape.lineTo(ow / 2 - radius, -oh / 2);
  shape.quadraticCurveTo(ow / 2, -oh / 2, ow / 2, -oh / 2 + radius);
  shape.lineTo(ow / 2, oh / 2 - radius);
  shape.quadraticCurveTo(ow / 2, oh / 2, ow / 2 - radius, oh / 2);
  shape.lineTo(-ow / 2 + radius, oh / 2);
  shape.quadraticCurveTo(-ow / 2, oh / 2, -ow / 2, oh / 2 - radius);
  shape.lineTo(-ow / 2, -oh / 2 + radius);
  shape.quadraticCurveTo(-ow / 2, -oh / 2, -ow / 2 + radius, -oh / 2);

  const hw = openW / 2 + bevelSize;
  const hh = openH / 2 + bevelSize;
  const hole = new Path();
  hole.moveTo(-hw, -hh);
  hole.lineTo(-hw, hh);
  hole.lineTo(hw, hh);
  hole.lineTo(hw, -hh);
  hole.lineTo(-hw, -hh);
  shape.holes.push(hole);

  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness,
    bevelSize,
    bevelSegments: 3,
    curveSegments: 5,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** Half the thickness of the frame including its bevels; photo and mat sit just behind the front face. */
export const frameHalfDepth = (outerW: number) => outerW * DEPTH_SHARE * (0.5 + 0.45);
