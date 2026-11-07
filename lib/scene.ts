import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Memory } from "@/content/memories";
import { createCloudLayer, type CloudLayer } from "@/lib/cloud-layer";
import { placeClouds } from "@/lib/clouds";
import { drawOrder, type Item } from "@/lib/draw-order";
import { RIM_COLOR, disposeObject, loadCouple as defaultLoadCouple, type LoadedCouple } from "@/lib/flyers";
import { createMemoryCard, type MemoryCard } from "@/lib/memory-card";
import { memoryDepth, placeMemories, type Slot } from "@/lib/memory-layout";
import { baseTilt, captionProgress, flyersPop, popOut } from "@/lib/pop-out";
import { CAMERA, routeForAspect, type FittedRoute } from "@/lib/route";
import { cloudTint } from "@/lib/sky";
import { createTexturePool } from "@/lib/textures";
import { phaseOf, scheduleOf, type Timeline } from "@/lib/timeline";

/** The slice of WebGLRenderer we use, so tests can supply a fake. */
export type RendererLike = Pick<
  WebGLRenderer,
  "domElement" | "setPixelRatio" | "setSize" | "render" | "dispose" | "forceContextLoss" | "clear" | "clearDepth" | "autoClear"
>;

export type StageDeps = {
  createRenderer?: (canvas: HTMLCanvasElement) => RendererLike;
  loadCouple?: () => Promise<LoadedCouple>;
  /** Loads one Memory's photo as a texture. */
  loadPhoto?: (src: string) => Promise<Texture>;
};

export type StageOptions = {
  memories: readonly Memory[];
  timeline: Timeline;
};

export type Stage = {
  /** The rig that carries the Flyers along the path; its position and rotation follow scroll progress. */
  readonly flyers: Object3D;
  /** One object per Memory, in order (hidden unless that Memory is on screen). */
  readonly memories: readonly Object3D[];
  /** Resolves once the couple (placeholder or couple.glb) has loaded, or been discarded after disposal. */
  readonly ready: Promise<void>;
  /** Photo textures held right now (held or loading), for the debug overlay and tests. */
  readonly textures: number;
  resize(width: number, height: number): void;
  update(progress: number, dt: number): void;
  /** The pointer moved to this spot (normalised device coordinates, -1 to 1, y up). Hovering a settled Memory wiggles it. */
  pointerMove(x: number, y: number): void;
  /** A tap at this spot. Wiggles a settled Memory if it hit one; does nothing else. */
  tap(x: number, y: number): void;
  dispose(): void;
};

const MAX_PIXEL_RATIO = 2;
const TRAIL_POINTS = 56;
/** How far back along the path the trail reaches, as a share of the whole scroll. */
const TRAIL_SPAN = 0.075;
/** The camera swings this far each way (radians, about 4 degrees) across the whole scroll, for parallax. */
const CAMERA_DRIFT = 0.07;
/** A photo is loaded this far ahead of its Memory (scroll progress, about 1.7 screens) and kept this far after. */
const PHOTO_AHEAD = 0.06;
const PHOTO_BEHIND = 0.01;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const defaultRenderer = (canvas: HTMLCanvasElement): RendererLike => {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  return renderer;
};

