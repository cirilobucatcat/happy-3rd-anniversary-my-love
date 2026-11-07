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
  Vector3,
  WebGLRenderer,
} from "three";
import { RIM_COLOR, disposeObject, loadCouple as defaultLoadCouple, type LoadedCouple } from "@/lib/flyers";
import { CAMERA, routeForAspect, type FittedRoute } from "@/lib/route";

/** The slice of WebGLRenderer we use, so tests can supply a fake. */
export type RendererLike = Pick<
  WebGLRenderer,
  "domElement" | "setPixelRatio" | "setSize" | "render" | "dispose" | "forceContextLoss"
>;

export type SceneDeps = {
  createRenderer?: (canvas: HTMLCanvasElement) => RendererLike;
  loadCouple?: () => Promise<LoadedCouple>;
};

export type FlyersScene = {
  /** The rig that carries the Flyers along the path; its position and rotation follow scroll progress. */
  readonly flyers: Object3D;
  /** Resolves once the couple (placeholder or couple.glb) has loaded, or been discarded after disposal. */
  readonly ready: Promise<void>;
  resize(width: number, height: number): void;
  update(progress: number, dt: number): void;
  dispose(): void;
};

const MAX_PIXEL_RATIO = 2;
const TRAIL_POINTS = 56;
/** How far back along the path the trail reaches, as a share of the whole scroll. */
const TRAIL_SPAN = 0.075;

const defaultRenderer = (canvas: HTMLCanvasElement): RendererLike =>
  new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });

/**
 * The transparent WebGL layer with the Flyers and their trail. Rendering is driven by the caller (the shared
 * ticker); this module never starts its own animation loop. Returns null if WebGL is unavailable.
 */
export function createFlyersScene(container: HTMLElement, deps: SceneDeps = {}): FlyersScene | null {
  const { createRenderer = defaultRenderer, loadCouple = defaultLoadCouple } = deps;

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  let renderer: RendererLike;
  try {
    renderer = createRenderer(canvas);
  } catch {
    canvas.remove();
    return null;
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA.distance);

  // Mostly dark: the pink rim comes from the material's Fresnel term; these lights just hint at form.
  scene.add(new AmbientLight(0xffffff, 0.35));
  const back = new DirectionalLight(RIM_COLOR, 2.2);
  back.position.set(-3, 3, -5);
  scene.add(back);
  const key = new DirectionalLight(0xffffff, 0.9);
  key.position.set(3, 4, 6);
  scene.add(key);

  const rig = new Group();
  rig.rotation.order = "YZX";
  rig.visible = false;
  scene.add(rig);

  const trail = createTrail();
  trail.mesh.visible = false;
  scene.add(trail.mesh);

  let route: FittedRoute = routeForAspect(1);
  let model: Object3D | null = null;
  let disposed = false;
  let clock = 0;
  let lastProgress = 0;

  const ready = loadCouple()
    .then(({ model: loaded }) => {
      if (disposed) {
        disposeObject(loaded);
        return;
      }
      model = loaded;
      rig.add(loaded);
      rig.visible = true;
      trail.mesh.visible = true;
    })
    .catch(() => {
      /* loadCouple never rejects in practice; if it did, we simply have no Flyers. */
    });

  const draw = (progress: number) => {
    const p = route.poseAt(progress);
    rig.position.set(p.x, p.y, p.z);
    rig.rotation.set(p.roll, p.yaw, p.pitch);
    rig.scale.setScalar(route.flyerHeight);
    // A gentle bob so they feel alive between scrolls.
    if (model) model.position.y = Math.sin(clock * 2.1) * 0.025;
    trail.update(route, progress);
    renderer.render(scene, camera);
  };

  return {
    flyers: rig,
    ready,

    resize(width, height) {
      if (disposed || width <= 0 || height <= 0) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      route = routeForAspect(camera.aspect);
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
