/**
 * The Sea: open, made-up, shiny rose-pink water under Year 2 with a glowing horizon and no land. It is light on
 * purpose (an iPhone has to draw it): one big plane with a small shader that mirrors the Sky above it, a soft glow band
 * on the horizon, a wake of ripples and foam behind the Flyers, a few spray droplets, and a burst of spray where the
 * dive pulls out. There is no water simulation (see the spec).
 *
 * The Sky itself is a CSS gradient behind the canvas, so the water mirrors it by being given the same mood colours.
 * Everything that moves is a pure function of scroll progress (plus a time-based shimmer), so scrolling back rewinds it.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import type { FittedRoute } from "@/lib/route";
import type { SkyLayers } from "@/lib/sky";
import { phaseOf, type Span } from "@/lib/timeline";

type RGB = readonly [number, number, number];

/** Water and haze colours for each mood (sRGB, 0 to 1): the horizon haze, the deep water, and the sky overhead it mirrors. */
const MOODS: Record<"dawn" | "day" | "sunset" | "rose", { horizon: RGB; deep: RGB; zenith: RGB; glow: RGB }> = {
  dawn: { horizon: [1.0, 0.85, 0.9], deep: [0.86, 0.38, 0.6], zenith: [1.0, 0.75, 0.85], glow: [1.0, 0.9, 0.93] },
  day: { horizon: [1.0, 0.8, 0.88], deep: [0.86, 0.34, 0.58], zenith: [1.0, 0.56, 0.73], glow: [1.0, 0.92, 0.94] },
  sunset: { horizon: [1.0, 0.72, 0.62], deep: [0.74, 0.24, 0.45], zenith: [0.91, 0.44, 0.61], glow: [1.0, 0.82, 0.68] },
  rose: { horizon: [0.94, 0.57, 0.68], deep: [0.5, 0.15, 0.32], zenith: [0.78, 0.34, 0.5], glow: [1.0, 0.7, 0.78] },
};

/** The colours for the Sky mood at this moment: the four moods blended by the Sky's own layer weights. */
export function moodColours(w: Pick<SkyLayers, "dawn" | "day" | "sunset" | "rose">) {
  const sum = w.dawn + w.day + w.sunset + w.rose || 1;
  const mix = (key: "horizon" | "deep" | "zenith" | "glow"): [number, number, number] => {
    const out: [number, number, number] = [0, 0, 0];
    for (const mood of ["dawn", "day", "sunset", "rose"] as const) {
      const k = w[mood] / sum;
      for (let i = 0; i < 3; i++) out[i] += MOODS[mood][key][i] * k;
    }
    return out;
  };
  return { horizon: mix("horizon"), deep: mix("deep"), zenith: mix("zenith"), glow: mix("glow") };
}

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/**
 * How much of the Sea is showing, 0 to 1: it comes up during the second half of the dive's Cloud pass, while the
 * Clouds hide the Flyers and the camera swings round behind them.
 */
export function seaStrength(progress: number, dive: Span): number {
  return smooth(phaseOf({ from: (dive.from + dive.to) / 2, to: dive.to }, progress));
}

/** The plane is this big (a side), centred under the camera, so its edge is far beyond the haze. */
const SIZE = 700;

