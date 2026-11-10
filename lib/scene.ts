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
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Memory } from "@/content/memories";
import { createCameraRig, type CameraRig, type CameraState } from "@/lib/camera-rig";
import { createCloudLayer, type CloudLayer } from "@/lib/cloud-layer";
import { placeClouds } from "@/lib/clouds";
import { watchContext } from "@/lib/context-watch";
import { drawOrder, type Item } from "@/lib/draw-order";
import { FLY_BY, FLY_BY_SKY, flyByClarity, labelProgress, placeFlyBys, type FlyByPlacement } from "@/lib/fly-by";
import { RIM_COLOR, disposeObject, loadCouple as defaultLoadCouple, type LoadedCouple } from "@/lib/flyers";
import { createMemoryCard, type MemoryCard } from "@/lib/memory-card";
import { memoryDepth, placeMemories, type Slot } from "@/lib/memory-layout";
import { baseTilt, flyersPop, lineProgress, popOut } from "@/lib/pop-out";
import { CAMERA, routeForAspect, type FittedRoute } from "@/lib/route";
import { createSea, moodColours, seaStrength } from "@/lib/sea";
import { cloudTint, skyLayers, skyStopsOf } from "@/lib/sky";
import { createStardust } from "@/lib/stardust";
import { createTexturePool } from "@/lib/textures";
import { phaseOf, scheduleOf, type Span, type Timeline } from "@/lib/timeline";

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
  /**
   * Called if the browser took the WebGL context away and has not given it back after `CONTEXT_RESTORE_WAIT_MS` (see
   * lib/context-watch.ts) of the page being visible. The Stage can't mend itself then; the caller should dispose it
   * and make a new one.
   */
  onContextFailed?: () => void;
};

export type Stage = {
  /** The rig that carries the Flyers along the path; its position and rotation follow scroll progress. */
  readonly flyers: Object3D;
  /** The Flyers' pink ribbon trail and their Stardust; drawn in the same layer as them, so whatever veils them veils these too. */
  readonly trail: Object3D;
  readonly stardust: Object3D;
  /** The Sea (water, horizon glow, wake and spray); it has its own layer, behind everything else. */
  readonly sea: Object3D;
  /** The camera, which the camera rig moves every frame (see lib/camera-rig.ts). */
  readonly camera: PerspectiveCamera;
  /** One object per Memory, in order (hidden unless that Memory is on screen). */
  readonly memories: readonly Object3D[];
  /** Resolves once the couple (placeholder or couple.glb) has loaded, or been discarded after disposal. */
  readonly ready: Promise<void>;
  /** Photo textures held right now (held or loading), for the debug overlay and tests. */
  readonly textures: number;
  resize(width: number, height: number): void;
  update(progress: number, dt: number): void;
  dispose(): void;
};

const MAX_PIXEL_RATIO = 2;
const TRAIL_POINTS = 56;
/** How far back along the path the trail reaches, as a share of the whole scroll. */
const TRAIL_SPAN = 0.075;
/** A photo is loaded this far ahead of its Memory (scroll progress, about 1.7 screens) and kept this far after. */
const PHOTO_AHEAD = 0.06;
const PHOTO_BEHIND = 0.01;
/** The Flyers' reflection on the water: its colour and how strong it is at most. */
const REFLECTION_COLOR = 0x8a2c5e;
const REFLECTION_STRENGTH = 0.24;
/** The burst of spray where the dive pulls out starts this far (a share) between the end of the dive pass and the moment they are level, and lasts this long. */
const BURST_START = 0.3;
const BURST_SPAN = 0.04;
/** The camera never gets nearer to the world than this, and sees far enough for the Sea's horizon. */
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

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
 * The transparent WebGL layer with the Sky: the Sea in Year 2 (it falls away as the camera climbs out of it in Year 3),
 * Clouds at several depths, the Memories as pink-framed planes, and the Flyers with their pink trail and Stardust.
 * Rendering is driven by the caller (the shared ticker); this module never starts its own animation loop. Returns null
 * if WebGL is unavailable.
 */
