import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from "three";
import { PINYON } from "@/lib/fonts/pinyon";
import { createFrameGeometry, frameHalfDepth } from "@/lib/frame";
import { FRAME_SHARE, photoSize, type Slot } from "@/lib/memory-layout";
import { baseTilt } from "@/lib/pop-out";
import { layoutText, partialPoints, strokeProgress, type TextStrokes } from "@/lib/write-on";

/** Deep rose-pink, the Memory frame (see ADR 0001 and the spec). Black stays on the Flyers and the handwriting. */
export const FRAME_COLOR = 0xe0457b;
const MAT_COLOR = 0xfff1de;
const PLACEHOLDER_COLOR = 0xf3c5d6;
const INK = "#0a0a0a";

/** The handwritten line's canvas is this many pixels wide, however big the Memory is on screen. */
const LINE_PX = 640;
/** Type sizes to try, as a share of the Memory's width, largest first; the first that fits its room in two lines or fewer wins. */
const LINE_EM_SHARES = [0.16, 0.145, 0.13, 0.118, 0.108] as const;
/** Distance between baselines, as laid out by `layoutText` (its default), so lines can be counted. */
const LINE_STEP = 0.95;

let sharedPen: HTMLCanvasElement | null = null;
/**
 * A scratch canvas for the pen path of the line being written. Every card shares this one (a card redraws its line
 * synchronously, one at a time), so 39 Memories do not each hold a spare canvas. Resizing a canvas clears it.
 */
function penCanvas(width: number, height: number): HTMLCanvasElement {
  sharedPen ??= document.createElement("canvas");
  if (sharedPen.width !== width) sharedPen.width = width;
  if (sharedPen.height !== height) sharedPen.height = height;
  return sharedPen;
}

export type MemoryCard = {
  /** Carries the Memory's slot position, Pop-out depth, scale and tilt; the stage sets these every frame. */
  readonly root: Group;
  readonly index: number;
  /** Sizes everything for a slot and photo shape; call again when the screen is resized. */
  layout(slot: Slot, ratio: number): void;
  /** Puts a loaded photo in the frame, or goes back to the plain placeholder when given null. */
  setPhoto(texture: Texture | null): void;
  /** How much of the handwritten line is written, 0 to 1. Redraws only when it changes. */
  setLineProgress(progress: number): void;
  dispose(): void;
};

/**
 * One Memory: the frame, the mat, the photo and the handwritten line under it. The line is a How we met Caption or a
 * Year's Month label; either way it is just text that writes itself on (the Write-on).
 */