/** A pseudo-random number in [0, 1) for slot `i`, channel `k`, so every droplet always looks the same. */
function hash(i: number, k: number): number {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/* ---------- Spray ---------- */

export type Droplet = { x: number; y: number; z: number; size: number; alpha: number };

/** Droplets are dropped along the path every this many Flyer heights, and fall back within this many. */
const SPRAY_SPACING = 0.32;
const SPRAY_REACH = 6;
export const BURST_COUNT = 40;
export const MAX_DROPLETS = Math.ceil(SPRAY_REACH / SPRAY_SPACING) * 2 + BURST_COUNT + 8;

/**
 * The spray thrown up by the Flyers skimming the water, and the burst where the dive pulls out. Pure: the same
 * progress and time always give the same droplets. Spray only comes while they are low, and only once they are level.
 */
export function sprayDroplets(input: {
  route: FittedRoute;
  progress: number;
  clock: number;
  /** When the burst happens. */
  burst: Span;
  /** The progress from which the Flyers are level over the water (no spray before). */
  levelAt: number;
}): Droplet[] {
  const { route, progress, clock, burst, levelAt } = input;
  const sea = route.sea;
  const out: Droplet[] = [];
  if (!sea) return out;
  const h = route.flyerHeight;

  /* The stream behind the Flyers. */
  if (progress >= levelAt) {
    const d = route.distanceAt(progress);
    const spacing = SPRAY_SPACING * h;
    const first = Math.max(Math.ceil((d - SPRAY_REACH * h) / spacing), Math.ceil(route.distanceAt(levelAt) / spacing));
    const last = Math.floor(d / spacing);
    for (let j = first; j <= last; j++) {
      const age = (d - j * spacing) / (SPRAY_REACH * h);
      if (age < 0 || age >= 1) continue;
      for (let side = 0; side < 2; side++) {
        const id = j * 2 + side;
        if (hash(id, 0) > 0.72) continue; // not every slot throws spray
        const pose = route.poseAtDistance(j * spacing);
        // Low flight throws more spray; at the top of a swoop there is hardly any.
        const low = 1 - smooth((pose.y - sea.y - 0.45 * h) / (0.9 * h));
        if (low <= 0.01) continue;
        const lateral = (side === 0 ? -1 : 1) * h * (0.25 + 0.9 * age) * (0.6 + 0.8 * hash(id, 1));
        const arc = 4 * age * (1 - age);
        const tw = 0.6 + 0.4 * Math.sin(clock * (2 + 3 * hash(id, 2)) + hash(id, 3) * 6.28);
        out.push({
          x: pose.x + lateral,
          y: sea.y + h * 0.04 + h * (0.15 + 0.7 * hash(id, 4)) * arc,
          z: pose.z + (hash(id, 5) - 0.5) * h,
          size: h * (0.07 + 0.09 * hash(id, 6)) * (1 - 0.45 * age),
          alpha: low * Math.pow(1 - age, 1.3) * tw * 0.85,
        });
      }
    }
  }

  /* The burst where the dive pulls out: a ring of spray thrown up and out from the water. */
  const b = phaseOf(burst, progress);
  if (b > 0 && b < 1) {
    const reach = 1 - Math.pow(1 - b, 2.2);
    for (let k = 0; k < BURST_COUNT; k++) {
      const id = 5000 + k;
      const angle = (k / BURST_COUNT) * Math.PI * 2 + (hash(id, 1) - 0.5) * 0.5;
      const radius = h * (0.2 + 2.6 * reach * (0.5 + 0.7 * hash(id, 2)));
      const lift = h * (2.2 + 2 * hash(id, 3)) * reach * (1 - reach) * 4 * 0.5;
      out.push({
        x: sea.level.x + Math.cos(angle) * radius,
        y: sea.y + h * 0.05 + lift,
        z: sea.level.z + Math.sin(angle) * radius,
        size: h * (0.1 + 0.12 * hash(id, 4)) * (1 - 0.4 * b),
        alpha: smooth(b / 0.08) * Math.pow(1 - b, 1.4) * 0.9,
      });
    }
  }
  return out;
}

/* ---------- Drawing ---------- */

const surfaceVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const surfaceFragment = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uDeep;
uniform vec3 uZenith;
uniform float uTime;
uniform float uStrength;
uniform float uHalfSize;
varying vec3 vWorld;
void main() {
  vec3 toPoint = vWorld - cameraPosition;
  float dist = length(toPoint);
  vec3 rd = toPoint / dist;
  vec2 q = vWorld.xz;
  float t = uTime;
  // A cheap swell: the slope of a few crossing waves. Fades with distance so far water does not shimmer.
  float detail = 1.0 - smoothstep(18.0, 110.0, dist);
  vec2 g = vec2(cos(q.x * 0.9 + t * 1.1), sin(q.y * 1.3 - t * 0.9)) * 0.06;
  g += vec2(cos(dot(q, vec2(0.6, 0.8)) * 2.1 + t * 1.7), sin(dot(q, vec2(-0.8, 0.6)) * 2.7 - t * 1.3)) * 0.04;
  g += vec2(cos(dot(q, vec2(0.9, -0.4)) * 4.6 + t * 2.3), sin(dot(q, vec2(0.3, 0.95)) * 5.1 - t * 2.1)) * 0.025;
  vec3 n = normalize(vec3(-g.x * detail, 1.0, -g.y * detail));
  vec3 refl = reflect(rd, n);
  float e = clamp(refl.y, 0.0, 1.0);
  vec3 sky = mix(uHorizon, uZenith, pow(e, 0.45));
  float fres = 0.16 + 0.84 * pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 4.0);
  vec3 col = mix(uDeep, sky, fres);
  // Glitter: a bright path toward the glowing horizon ahead.
  vec3 sun = normalize(vec3(0.0, 0.07, -1.0));
  float spec = pow(max(dot(refl, sun), 0.0), 70.0) * detail;
  col += vec3(1.0, 0.92, 0.95) * spec * 0.8;
  // Far water melts into the haze of the horizon.
  col = mix(col, uHorizon, smoothstep(30.0, 300.0, dist));
  float edge = 1.0 - smoothstep(0.8, 1.0, dist / uHalfSize);
  gl_FragColor = vec4(col, uStrength * edge);
}
`;

const glowVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const glowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float dy = vUv.y * 2.0 - 1.0;
  float a = (exp(-dy * dy * 9.0) * 0.8 + exp(-dy * dy * 90.0) * 0.5) * uAlpha;
  gl_FragColor = vec4(uColor, a);
}
`;