export function createStage(container: HTMLElement, options: StageOptions, deps: StageDeps = {}): Stage | null {
  const { createRenderer = defaultRenderer, loadCouple = defaultLoadCouple, loadPhoto = defaultLoadPhoto } = deps;
  const { memories, timeline, onContextFailed } = options;

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
  const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA_NEAR, CAMERA_FAR);
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

  const stardust = createStardust();
  stardust.points.visible = false;
  scene.add(stardust.points);

  const sea = createSea();
  scene.add(sea.group);

  // A dim, flat copy of the Flyers turned upside down below the water: their reflection. Drawn with them.
  const reflectionMaterial = new MeshBasicMaterial({ color: REFLECTION_COLOR, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
  const reflectionRig = new Group();
  reflectionRig.matrixAutoUpdate = false;
  reflectionRig.visible = false;
  scene.add(reflectionRig);
  let reflectionModel: Object3D | null = null;

  const schedule = scheduleOf(timeline);
  // The dive's Cloud pass, inside which the camera swings behind the Flyers and the Sea comes up. Without it (a very short
  // story) there is no Sea and the camera never moves.
  const dive: Span = timeline.passes[1] ?? { from: 2, to: 3 };
  // The Turn-around's Cloud pass (Year 2 to Year 3), inside which the camera swings in front of the Flyers. Without one the camera stays behind them.
  const turnAround: Span | undefined = timeline.passes[2];
  const skyStops = skyStopsOf(timeline);
  const burst: Span = { from: dive.to + BURST_START * (timeline.levelAt - dive.to), to: dive.to + BURST_START * (timeline.levelAt - dive.to) + BURST_SPAN };
  /** Which Fly-by picture (index into `timeline.flyBys`: Year 2's over the Sea, then Year 3's in the open Sky) each Memory is, if it is one. */
  const flyByOf = new Map<number, number>(timeline.flyBys.map((f, k) => [f.index, k]));
  /** The haze a Fly-by uses: it fades sooner once passed in the open Sky, where it drops towards the Flyers' heads instead of swelling towards the camera. */
  const hazeOf = timeline.flyBys.map((f) => (f.over === "sea" ? FLY_BY : FLY_BY_SKY));

  let route: FittedRoute = routeForAspect(1, schedule);
  let cameraRig: CameraRig = createCameraRig({ route, blend: dive, turnAround });
  let slots: Slot[] = [];
  let placements: FlyByPlacement[] = [];
  let clouds: CloudLayer | null = null;
  let layoutAspect = 0;

  const cards: MemoryCard[] = memories.map((m, i) => {
    const card = createMemoryCard({ index: i, line: m.line });
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

  /** Everything that depends on the screen's shape: the route, the camera, where the Memories hang, and where the Clouds go. */
  const relayout = (aspect: number) => {
    layoutAspect = aspect;
    route = routeForAspect(aspect, schedule);
    cameraRig = createCameraRig({ route, blend: dive, turnAround });
    // Only the Pop-out Memories need a place that keeps the Flyers off their handwritten line; a Fly-by is placed by the camera.
    const popOuts = memories.map((_, i) => i).filter((i) => !flyByOf.has(i));
    const popSlots = placeMemories({ aspect, memories: popOuts.map((i) => memories[i]), route, spans: popOuts.map((i) => timeline.memories[i]) });
    slots = [];
    popOuts.forEach((i, j) => (slots[i] = popSlots[j]));
    placements = placeFlyBys({
      aspect,
      memories: timeline.flyBys.map((f) => memories[f.index]),
      flyBys: timeline.flyBys,
      route,
      camera: cameraRig,
    });
    timeline.flyBys.forEach((f, k) => (slots[f.index] = placements[k].slot));
    cards.forEach((card, i) => {
      card.layout(slots[i], memories[i].ratio);
      const k = flyByOf.get(i);
      if (k !== undefined) {
        // A Fly-by hangs upright, facing the camera, and does not move: its place is its place in the world.
        card.root.rotation.set(0, placements[k].yaw, 0);
        card.setClarity(0, [1, 0.8, 0.88]);
        // Only a picture hanging over the Sea is mirrored in it; one in the open Sky has no water below.
        card.setWater(timeline.flyBys[k].over === "sea" ? (route.sea?.y ?? null) : null);
      }
    });
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
      reflectionModel = loaded.clone(true);
      reflectionModel.traverse((o) => {
        if (o instanceof Mesh) o.material = reflectionMaterial;
      });
      reflectionRig.add(reflectionModel);
      flyersLoaded = true;
    })
    .catch(() => {
      /* loadCouple never rejects in practice; if it did, we simply have no Flyers. */
    });

  // The browser can take the WebGL context away (an iPhone does it when she switches apps): draw nothing while it is
  // gone, redraw the moment it returns, and ask the caller to rebuild us if it never does (lib/context-watch.ts).
  const contextWatch = watchContext(canvas, {
    onRestored: () => draw(lastProgress),
    onFailed: onContextFailed,
  });

  const toward = new Vector3();
  const forward = new Vector3();
  const target = new Vector3();

  /**
   * How near something is to the camera, for sorting: larger is nearer. While the camera is the fixed side view this is
   * just the world z (as it always was); once the camera moves it is the real distance along the view.
   */
  const nearness = (cam: CameraState, x: number, y: number, z: number) =>
    cam.mode === "fixed"
      ? z
      : CAMERA.distance - ((x - cam.position[0]) * forward.x + (y - cam.position[1]) * forward.y + (z - cam.position[2]) * forward.z);

  const draw = (progress: number) => {
    if (contextWatch.lost) return; // nothing to draw into until the browser gives the context back

    // Camera: fixed (drifting a few degrees) until the dive, then behind the Flyers, then in front of them from the Turn-around on (see lib/camera-rig.ts).
    const cam = cameraRig.cameraAt(progress);
    camera.position.set(...cam.position);
    target.set(...cam.target);
    camera.lookAt(target);
    camera.rotateZ(cam.roll);
    camera.updateMatrixWorld();
    forward.copy(target).sub(camera.position).normalize();

    // Flyers.
    const p = route.poseAt(progress);
    rig.position.set(p.x, p.y, p.z);
    rig.rotation.set(p.roll, p.yaw, p.pitch);
    // The Flyers spring up on the left once the first title has finished writing (and shrink away if she scrolls back).
    const pop = flyersPop(phaseOf(timeline.flyersPop, progress));
    rig.scale.setScalar(route.flyerHeight * pop.scale);
    // A gentle bob so they feel alive between scrolls.
    if (model) model.position.y = Math.sin(clock * 2.1) * 0.025;
    toward.set(cam.position[0] - p.x, cam.position[1] - p.y, cam.position[2] - p.z).normalize();
    trail.update(route, progress, toward);
    stardust.update(route, progress, clock, timeline.flyersPop, [toward.x, toward.y, toward.z]);

    // The Sea, its mood, and the Flyers' reflection in it.
    // It falls away as the camera climbs out of Year 2; once it is gone it is not drawn at all.
    const strength = route.sea ? seaStrength(progress, dive, (cam.position[1] - route.sea.y) / route.flyerHeight) : 0;
    const mood = moodColours(skyLayers(progress, skyStops));
    const seaShowing = sea.update({
      camera: { position: cam.position, forward: [forward.x, forward.y, forward.z] },
      route,
      progress,
      clock,
      strength,
      mood,
      burst,
      levelAt: timeline.levelAt,
    });
    let reflecting = false;
    if (seaShowing && route.sea && reflectionModel && model) {
      const above = (p.y - route.sea.y) / route.flyerHeight;
      const opacity = REFLECTION_STRENGTH * strength * pop.scale * (1 - smooth(above / 5));
      reflectionMaterial.opacity = opacity;
      if (opacity > 0.004) {
        rig.updateMatrix();
        const y = route.sea.y;
        reflectionRig.matrix.set(1, 0, 0, 0, 0, -1, 0, 2 * y, 0, 0, 1, 0, 0, 0, 0, 1).multiply(rig.matrix);
        reflectionRig.matrixWorldNeedsUpdate = true;
        reflectionModel.position.y = model.position.y;
        reflecting = true;
      }
    }

    // Memories: Pop-out pose (How we met and Year 1) or Fly-by haze (Years 2 and 3), the handwritten line, and which photos should be in memory.
    const ahead: { i: number; distance: number }[] = [];
    const shown: boolean[] = [];
    cards.forEach((card, i) => {
      const span = timeline.memories[i];
      const k = flyByOf.get(i);
      if (k !== undefined) {
        // Fly-by: clear by how far the Flyers are from it along the route; it never moves.
        const away = placements[k].distance - route.distanceAt(progress);
        const clarity = flyByClarity(away, route.flyerHeight, hazeOf[k]);
        card.setClarity(clarity, mood.horizon);
        card.setLineProgress(labelProgress(away, route.flyerHeight));
        shown[i] = clarity > 0.004;
      } else {
        const phase = phaseOf(span, progress);
        const s = popOut(phase);
        shown[i] = s.visible;
        const slot = slots[i];
        const outward = slot.side === "left" ? -1 : 1;
        card.root.position.set(slot.x, slot.y, memoryDepth(s.forward));
        card.root.scale.setScalar(s.scale);
        card.root.rotation.z = (baseTilt(i) * Math.PI) / 180 + s.tilt * outward;
        card.setLineProgress(lineProgress(phase));
      }
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

    // Draw: the Sea first, behind everything; then sort Clouds, Memories and the Flyers (see lib/draw-order.ts) and paint layer by layer.
    renderer.clear();
    if (seaShowing) {
      sea.group.visible = true;
      renderer.clearDepth();
      renderer.render(scene, camera);
      sea.group.visible = false;
    }
    const puffs = clouds ? clouds.update(progress, cloudTint(progress, skyStops)) : [];
    const items: Item[] = puffs.map((q) => {
      const at = clouds!.sprites[q.id].position;
      return { kind: "puff", id: q.id, z: nearness(cam, at.x, at.y, at.z) };
    });
    cards.forEach((card, i) => {
      if (!shown[i]) return;
      const at = card.root.position;
      items.push({ kind: "memory", id: i, z: nearness(cam, at.x, at.y, at.z), byDepth: flyByOf.has(i) });
    });
    if (flyersLoaded && pop.visible) items.push({ kind: "flyers", z: nearness(cam, rig.position.x, rig.position.y, rig.position.z) });

    for (const layer of drawOrder(items)) {
      const show = (on: boolean) => {
        if (layer.kind === "puffs") for (const id of layer.ids) clouds!.sprites[id].visible = on;
        else if (layer.kind === "memory") cards[layer.id].root.visible = on;
        else {
          rig.visible = on;
          trail.mesh.visible = on;
          stardust.points.visible = on;
          reflectionRig.visible = on && reflecting;
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
    trail: trail.mesh,
    stardust: stardust.points,
    sea: sea.group,
    camera,
    memories: cards.map((c) => c.root),
    ready,

    get textures() {
      return photos.size;
    },

    resize(width, height) {
      if (disposed || width <= 0 || height <= 0) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      stardust.setViewport(height * pixelRatio, CAMERA.fov);
      sea.setViewport(height * pixelRatio, CAMERA.fov);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (Math.abs(camera.aspect - layoutAspect) > 1e-3) relayout(camera.aspect);
      draw(lastProgress); // resizing clears the canvas; redraw now so it never flashes blank
    },

    update(progress, dt) {
      if (disposed) return;
      clock += dt;
      lastProgress = progress;
      draw(progress);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      contextWatch.dispose();
      photos.dispose();
      for (const card of cards) card.dispose();
      clouds?.dispose();
      if (model) disposeObject(model);
      reflectionMaterial.dispose();
      trail.dispose();
      stardust.dispose();
      sea.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

/* ---------- Trail: the soft pink ribbon that fades behind the Flyers (Stardust is scattered around it) ---------- */

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

  return {
    mesh,
    /** `toCamera` is the direction from the Flyers to the camera: the ribbon lies across it, so it always shows its width. */
    update(route: FittedRoute, progress: number, toCamera: Vector3) {
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
