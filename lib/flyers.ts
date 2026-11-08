import {
  Box3,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Texture,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The Flyers: the couple holding hands in their own colours, facing +x with +y up, about one unit tall.
 * The scene scales that unit to the viewport. A `public/models/couple.glb` replaces the built-in couple and keeps its
 * own colours; every standard material gets the same soft pink rim.
 */

export const MODEL_URL = "/models/couple.glb";
export const MODEL_LIMITS = { bytes: 2 * 1024 * 1024, triangles: 30_000 } as const;

export const RIM_COLOR = 0xff5fa2;
/** How strongly the pink rim glows at the edges (it was 0.9 when the Flyers were all black). */
export const RIM_STRENGTH = 0.45;
export const RIM_KEY = "flyers-rim";
const GLB_MAGIC = 0x46546c67; // "glTF", little endian

/* ---------- Look: their own colours with a soft pink rim ---------- */

/** The placeholder couple's colours, matched to `couple.glb`. */
export const PALETTE = {
  herSkin: 0xf0c4a4,
  hisSkin: 0xb98563,
  dress: 0xe8457e,
  hair: 0x1a1416,
  suit: 0x111111,
} as const;

/** Adds the pink Fresnel rim to a standard (or physical) material, in place. */
export function addRim(material: MeshStandardMaterial): MeshStandardMaterial {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: new Color(RIM_COLOR) };
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 rimColor;\nvoid main() {")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 3.4);
        totalEmissiveRadiance += rimColor * rim * ${RIM_STRENGTH.toFixed(3)};`,
      );
  };
  material.customProgramCacheKey = () => RIM_KEY;
  return material;
}

/** A flat-coloured matte material with the rim, for the placeholder couple. */
function flat(color: number): MeshStandardMaterial {
  return addRim(new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, side: DoubleSide }));
}

/* ---------- Placeholder couple ---------- */

const UP = new Vector3(0, 1, 0);

/** A thin cylinder from `a` to `b`, for limbs. */
function limb(a: Vector3, b: Vector3, radius: number, material: Material): Mesh {
  const dir = b.clone().sub(a);
  const mesh = new Mesh(new CylinderGeometry(radius, radius * 0.85, dir.length(), 6, 1), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  return mesh;
}

/** A cone from the centre of its base to its apex (the base may be open, for a skirt). */
function cone(base: Vector3, apex: Vector3, radius: number, material: Material, open = false): Mesh {
  const dir = apex.clone().sub(base);
  const mesh = new Mesh(new ConeGeometry(radius, dir.length(), 10, 1, open), material);
  mesh.position.copy(base).add(apex).multiplyScalar(0.5);
  mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  return mesh;
}

const LEAN = (30 * Math.PI) / 180;
const point = (x: number, y: number, z = 0) => new Vector3(x, y, z);

type Look = { skin: Material; hair: Material; top: Material; legs: Material };

/** One person, built upright (feet at the origin, facing +x) then leaned forward about 30 degrees. */
function person(name: string, long: boolean, look: Look): Group {
  const body = new Group();
  body.name = `${name}-body`;
  body.rotation.z = -LEAN; // leaning forward = towards +x

  // Torso, neck and head.
  body.add(limb(point(0, 0.46), point(0, 0.8), long ? 0.065 : 0.08, look.top));
  const head = new Mesh(new SphereGeometry(0.078, 10, 8), look.skin);
  head.position.set(0.012, 0.9, 0);
  body.add(head);

  // Legs in mid-stride, joined to the hips.
  body.add(limb(point(0, 0.47, 0.04), point(0.13, 0.02, 0.045), 0.036, look.legs));
  body.add(limb(point(0, 0.47, -0.04), point(-0.15, 0.04, -0.045), 0.036, look.legs));

  if (long) {
    // Long hair streaming back behind her, and a dress blown out behind.
    body.add(cone(point(-0.045, 0.91), point(-0.42, 0.74), 0.085, look.hair));
    const cap = new Mesh(new SphereGeometry(0.083, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), look.hair);
    cap.position.set(-0.002, 0.915, 0);
    body.add(cap);
    body.add(cone(point(-0.16, 0.2), point(0.0, 0.6), 0.19, look.top, true));
  } else {
    // His hair is short: just a cap.
    const cap = new Mesh(new SphereGeometry(0.086, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), look.hair);
    cap.position.set(0.0, 0.917, 0);
    body.add(cap);
  }
  return body;
}

export function buildPlaceholderCouple(): Group {
  const hair = flat(PALETTE.hair);
  const suit = flat(PALETTE.suit);
  const dress = flat(PALETTE.dress);
  const herSkin = flat(PALETTE.herSkin);
  const hisSkin = flat(PALETTE.hisSkin);
  const couple = new Group();
  couple.name = "couple";

  const her = new Group();
  her.name = "her";
  her.position.set(-0.02, 0, 0.19);
  her.add(person("her", true, { skin: herSkin, hair, top: dress, legs: herSkin }));

  const him = new Group();
  him.name = "him";
  him.position.set(0.1, 0.03, -0.19);
  him.scale.setScalar(1.06);
  him.add(person("him", false, { skin: hisSkin, hair, top: suit, legs: suit }));

  couple.add(her, him);
  couple.updateMatrixWorld(true);

  // Arms: the inner ones meet in the middle (holding hands); the outer ones sweep back. Hers are bare, his are sleeved.
  const shoulderOf = (g: Group, dz: number) => {
    const body = g.children[0];
    return body.localToWorld(new Vector3(0, 0.78, dz)).applyMatrix4(couple.matrixWorld.clone().invert());
  };
  const herInner = shoulderOf(her, -0.07);
  const himInner = shoulderOf(him, 0.07);
  const hands = herInner.clone().add(himInner).multiplyScalar(0.5).add(point(0.03, -0.2));
  couple.add(limb(herInner, hands, 0.026, herSkin));
  couple.add(limb(himInner, hands, 0.026, suit));
  const herOuter = shoulderOf(her, 0.07);
  couple.add(limb(herOuter, herOuter.clone().add(point(-0.2, -0.22, 0.06)), 0.026, herSkin));
  const himOuter = shoulderOf(him, -0.07);
  couple.add(limb(himOuter, himOuter.clone().add(point(-0.2, -0.22, -0.06)), 0.026, suit));

  // Turn the pair a little towards the camera so two people read, instead of one silhouette hiding the other.
  couple.rotation.y = -0.45;
  return normalize(couple);
}

/* ---------- Loading couple.glb ---------- */

export function countTriangles(root: Object3D): number {
  let total = 0;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry as BufferGeometry;
    total += (g.index ? g.index.count : (g.getAttribute("position")?.count ?? 0)) / 3;
  });
  return total;
}

/** Wraps `model` so it is centred on the origin and one unit tall (or one unit across if it has no height). */
function normalize(model: Object3D): Group {
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const extent = size.y > 1e-6 ? size.y : Math.max(size.x, size.z, 1e-6);
  const wrapper = new Group();
  wrapper.name = model.name;
  model.position.sub(centre);
  wrapper.add(model);
  wrapper.scale.setScalar(1 / extent);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

/** Frees the GPU memory of everything under `root` (geometries, materials). */
export function disposeObject(root: Object3D): void {
  const materials = new Set<Material>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    (o.geometry as BufferGeometry).dispose();
    for (const m of materialsOf(o)) materials.add(m);
  });
  for (const m of materials) disposeMaterial(m);
}

const materialsOf = (mesh: Mesh): Material[] => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

/** Frees a material and any textures it holds (a loaded model's colour map, say). */
function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
  material.dispose();
}

type FetchLike = (url: string) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;

export type LoadedCouple = { model: Object3D; source: "glb" | "placeholder" };

/**
 * Tries `couple.glb`; any problem (missing, wrong type, too big, corrupt, over budget) quietly gives the placeholder.
 * A loaded model keeps its own materials and colours; each standard one gets the pink rim.
 */
export async function loadCouple(options: { fetchFn?: FetchLike; url?: string } = {}): Promise<LoadedCouple> {
  const { fetchFn = (u: string) => fetch(u), url = MODEL_URL } = options;
  const fallback = (): LoadedCouple => ({ model: buildPlaceholderCouple(), source: "placeholder" });

  try {
    const res = await fetchFn(url);
    if (!res.ok) return fallback();
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MODEL_LIMITS.bytes || bytes.byteLength < 12) return fallback();
    if (new DataView(bytes).getUint32(0, true) !== GLB_MAGIC) return fallback();

    const gltf = await new GLTFLoader().parseAsync(bytes, "");
    const scene = gltf.scene;
    const triangles = countTriangles(scene);
    if (triangles > MODEL_LIMITS.triangles || triangles === 0) {
      disposeObject(scene);
      return fallback();
    }

    const rimmed = new Set<Material>();
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      for (const m of materialsOf(o)) {
        // Only standard materials have the emissive slot the rim is added to (an unlit one is left as it is).
        if (m instanceof MeshStandardMaterial && !rimmed.has(m)) addRim(m);
        rimmed.add(m);
      }
    });
    return { model: normalize(scene), source: "glb" };
  } catch {
    return fallback();
  }
}