const wakeVertex = /* glsl */ `
attribute vec2 wake; // x: across the wake (-1 to 1), y: how far back (0 at the Flyers, 1 at the end)
varying vec2 vWake;
void main() {
  vWake = wake;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const wakeFragment = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
varying vec2 vWake;
void main() {
  float across = abs(vWake.x);
  float back = vWake.y;
  // Foam along the two edges of the V, a thin bright streak down the middle, and rings of ripple running outward.
  float edge = smoothstep(0.55, 0.9, across) * (1.0 - smoothstep(0.9, 1.0, across));
  float middle = (1.0 - smoothstep(0.0, 0.28, across)) * 0.55;
  float rings = 0.5 + 0.5 * sin(back * 70.0 - uTime * 3.0 + across * 5.0);
  float body = (edge * 0.9 + middle) * (0.55 + 0.45 * rings);
  float a = body * pow(1.0 - back, 1.4) * smoothstep(0.0, 0.04, back) * uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(1.0, 0.93, 0.96, a);
}
`;

const sprayVertex = /* glsl */ `
attribute float size;
attribute float alpha;
uniform float uScale;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(size * uScale / max(-mv.z, 0.001), 1.5);
  vAlpha = alpha;
}
`;

const sprayFragment = /* glsl */ `
varying float vAlpha;
void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  float a = (1.0 - smoothstep(0.35, 1.0, r)) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(1.0, 0.94, 0.97, a);
}
`;

/** Points along the wake, and how far back it reaches (Flyer heights). */
const WAKE_POINTS = 36;
const WAKE_REACH = 16;

export type SeaUpdate = {
  /** Where the camera is and which way it looks (horizontally), for the plane and the horizon glow. */
  camera: { position: readonly [number, number, number]; forward: readonly [number, number, number] };
  route: FittedRoute;
  progress: number;
  clock: number;
  /** 0 to 1: how much of the Sea is showing. */
  strength: number;
  mood: ReturnType<typeof moodColours>;
  burst: Span;
  levelAt: number;
};