export function createMemoryCard(options: { index: number; line: string }): MemoryCard {
  const { index, line } = options;
  const root = new Group();
  root.name = `memory-${index}`;

  const frameMaterial = new MeshPhysicalMaterial({
    color: FRAME_COLOR,
    roughness: 0.42,
    metalness: 0.05,
    clearcoat: 0.75,
    clearcoatRoughness: 0.22,
  });
  const matMaterial = new MeshBasicMaterial({ color: MAT_COLOR });
  const photoMaterial = new MeshBasicMaterial({ color: PLACEHOLDER_COLOR, toneMapped: false });

  const frame = new Mesh(undefined, frameMaterial);
  const mat = new Mesh(undefined, matMaterial);
  const photo = new Mesh(undefined, photoMaterial);
  root.add(frame, mat, photo);

  // The handwritten line: strokes drawn into a transparent canvas texture on a plane under the frame.
  const canvas = document.createElement("canvas");
  canvas.width = LINE_PX;
  canvas.height = LINE_PX / 4;
  const lineTexture = new CanvasTexture(canvas);
  lineTexture.colorSpace = SRGBColorSpace;
  const lineMaterial = new MeshBasicMaterial({ map: lineTexture, transparent: true, depthWrite: false, toneMapped: false });
  const linePlane = new Mesh(undefined, lineMaterial);
  root.add(linePlane);

  let ratio = 0.8;
  let text: TextStrokes | null = null;
  /** The letters' outlines as canvas paths, built once per layout (not on every redraw while writing). */
  let glyphPaths: Path2D[] = [];
  let emPx = 0;
  let padPx = 0;
  let written = -1;
  let wanted = 0;
  let disposed = false;
  let photoTexture: Texture | null = null;

  const lineCount = (laid: TextStrokes) =>
    laid.height === 0 ? 0 : Math.round((laid.height - (PINYON.ascent - PINYON.descent)) / (LINE_STEP * PINYON.unitsPerEm)) + 1;

  /**
   * Paints the line: the real filled letters, kept only where the pen path has been. Draw all the letters in ink,
   * then keep only what lies under the (wide, invisible) pen strokes written so far.
   *
   * The pen strokes are drawn on a separate scratch canvas and applied in ONE `destination-in` draw. Applying them
   * one by one straight onto the letters would not work: that mode clears everything outside the shape being drawn,
   * so two separate strokes would leave only the place where they overlap, which is nothing.
   */
  const redrawLine = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !text) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = emPx / text.unitsPerEm;
    const reveal = strokeProgress(
      text.strokes.map((s) => s.length),
      wanted,
    );
    if (wanted <= 0) {
      written = wanted;
      lineTexture.needsUpdate = true;
      return;
    }
    ctx.save();
    ctx.fillStyle = INK;
    text.glyphs.forEach((g, gi) => {
      ctx.save();
      ctx.translate(padPx + g.x * scale, padPx + g.y * scale);
      ctx.scale(scale, -scale);
      ctx.fill(glyphPaths[gi]);
      ctx.restore();
    });
    if (wanted < 1) {
      const pen = penCanvas(canvas.width, canvas.height).getContext("2d");
      if (pen) {
        pen.clearRect(0, 0, canvas.width, canvas.height);
        pen.strokeStyle = "#000";
        pen.lineCap = "round";
        pen.lineJoin = "round";
        text.strokes.forEach((stroke, i) => {
          const pts = partialPoints(stroke, reveal[i]);
          if (pts.length < 2) return;
          pen.lineWidth = stroke.width * scale;
          pen.beginPath();
          pen.moveTo(padPx + pts[0] * scale, padPx + pts[1] * scale);
          for (let k = 2; k < pts.length; k += 2) pen.lineTo(padPx + pts[k] * scale, padPx + pts[k + 1] * scale);
          if (pts.length === 2) pen.lineTo(padPx + pts[0] * scale + 0.01, padPx + pts[1] * scale);
          pen.stroke();
        });
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(pen.canvas, 0, 0);
      }
    }
    ctx.restore();
    written = wanted;
    lineTexture.needsUpdate = true;
  };

  const setPhotoCrop = (tex: Texture) => {
    // Cover-fit: crop the photo, never stretch it, if its own shape differs from the frame's opening.
    const image = tex.image as { width?: number; height?: number } | undefined;
    const imageRatio = image?.width && image?.height ? image.width / image.height : ratio;
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    if (imageRatio > ratio) {
      tex.repeat.x = ratio / imageRatio;
      tex.offset.x = (1 - tex.repeat.x) / 2;
    } else if (imageRatio < ratio) {
      tex.repeat.y = imageRatio / ratio;
      tex.offset.y = (1 - tex.repeat.y) / 2;
    }
  };

  const applyPhoto = () => {
    photoMaterial.map = photoTexture;
    photoMaterial.color.set(photoTexture ? 0xffffff : PLACEHOLDER_COLOR);
    photoMaterial.needsUpdate = true;
    if (photoTexture) {
      photoTexture.colorSpace = SRGBColorSpace;
      setPhotoCrop(photoTexture);
    }
  };

  const card: MemoryCard = {
    root,
    index,

    layout(slot, nextRatio) {
      ratio = nextRatio;
      const outerW = slot.width;
      const outerH = slot.height;
      const photoDims = photoSize(outerW, ratio);
      const openW = outerW * (1 - 2 * FRAME_SHARE);
      const openH = outerH - outerW * 2 * FRAME_SHARE;

      frame.geometry.dispose();
      frame.geometry = createFrameGeometry(outerW, outerH, openW, openH);
      const back = frameHalfDepth(outerW) * 0.6;
      mat.geometry.dispose();
      mat.geometry = new PlaneGeometry(openW, openH);
      mat.position.z = -back;
      photo.geometry.dispose();
      photo.geometry = new PlaneGeometry(photoDims.width, photoDims.height);
      photo.position.z = -back + 0.002;
      if (photoTexture) setPhotoCrop(photoTexture);

      // The line: fit the largest type that takes two lines or fewer in the room the slot keeps under the frame (a
      // Month label is one short line, so its room is smaller than a Caption's).
      linePlane.geometry.dispose();
      linePlane.geometry = new PlaneGeometry(outerW, slot.lineHeight);
      linePlane.position.set(0, -outerH / 2 - slot.lineHeight / 2, frameHalfDepth(outerW) * 0.5);
      canvas.height = Math.max(8, Math.round((LINE_PX * slot.lineHeight) / outerW));
      padPx = LINE_PX * 0.03;
      text = null;
      for (const share of LINE_EM_SHARES) {
        const em = LINE_PX * share;
        const laid = layoutText(line, PINYON, { maxWidth: ((LINE_PX - 2 * padPx) / em) * PINYON.unitsPerEm });
        text = laid;
        emPx = em;
        if (lineCount(laid) <= 2 && (laid.height / PINYON.unitsPerEm) * em <= canvas.height - 2 * padPx) break;
      }
      // Two lines: narrow the wrap while it stays two lines, so the words split evenly instead of leaving one orphaned.
      if (text && lineCount(text) === 2) {
        const full = ((LINE_PX - 2 * padPx) / emPx) * PINYON.unitsPerEm;
        for (let share = 0.9; share >= 0.5; share -= 0.05) {
          const narrower = layoutText(line, PINYON, { maxWidth: full * share });
          if (lineCount(narrower) > 2) break;
          text = narrower;
        }
      }
      glyphPaths = text && typeof Path2D !== "undefined" ? text.glyphs.map((g) => new Path2D(g.d)) : [];
      redrawLine();

      root.position.set(slot.x, slot.y, slot.z);
      root.rotation.z = (baseTilt(index) * Math.PI) / 180;
    },

    setPhoto(texture) {
      if (photoTexture === texture) return;
      photoTexture = texture;
      applyPhoto();
    },

    setLineProgress(progress) {
      wanted = Math.min(1, Math.max(0, progress));
      if (wanted !== written) redrawLine();
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of [frame, mat, photo, linePlane]) mesh.geometry.dispose();
      frameMaterial.dispose();
      matMaterial.dispose();
      photoMaterial.dispose();
      lineMaterial.dispose();
      lineTexture.dispose();
      // The photo texture itself belongs to the texture pool, which disposes it.
    },
  };
  return card;
}
