import {
  CanvasTexture,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PlaneGeometry,
  Ray,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";
import { PINYON } from "@/lib/fonts/pinyon";
import { createFrameGeometry, frameHalfDepth } from "@/lib/frame";
import { FRAME_SHARE, photoSize, type Slot } from "@/lib/memory-layout";
import { baseTilt } from "@/lib/pop-out";
import { createWiggle, kick, nearestCorner, step, type Wiggle } from "@/lib/wiggle";
import { layoutText, partialPoints, strokeProgress, type TextStrokes } from "@/lib/write-on";

/** Deep rose-pink, the Memory frame (see ADR 0001 and the spec). Black stays on the Flyers and the Captions. */
export const FRAME_COLOR = 0xe0457b;
const MAT_COLOR = 0xfff1de;
const PLACEHOLDER_COLOR = 0xf3c5d6;
const INK = "#0a0a0a";

/** The Caption's canvas is this many pixels wide, however big the Memory is on screen. */
const CAPTION_PX = 640;
/** Caption type sizes to try, as a share of the Memory's width, largest first; the first that fits in two lines wins. */
const CAPTION_EM_SHARES = [0.16, 0.145, 0.13, 0.118, 0.108] as const;
/** Distance between baselines, as laid out by `layoutText` (its default), so lines can be counted. */
const LINE_STEP = 0.95;

export type MemoryCard = {
  /** Carries the Memory's slot position, Pop-out depth, scale and tilt; the stage sets these every frame. */
  readonly root: Group;
  readonly index: number;
  readonly wiggle: Wiggle;
  /** Sizes everything for a slot and photo shape; call again when the screen is resized. */
  layout(slot: Slot, ratio: number): void;
  /** Puts a loaded photo in the frame, or goes back to the plain placeholder when given null. */
  setPhoto(texture: Texture | null): void;
  /** How much of the Caption is written, 0 to 1. Redraws only when it changes. */
  setCaptionProgress(progress: number): void;
  /** Starts a Wiggle from the corner nearest the point where `ray` meets the frame; false if it misses the frame. */
  poke(ray: Ray): boolean;
  /** Where `ray` meets the frame, in the frame's own units (origin at its centre), or null. */
  hit(ray: Ray): { x: number; y: number } | null;
  /** Advances the Wiggle spring and applies it. */
  tick(dt: number): void;
  dispose(): void;
};

export function createMemoryCard(options: { index: number; caption: string }): MemoryCard {
  const { index, caption } = options;
  const root = new Group();
  root.name = `memory-${index}`;
  // The Memory swings about a corner: `swing` sits on the pivot, `body` is offset back so the frame stays put at rest.
  const swing = new Group();
  const body = new Group();
  swing.add(body);
  root.add(swing);

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
  body.add(frame, mat, photo);

  // The Caption: strokes drawn into a transparent canvas texture on a plane under the frame.
  const canvas = document.createElement("canvas");
  canvas.width = CAPTION_PX;
  canvas.height = CAPTION_PX / 4;
  const captionTexture = new CanvasTexture(canvas);
  captionTexture.colorSpace = SRGBColorSpace;
  const captionMaterial = new MeshBasicMaterial({ map: captionTexture, transparent: true, depthWrite: false, toneMapped: false });
  const captionPlane = new Mesh(undefined, captionMaterial);
  body.add(captionPlane);

  const wiggle = createWiggle();
  let slot: Slot | null = null;
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
   * Paints the Caption: the real filled letters, kept only where the pen path has been. Draw all the letters in ink,
   * then keep only what lies under the (wide, invisible) pen strokes written so far.
   */
  const redrawCaption = () => {
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
      captionTexture.needsUpdate = true;
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
      ctx.globalCompositeOperation = "destination-in";
      ctx.strokeStyle = "#000";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      text.strokes.forEach((stroke, i) => {
        const pts = partialPoints(stroke, reveal[i]);
        if (pts.length < 2) return;
        ctx.lineWidth = stroke.width * scale;
        ctx.beginPath();
        ctx.moveTo(padPx + pts[0] * scale, padPx + pts[1] * scale);
        for (let k = 2; k < pts.length; k += 2) ctx.lineTo(padPx + pts[k] * scale, padPx + pts[k + 1] * scale);
        if (pts.length === 2) ctx.lineTo(padPx + pts[0] * scale + 0.01, padPx + pts[1] * scale);
        ctx.stroke();
      });
    }
    ctx.restore();
    written = wanted;
    captionTexture.needsUpdate = true;
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
    wiggle,

    layout(nextSlot, nextRatio) {
      slot = nextSlot;
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

      // Caption: fit the largest type that takes two lines or fewer.
      captionPlane.geometry.dispose();
      captionPlane.geometry = new PlaneGeometry(outerW, slot.captionHeight);
      captionPlane.position.set(0, -outerH / 2 - slot.captionHeight / 2, frameHalfDepth(outerW) * 0.5);
      canvas.height = Math.max(8, Math.round((CAPTION_PX * slot.captionHeight) / outerW));
      padPx = CAPTION_PX * 0.03;
      text = null;
      for (const share of CAPTION_EM_SHARES) {
        const em = CAPTION_PX * share;
        const laid = layoutText(caption, PINYON, { maxWidth: ((CAPTION_PX - 2 * padPx) / em) * PINYON.unitsPerEm });
        text = laid;
        emPx = em;
        if (lineCount(laid) <= 2 && (laid.height / PINYON.unitsPerEm) * em <= canvas.height - 2 * padPx) break;
      }
      // Two lines: narrow the wrap while it stays two lines, so the words split evenly instead of leaving one orphaned.
      if (text && lineCount(text) === 2) {
        const full = ((CAPTION_PX - 2 * padPx) / emPx) * PINYON.unitsPerEm;
        for (let share = 0.9; share >= 0.5; share -= 0.05) {
          const narrower = layoutText(caption, PINYON, { maxWidth: full * share });
          if (lineCount(narrower) > 2) break;
          text = narrower;
        }
      }
      glyphPaths = text && typeof Path2D !== "undefined" ? text.glyphs.map((g) => new Path2D(g.d)) : [];
      redrawCaption();

      root.position.set(slot.x, slot.y, slot.z);
      root.rotation.z = (baseTilt(index) * Math.PI) / 180;
    },

    setPhoto(texture) {
      if (photoTexture === texture) return;
      photoTexture = texture;
      applyPhoto();
    },

    setCaptionProgress(progress) {
      wanted = Math.min(1, Math.max(0, progress));
      if (wanted !== written) redrawCaption();
    },

    hit(ray) {
      if (!slot) return null;
      root.updateMatrixWorld(true);
      const local = ray.clone().applyMatrix4(new Matrix4().copy(body.matrixWorld).invert());
      if (Math.abs(local.direction.z) < 1e-6) return null;
      const t = -local.origin.z / local.direction.z;
      if (t < 0) return null;
      const p = new Vector3().copy(local.direction).multiplyScalar(t).add(local.origin);
      if (Math.abs(p.x) > slot.width / 2 || Math.abs(p.y) > slot.height / 2) return null;
      return { x: p.x, y: p.y };
    },

    poke(ray) {
      if (!slot) return false;
      const at = card.hit(ray);
      if (!at) return false;
      kick(wiggle, nearestCorner(at.x, at.y));
      return true;
    },

    tick(dt) {
      if (!slot) return;
      step(wiggle, dt);
      // Pivot on the corner being "held": rotate the swing group there and shift the body back by the same amount.
      const px = (wiggle.corner.sx * slot.width) / 2;
      const py = (wiggle.corner.sy * slot.height) / 2;
      swing.position.set(px, py, 0);
      body.position.set(-px, -py, 0);
      swing.rotation.z = wiggle.angle;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of [frame, mat, photo, captionPlane]) mesh.geometry.dispose();
      frameMaterial.dispose();
      matMaterial.dispose();
      photoMaterial.dispose();
      captionMaterial.dispose();
      captionTexture.dispose();
      // The photo texture itself belongs to the texture pool, which disposes it.
    },
  };
  return card;
}