export type Sea = {
  /** Everything the Sea draws; added to the scene by the caller and shown only in the Sea's own layer. */
  readonly group: Group;
  /** Moves everything to this moment. Returns false when there is no Sea to draw (the caller then skips its layer). */
  update(input: SeaUpdate): boolean;
  /** The drawing buffer's height in pixels and the camera's vertical field of view in degrees, so droplet sizes stay in world units. */
  setViewport(heightPx: number, fovDegrees: number): void;
  dispose(): void;
};

export function createSea(): Sea {
  const group = new Group();
  group.name = "sea";
  group.visible = false; // the caller shows it for the Sea's own layer only

  // The water: one big flat plane that follows the camera along (the waves are worked out from the world position).
  const surfaceMaterial = new ShaderMaterial({
    vertexShader: surfaceVertex,
    fragmentShader: surfaceFragment,
    uniforms: {
      uHorizon: { value: new Vector3() },
      uDeep: { value: new Vector3() },
      uZenith: { value: new Vector3() },
      uTime: { value: 0 },
      uStrength: { value: 0 },
      uHalfSize: { value: SIZE / 2 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const surface = new Mesh(new PlaneGeometry(SIZE, SIZE), surfaceMaterial);
  surface.rotation.x = -Math.PI / 2;
  surface.frustumCulled = false;
  surface.renderOrder = 0;
  group.add(surface);

  // The glowing horizon: a tall soft band standing at eye level a long way off, facing the camera.
  const glowMaterial = new ShaderMaterial({
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    uniforms: { uColor: { value: new Vector3() }, uAlpha: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(new PlaneGeometry(4000, 150), glowMaterial);
  glow.frustumCulled = false;
  glow.renderOrder = 1;
  group.add(glow);

  // The wake: a ribbon lying on the water behind the Flyers.
  const wakePositions = new Float32Array(WAKE_POINTS * 2 * 3);
  const wakeAttribute = new Float32Array(WAKE_POINTS * 2 * 2);
  const wakeIndex: number[] = [];
  for (let i = 0; i < WAKE_POINTS - 1; i++) {
    const a = i * 2;
    wakeIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const wakeGeometry = new BufferGeometry();
  wakeGeometry.setAttribute("position", new BufferAttribute(wakePositions, 3));
  wakeGeometry.setAttribute("wake", new BufferAttribute(wakeAttribute, 2));
  wakeGeometry.setIndex(wakeIndex);
  const wakeMaterial = new ShaderMaterial({
    vertexShader: wakeVertex,
    fragmentShader: wakeFragment,
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: DoubleSide,
  });
  const wake = new Mesh(wakeGeometry, wakeMaterial);
  wake.frustumCulled = false;
  wake.renderOrder = 2;
  group.add(wake);

  // Spray: soft white droplets.
  const sprayPosition = new Float32Array(MAX_DROPLETS * 3);
  const spraySize = new Float32Array(MAX_DROPLETS);
  const sprayAlpha = new Float32Array(MAX_DROPLETS);
  const sprayGeometry = new BufferGeometry();
  const sprayAttributes = {
    position: new BufferAttribute(sprayPosition, 3),
    size: new BufferAttribute(spraySize, 1),
    alpha: new BufferAttribute(sprayAlpha, 1),
  };
  for (const [name, attribute] of Object.entries(sprayAttributes)) sprayGeometry.setAttribute(name, attribute);
  sprayGeometry.setDrawRange(0, 0);
  const sprayMaterial = new ShaderMaterial({
    vertexShader: sprayVertex,
    fragmentShader: sprayFragment,
    uniforms: { uScale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const spray = new Points(sprayGeometry, sprayMaterial);
  spray.frustumCulled = false;
  spray.renderOrder = 3;
  group.add(spray);

  return {
    group,

    update({ camera, route, progress, clock, strength, mood, burst, levelAt }) {
      const sea = route.sea;
      if (!(strength > 0.002) || !sea) return false;
      const h = route.flyerHeight;

      // The water follows the camera across, at the height of the water.
      surface.position.set(camera.position[0], sea.y, camera.position[2]);
      (surfaceMaterial.uniforms.uHorizon.value as Vector3).set(...mood.horizon);
      (surfaceMaterial.uniforms.uDeep.value as Vector3).set(...mood.deep);
      (surfaceMaterial.uniforms.uZenith.value as Vector3).set(...mood.zenith);
      surfaceMaterial.uniforms.uTime.value = clock;
      surfaceMaterial.uniforms.uStrength.value = strength;

      // The glow stands ahead of the camera at its eye level, turned to face it.
      const fh = Math.hypot(camera.forward[0], camera.forward[2]) || 1;
      const dx = camera.forward[0] / fh;
      const dz = camera.forward[2] / fh;
      glow.position.set(camera.position[0] + dx * 330, camera.position[1], camera.position[2] + dz * 330);
      glow.rotation.y = Math.atan2(-dx, -dz);
      (glowMaterial.uniforms.uColor.value as Vector3).set(...mood.glow);
      glowMaterial.uniforms.uAlpha.value = strength * 0.5;

      // The wake: a V that opens out behind the Flyers, stronger the lower they fly.
      const flyers = route.poseAt(progress);
      const d = route.distanceAt(progress);
      const low = 1 - smooth((flyers.y - sea.y - 0.45 * h) / (0.9 * h));
      const level = progress >= levelAt ? 1 : smooth(1 - (levelAt - progress) / 0.01);
      for (let i = 0; i < WAKE_POINTS; i++) {
        const u = i / (WAKE_POINTS - 1);
        const p = route.poseAtDistance(d - u * WAKE_REACH * h);
        const next = route.poseAtDistance(d - u * WAKE_REACH * h - 0.2 * h);
        let sx = p.z - next.z; // sideways = the heading turned a quarter, flat on the water
        let sz = next.x - p.x;
        const sl = Math.hypot(sx, sz) || 1;
        sx /= sl;
        sz /= sl;
        const half = h * (0.18 + 1.5 * u);
        const y = sea.y + 0.02 * h;
        wakePositions.set([p.x + sx * half, y, p.z + sz * half, p.x - sx * half, y, p.z - sz * half], i * 6);
        wakeAttribute.set([1, u, -1, u], i * 4);
      }
      wakeGeometry.attributes.position.needsUpdate = true;
      wakeGeometry.attributes.wake.needsUpdate = true;
      wakeMaterial.uniforms.uTime.value = clock;
      wakeMaterial.uniforms.uAlpha.value = strength * low * level * 0.9;
      wake.visible = wakeMaterial.uniforms.uAlpha.value > 0.003;

      // The spray.
      const droplets = sprayDroplets({ route, progress, clock, burst, levelAt });
      const n = Math.min(droplets.length, MAX_DROPLETS);
      for (let i = 0; i < n; i++) {
        const drop = droplets[i];
        sprayPosition.set([drop.x, drop.y, drop.z], i * 3);
        spraySize[i] = drop.size;
        sprayAlpha[i] = drop.alpha * strength;
      }
      for (const attribute of Object.values(sprayAttributes)) attribute.needsUpdate = true;
      sprayGeometry.setDrawRange(0, n);
      return true;
    },

    setViewport(heightPx, fovDegrees) {
      sprayMaterial.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDegrees / 2) * (Math.PI / 180)));
    },

    dispose() {
      surface.geometry.dispose();
      surfaceMaterial.dispose();
      glow.geometry.dispose();
      glowMaterial.dispose();
      wakeGeometry.dispose();
      wakeMaterial.dispose();
      sprayGeometry.dispose();
      sprayMaterial.dispose();
    },
  };
}
