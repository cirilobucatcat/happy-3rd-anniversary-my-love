import { BufferAttribute, BufferGeometry, NormalBlending, Points, ShaderMaterial, Vector3 } from "three";
import type { FittedRoute } from "@/lib/route";
import { phaseOf, type Span } from "@/lib/timeline";

/**
 * Stardust: the pink and orange stars, sparkles and glitter the Flyers leave behind them, around their pink ribbon
 * (see GLOSSARY.md).
 *
 * Each piece of the stream is dropped at a fixed scroll progress on the Flight path and stays there, so scrolling
 * back rewinds it. Its age (how far behind the Flyers it is) sets its colour, from hot pink at the Flyers through coral
 * and orange to gold at the tail, and how far it has drifted out sideways, how small and how faint it is. Time only adds a twinkle, a slow spin
 * and a shimmer of colour, never movement along the path.
 */

/** How far back the stream reaches, as scroll progress (about 2.4 screens of the page). */
export const STARDUST_SPAN = 0.075;
/** Pieces in a full stream. */
export const STARDUST_COUNT = 120;
/** Pieces in the burst when the Flyers spring up. */
export const BURST_COUNT = 24;
/** The burst lasts this many times as long as the spring itself. */
const BURST_STRETCH = 2.5;
/** Room for a full stream (it can briefly hold one more piece) plus the burst. */
export const MAX_PIECES = STARDUST_COUNT + 1 + BURST_COUNT;

const SPACING = STARDUST_SPAN / STARDUST_COUNT;
/**
 * The sky's colours, made strong enough to stand out against it (sRGB, 0 to 1): hot pink at the Flyers, then coral
 * and orange, to gold at the tail. A shade of 0 is the first, 1 the last.
 */
export const PALETTE: readonly (readonly [number, number, number])[] = [
  [1.0, 0.176, 0.541], // hot pink  #ff2d8a
  [1.0, 0.353, 0.373], // coral     #ff5a5f
  [1.0, 0.541, 0.122], // orange    #ff8a1f
  [1.0, 0.761, 0.102], // gold      #ffc21a
];
/** How far the colours shimmer back and forth along the stream. */
const SHIMMER = 0.035;
/**
 * How fast the colour moves along the palette with age: pieces reach orange by about 45% of the way back and gold by
 * two thirds, while they are still bright enough to see (the last third stays gold as it fades).
 */
const SHADE_RATE = 1.5;
const TAU = Math.PI * 2;

export const SHAPES = ["star", "sparkle", "dot"] as const;
export type Shape = (typeof SHAPES)[number];
const SIZE: Record<Shape, number> = { star: 0.2, sparkle: 0.24, dot: 0.07 };

export type Piece = {
  /** Stable for as long as the piece exists: the stream's slot number, or a negative number for the burst. */
  id: number;
  /** For the stream, the scroll progress it was dropped at; for the burst, when the Flyers began to spring up. */
  birth: number;
  /** 0 when just dropped, 1 at the end of its life (the tail, or the end of the burst). */
  age: number;
  burst: boolean;
  shape: Shape;
  x: number;
  y: number;
  z: number;
  /** Full width in world units. */
  size: number;
  alpha: number;
  /** Where its colour sits in PALETTE: 0 hot pink, through coral and orange, to 1 gold. */
  shade: number;
  rotation: number;
};