const defaultLoadPhoto = async (src: string): Promise<Texture> => {
  const texture = await new TextureLoader().loadAsync(src);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/**
 * The transparent WebGL layer with the Sky: Clouds at several depths, the Memories as pink-framed planes, and the
 * Flyers with their trail. Rendering is driven by the caller (the shared ticker); this module never starts its own
 * animation loop. Returns null if WebGL is unavailable.
 */
export function createStage(container: HTMLElement, options: StageOptions, deps: StageDeps = {}): Stage | null {
  const { createRenderer = defaultRenderer, loadCouple = defaultLoadCouple, loadPhoto = defaultLoadPhoto } = deps;
  const { memories, timeline } = options;

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  let renderer: RendererLike;
  try {
    renderer = createRenderer(canvas);
  } catch {
    canvas.remove();
    return null;
  }
  // Each layer is drawn on top of the last with its own depth buffer (see lib/draw-order.ts), so we clear by hand.
  renderer.autoClear = false;

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA.distance);

  // The pink rim for the Flyers comes from their material's Fresnel term; the key light gives the frames their sheen.
  scene.add(new AmbientLight(0xffffff, 2.0));
  const back = new DirectionalLight(RIM_COLOR, 2.2);
  back.position.set(-3, 3, -5);
  scene.add(back);
  const key = new DirectionalLight(0xffffff, 1.8);
  key.position.set(-3, 4, 7);
  scene.add(key);

  const rig = new Group();
  rig.rotation.order = "YZX";
  rig.visible = false;
  scene.add(rig);

  const trail = createTrail();
  trail.mesh.visible = false;
  scene.add(trail.mesh);

  const schedule = scheduleOf(timeline);
  let route: FittedRoute = routeForAspect(1, schedule);
  let slots: Slot[] = [];
  let clouds: CloudLayer | null = null;
  let layoutAspect = 0;

  const cards: MemoryCard[] = memories.map((m, i) => {
    const card = createMemoryCard({ index: i, caption: m.caption });
    card.root.visible = false;
    scene.add(card.root);
    return card;
  });
  const photos = createTexturePool({ load: (i) => loadPhoto(memories[i].src), max: 4 });
  let wantedKey = "";

  let model: Object3D | null = null;
  let flyersLoaded = false;
  let disposed = false;
  let clock = 0;
  let lastProgress = 0;

  /** Everything that depends on the screen's shape: the route, the Memory slots, and where the Clouds go. */
  const relayout = (aspect: number) => {
    layoutAspect = aspect;
    route = routeForAspect(aspect, schedule);
    slots = placeMemories({ aspect, memories, route, spans: timeline.memories });
    cards.forEach((card, i) => card.layout(slots[i], memories[i].ratio));
    clouds?.dispose();
    clouds = createCloudLayer(scene, placeClouds({ aspect, route, timeline, slots }));
  };
  relayout(1);

  const ready = loadCouple()
    .then(({ model: loaded }) => {
      if (disposed) {
        disposeObject(loaded);
        return;
      }
      model = loaded;
      rig.add(loaded);
      flyersLoaded = true;
    })
    .catch(() => {
      /* loadCouple never rejects in practice; if it did, we simply have no Flyers. */
    });

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let hovered = -1;
  /** Where the mouse last was, if it has moved over the page, so a Memory settling under it can still be hovered. */
  let pointerAt: { x: number; y: number } | null = null;

  /** The nearest settled Memory under the pointer, if any. Arriving and leaving Memories never answer. */
  const settledUnder = (x: number, y: number): MemoryCard | null => {
    pointer.set(x, y);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    let best: MemoryCard | null = null;
    let bestZ = -Infinity;
    cards.forEach((card, i) => {
      const s = popOut(phaseOf(timeline.memories[i], lastProgress));
      if (!s.settled) return;
      if (card.hit(raycaster.ray) && card.root.position.z > bestZ) {
        best = card;
        bestZ = card.root.position.z;
      }
    });
    return best;
  };

  /** Wiggles a settled Memory when the pointer arrives on it (not continuously while it rests there). */
  const hover = (x: number, y: number) => {
    const card = settledUnder(x, y);
    const index = card ? card.index : -1;
    if (card && index !== hovered) card.poke(raycaster.ray);
    hovered = index;
  };

  const draw = (progress: number, dt: number) => {
    // Camera: fixed in place, drifting a few degrees round the middle of the Sky as she scrolls, so Clouds at
    // different depths slide past one another.
    const angle = lerp(-CAMERA_DRIFT, CAMERA_DRIFT, progress);
    camera.position.set(Math.sin(angle) * CAMERA.distance, 0, Math.cos(angle) * CAMERA.distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    // Flyers.
    const p = route.poseAt(progress);
    rig.position.set(p.x, p.y, p.z);
    rig.rotation.set(p.roll, p.yaw, p.pitch);
    // The Flyers spring up on the left once the first title has finished writing (and shrink away if she scrolls back).
    const pop = flyersPop(phaseOf(timeline.flyersPop, progress));
    rig.scale.setScalar(route.flyerHeight * pop.scale);
    // A gentle bob so they feel alive between scrolls.
    if (model) model.position.y = Math.sin(clock * 2.1) * 0.025;
    trail.update(route, progress);

    // Memories: Pop-out pose, Caption, Wiggle, and which photos should be in memory.
    const ahead: { i: number; distance: number }[] = [];
    const popped: boolean[] = [];
    cards.forEach((card, i) => {
      const span = timeline.memories[i];
      const phase = phaseOf(span, progress);
      const s = popOut(phase);
      popped[i] = s.visible;
      const slot = slots[i];
      const outward = slot.side === "left" ? -1 : 1;
      card.root.position.set(slot.x, slot.y, memoryDepth(s.forward));
      card.root.scale.setScalar(s.scale);
      card.root.rotation.z = (baseTilt(i) * Math.PI) / 180 + s.tilt * outward;
      card.setCaptionProgress(captionProgress(phase));
      card.tick(dt);
      if (progress >= span.from - PHOTO_AHEAD && progress <= span.to + PHOTO_BEHIND) {
        ahead.push({ i, distance: Math.abs((span.from + span.to) / 2 - progress) });
      }
    });
    const wanted = ahead.sort((a, b) => a.distance - b.distance).map((a) => a.i);
    const wantedNow = wanted.join(",");
    if (wantedNow !== wantedKey) {
      wantedKey = wantedNow;
      photos.want(wanted);
    }
    cards.forEach((card, i) => card.setPhoto(photos.get(i)));

    // Draw: sort Clouds, Memories and the Flyers (see lib/draw-order.ts), then paint layer by layer.
    const puffs = clouds ? clouds.update(progress, cloudTint(progress)) : [];
    const items: Item[] = puffs.map((q) => ({ kind: "puff", id: q.id, z: q.z }));
    cards.forEach((card, i) => {
      if (popped[i]) items.push({ kind: "memory", id: i, z: card.root.position.z });
    });
    if (flyersLoaded && pop.visible) items.push({ kind: "flyers", z: rig.position.z });

    // A Memory that settles under a mouse that is not moving is hovered all the same.
    if (pointerAt) hover(pointerAt.x, pointerAt.y);

    renderer.clear();
    for (const layer of drawOrder(items)) {
      const show = (on: boolean) => {
        if (layer.kind === "puffs") for (const id of layer.ids) clouds!.sprites[id].visible = on;
        else if (layer.kind === "memory") cards[layer.id].root.visible = on;
        else {
          rig.visible = on;
          trail.mesh.visible = on;
        }
      };
      show(true);
      renderer.clearDepth();
      renderer.render(scene, camera);
      show(false);
    }
  };

  return {
    flyers: rig,
    memories: cards.map((c) => c.root),
    ready,

    get textures() {
      return photos.size;
    },

    resize(width, height) {
      if (disposed || width <= 0 || height <= 0) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (Math.abs(camera.aspect - layoutAspect) > 1e-3) relayout(camera.aspect);
      draw(lastProgress, 0); // resizing clears the canvas; redraw now so it never flashes blank
    },

    update(progress, dt) {
      if (disposed) return;
      clock += dt;
      lastProgress = progress;
      draw(progress, dt);
    },

    pointerMove(x, y) {
      if (disposed) return;
      pointerAt = { x, y };
      hover(x, y);
    },

    tap(x, y) {
      if (disposed) return;
      settledUnder(x, y)?.poke(raycaster.ray);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      photos.dispose();
      for (const card of cards) card.dispose();
      clouds?.dispose();
      if (model) disposeObject(model);
      trail.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

/* ---------- Trail: a soft ribbon that fades behind the Flyers ---------- */

function createTrail() {
  const n = TRAIL_POINTS;
  const positions = new Float32Array(n * 2 * 3);
  const colors = new Float32Array(n * 2 * 4);
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(index);
  const material = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  const point = new Vector3();
  const next = new Vector3();
  const side = new Vector3();
  const toCamera = new Vector3(0, 0, 1);

  return {
    mesh,
    update(route: FittedRoute, progress: number) {
      const flyerHeight = route.flyerHeight;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1); // 0 at the Flyers, 1 at the far end of the trail
        const p0 = route.poseAt(Math.max(0, progress - u * TRAIL_SPAN));
        const p1 = route.poseAt(Math.max(0, progress - u * TRAIL_SPAN - 0.002));
        point.set(p0.x, p0.y, p0.z);
        next.set(p1.x, p1.y, p1.z);
        side.crossVectors(point.clone().sub(next), toCamera);
        if (side.lengthSq() < 1e-12) side.set(0, 1, 0);
        side.normalize();
        const half = flyerHeight * 0.1 * (1 - u);
        positions.set([point.x + side.x * half, point.y + side.y * half, point.z + side.z * half], i * 6);
        positions.set([point.x - side.x * half, point.y - side.y * half, point.z - side.z * half], i * 6 + 3);
        const alpha = 0.85 * (1 - u) * (1 - u);
        for (const v of [i * 2, i * 2 + 1]) colors.set([1, 0.3, 0.58, alpha], v * 4);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