/** A fixed pseudo-random number in [0, 1) for slot `i`, channel `k`, so every piece always looks the same. */
function hash(i: number, k: number): number {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function shapeOf(i: number): Shape {
  const r = hash(i, 0);
  return r < 0.18 ? "dot" : r < 0.45 ? "star" : "sparkle"; // about 1 star to 2 sparkles, plus a few dots
}

/** Twinkle for piece `i` at time `clock`: 0 to 1. */
const twinkle = (i: number, clock: number) => 0.5 + 0.5 * Math.sin(clock * (2.5 + 3 * hash(i, 6)) + hash(i, 7) * TAU);

const at = new Vector3();
const ahead = new Vector3();
const dir = new Vector3();
const side = new Vector3();
const SIDE_VIEW = [0, 0, 1] as const;
const TOWARD_CAMERA = new Vector3();

/**
 * Every piece of Stardust for this scroll progress and time. Pure: the same inputs always give the same pieces.
 * `toward` is the direction to the camera (default: straight at the side view), which the stream spreads out across.
 */
export function stardustPieces(
  route: FittedRoute,
  progress: number,
  clock: number,
  pop: Span,
  toward: readonly [number, number, number] = SIDE_VIEW,
): Piece[] {
  TOWARD_CAMERA.set(toward[0], toward[1], toward[2]);
  const pieces: Piece[] = [];
  const h = route.flyerHeight;
  if (!(progress > pop.from)) return pieces;

  /* The stream. */
  const first = Math.max(Math.ceil(pop.from / SPACING), Math.ceil((progress - STARDUST_SPAN) / SPACING));
  const last = Math.floor(progress / SPACING);
  for (let i = first; i <= last; i++) {
    const birth = i * SPACING;
    const age = (progress - birth) / STARDUST_SPAN;
    if (age < 0 || age >= 1) continue;

    const p = route.poseAt(birth);
    const q = route.poseAt(birth + 0.0015);
    at.set(p.x, p.y, p.z);
    ahead.set(q.x, q.y, q.z);
    dir.subVectors(ahead, at);
    if (dir.lengthSq() < 1e-12) dir.set(1, 0, 0);
    dir.normalize();
    side.crossVectors(dir, TOWARD_CAMERA);
    if (side.lengthSq() < 1e-6) side.set(0, 1, 0);
    side.normalize();

    // Sideways: from the Flyers' own width when dropped to twice that at the tail, bunched towards the middle.
    const lateral = (hash(i, 1) + hash(i, 2) - 1) * (h * 0.5) * (1 + age);
    const along = (hash(i, 4) - 0.5) * h * 0.3;
    const depth = (hash(i, 3) * 0.45 - 0.35) * h; // mostly behind the path, so little lands on the couple's faces

    const shape = shapeOf(i);
    const tw = twinkle(i, clock);
    const fade = smoothstep(0, 0.06, age) * Math.pow(1 - age, 1.3);
    pieces.push({
      id: i,
      birth,
      age,
      burst: false,
      shape,
      x: at.x + side.x * lateral + dir.x * along,
      y: at.y + side.y * lateral + dir.y * along,
      z: at.z + side.z * lateral + dir.z * along + depth,
      size: h * SIZE[shape] * (0.6 + 0.8 * hash(i, 5)) * (1 - 0.65 * age) * (0.8 + 0.25 * tw),
      alpha: fade * (0.55 + 0.45 * tw),
      shade: Math.min(1, Math.max(0, age * SHADE_RATE + SHIMMER * Math.sin(clock * 1.6 - age * 14))),
      rotation: hash(i, 8) * TAU + clock * (hash(i, 9) - 0.5) * 1.2,
    });
  }

  /* The burst as they spring up: a ring of pink and orange sparkles flung out from where they appear. */
  const burstSpan = { from: pop.from, to: pop.from + BURST_STRETCH * (pop.to - pop.from) };
  const b = phaseOf(burstSpan, progress);
  if (b > 0 && b < 1) {
    const o = route.poseAt(pop.from);
    const reach = 1 - Math.pow(1 - b, 3);
    for (let k = 0; k < BURST_COUNT; k++) {
      const seed = 10_000 + k;
      const angle = (k / BURST_COUNT) * TAU + (hash(seed, 1) - 0.5) * 0.4;
      const radius = h * (0.15 + 1.1 * reach * (0.7 + 0.6 * hash(seed, 2)));
      const tw = twinkle(seed, clock);
      const shape: Shape = k % 3 === 0 ? "star" : "sparkle";
      pieces.push({
        id: -(k + 1),
        birth: pop.from,
        age: b,
        burst: true,
        shape,
        x: o.x + Math.cos(angle) * radius,
        y: o.y + Math.sin(angle) * radius,
        z: o.z + (hash(seed, 3) - 0.6) * h * 0.4,
        size: h * SIZE[shape] * (0.8 + 0.4 * hash(seed, 5)) * (1 - 0.5 * b) * (0.8 + 0.25 * tw),
        alpha: smoothstep(0, 0.08, b) * Math.pow(1 - b, 1.5) * (0.6 + 0.4 * tw),
        shade: k / (BURST_COUNT - 1),
        rotation: hash(seed, 8) * TAU + clock * (hash(seed, 9) - 0.5) * 2,
      });
    }
  }
  return pieces;
}

/** The colour (sRGB, 0 to 1) at `shade` along PALETTE, blending between neighbours. */
export function colourAt(shade: number): [number, number, number] {
  const f = Math.min(1, Math.max(0, shade)) * (PALETTE.length - 1);
  const i = Math.min(PALETTE.length - 2, Math.floor(f));
  const t = f - i;
  const a = PALETTE[i];
  const b = PALETTE[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/* ---------- Drawing: one draw call of point sprites, each shape drawn in the fragment shader ---------- */

const vertexShader = /* glsl */ `
attribute vec3 tint;
attribute float size;
attribute float alpha;
attribute float spin;
attribute float shape;
uniform float uScale;
varying vec3 vTint;
varying float vAlpha;
varying float vSpin;
varying float vShape;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / max(-mv.z, 0.001);
  vTint = tint;
  vAlpha = alpha;
  vSpin = spin;
  vShape = shape;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vTint;
varying float vAlpha;
varying float vSpin;
varying float vShape;

// Signed distance to a five-point star (after Inigo Quilez).
float star5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  float s = sin(vSpin);
  float k = cos(vSpin);
  c = mat2(k, -s, s, k) * c;

  float d;
  if (vShape < 0.5) {
    d = star5(c, 0.86, 0.45) - 0.04;                 // star, slightly rounded
  } else if (vShape < 1.5) {
    vec2 a = abs(c * 1.1);
    d = (pow(a.x, 0.55) + pow(a.y, 0.55) - 1.0) * 0.5; // four-point sparkle
  } else {
    d = length(c) - 0.55;                            // glitter dot
  }
  float aa = max(fwidth(d), 1e-4);
  float body = 1.0 - smoothstep(-aa, aa, d);
  float r = length(c);
  float core = (1.0 - smoothstep(0.0, 0.3, r)) * 0.6;  // the small white glow in the middle
  float halo = (1.0 - smoothstep(0.15, 1.0, r)) * 0.2; // a faint glow of its own colour around it
  vec3 colour = mix(vTint, vec3(1.0), core * body);
  float a = max(body, halo) * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(colour, a);
}
`;

export type Stardust = {
  readonly points: Points;
  /** Shapes and places every piece for this moment. `toward` is the direction to the camera. */
  update(route: FittedRoute, progress: number, clock: number, pop: Span, toward?: readonly [number, number, number]): void;
  /** The drawing buffer's height in pixels and the camera's vertical field of view in degrees, so sizes stay in world units. */
  setViewport(heightPx: number, fovDegrees: number): void;
  dispose(): void;
};

export function createStardust(): Stardust {
  const position = new Float32Array(MAX_PIECES * 3);
  const tint = new Float32Array(MAX_PIECES * 3);
  const size = new Float32Array(MAX_PIECES);
  const alpha = new Float32Array(MAX_PIECES);
  const spin = new Float32Array(MAX_PIECES);
  const shape = new Float32Array(MAX_PIECES);

  const geometry = new BufferGeometry();
  const attributes = {
    position: new BufferAttribute(position, 3),
    tint: new BufferAttribute(tint, 3),
    size: new BufferAttribute(size, 1),
    alpha: new BufferAttribute(alpha, 1),
    spin: new BufferAttribute(spin, 1),
    shape: new BufferAttribute(shape, 1),
  };
  for (const [name, attribute] of Object.entries(attributes)) geometry.setAttribute(name, attribute);
  geometry.setDrawRange(0, 0);

  const material = new ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
  });
  const points = new Points(geometry, material);
  points.name = "stardust";
  points.frustumCulled = false;

  return {
    points,

    update(route, progress, clock, pop, toward) {
      const pieces = stardustPieces(route, progress, clock, pop, toward);
      const n = Math.min(pieces.length, MAX_PIECES);
      for (let i = 0; i < n; i++) {
        const piece = pieces[i];
        position.set([piece.x, piece.y, piece.z], i * 3);
        tint.set(colourAt(piece.shade), i * 3);
        size[i] = piece.size;
        alpha[i] = piece.alpha;
        spin[i] = piece.rotation;
        shape[i] = SHAPES.indexOf(piece.shape);
      }
      for (const attribute of Object.values(attributes)) attribute.needsUpdate = true;
      geometry.setDrawRange(0, n);
    },

    setViewport(heightPx, fovDegrees) {
      material.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDegrees / 2) * (Math.PI / 180)));
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
