/**
 * Builds lib/fonts/pinyon.ts from the Pinyon Script font file (SIL Open Font License, see lib/fonts/Pinyon-Script-OFL.txt).
 *
 *   node scripts/make-script-font.mjs path/to/PinyonScript-Regular.ttf
 *
 * Pinyon Script is an outline font: every letter is a filled shape with no pen path inside it. To make handwriting
 * that writes itself on, this script derives a pen path for each letter (rasterise, thin to a one-pixel skeleton,
 * trace it into strokes, order them left to right) and stores it next to the real outline. At runtime the filled
 * letters are revealed along that path, so what ends up on screen is always the genuine Pinyon letters.
 * It also reports any letter whose pen path leaves a noticeable share of its ink uncovered.
 */
import sharp from "sharp";
import opentype from "opentype.js";
import fs from "node:fs";
import path from "node:path";

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/make-script-font.mjs <PinyonScript-Regular.ttf>");
  process.exit(1);
}
const font = opentype.loadSync(source);
const UPM = font.unitsPerEm;
console.log("upm", UPM, "ascender", font.ascender, "descender", font.descender);

// What writing needs: letters, digits, everyday punctuation, typographic quotes and dashes, and common accents.
const CHARS = [..." !\"'(),-.:;?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"].concat([
  "’", "‘", "“", "”", "–", "—", "…",
  "é", "è", "à", "ç", "ñ", "ü", "ö", "á", "í", "ó", "ú",
]);
const SCALE = 0.45; // raster pixels per font unit

const fmt = (n) => Math.round(n);

function pathData(glyphPath) {
  let d = "";
  for (const c of glyphPath.commands) {
    if (c.type === "M") d += `M${fmt(c.x)} ${fmt(c.y)}`;
    else if (c.type === "L") d += `L${fmt(c.x)} ${fmt(c.y)}`;
    else if (c.type === "Q") d += `Q${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x)} ${fmt(c.y)}`;
    else if (c.type === "C") d += `C${fmt(c.x1)} ${fmt(c.y1)} ${fmt(c.x2)} ${fmt(c.y2)} ${fmt(c.x)} ${fmt(c.y)}`;
    else if (c.type === "Z") d += "Z";
  }
  return d;
}

// ---- Zhang-Suen thinning on a Uint8Array (1 = ink) ----
function thin(img, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : img[y * w + x]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const kill = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!img[y * w + x]) continue;
          const p2 = at(x, y - 1), p3 = at(x + 1, y - 1), p4 = at(x + 1, y), p5 = at(x + 1, y + 1);
          const p6 = at(x, y + 1), p7 = at(x - 1, y + 1), p8 = at(x - 1, y), p9 = at(x - 1, y - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let A = 0;
          for (let i = 0; i < 8; i++) if (seq[i] === 0 && seq[i + 1] === 1) A++;
          if (A !== 1) continue;
          if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
          else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          kill.push(y * w + x);
        }
      }
      if (kill.length) { changed = true; for (const i of kill) img[i] = 0; }
    }
  }
}

// ---- Distance to background (chamfer) ----
function distance(img, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = img[i] ? INF : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!d[y * w + x]) continue;
    d[y * w + x] = Math.min(d[y * w + x], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    if (!d[y * w + x]) continue;
    d[y * w + x] = Math.min(d[y * w + x], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
  }
  return d;
}

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/** Skeleton pixels -> graph of branches between nodes (endpoints / junction clusters). */
function trace(skel, w, h) {
  const idx = (x, y) => y * w + x;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && skel[idx(x, y)] === 1;
  const nbrs = (x, y) => N8.map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => on(a, b));
  const deg = new Uint8Array(w * h);
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) { deg[idx(x, y)] = nbrs(x, y).length; pts.push([x, y]); }

  // Node pixels: endpoints (deg 1) and junction clusters (deg >= 3). Cluster adjacent ones.
  const nodeOf = new Int32Array(w * h).fill(-1);
  const nodes = []; // {x,y,pix:[]}
  for (const [x, y] of pts) {
    const d = deg[idx(x, y)];
    if (d !== 1 && d < 3) continue;
    if (nodeOf[idx(x, y)] >= 0) continue;
    const id = nodes.length;
    const cluster = [];
    const stack = [[x, y]];
    nodeOf[idx(x, y)] = id;
    while (stack.length) {
      const [cx, cy] = stack.pop();
      cluster.push([cx, cy]);
      for (const [nx, ny] of nbrs(cx, cy)) {
        const dd = deg[idx(nx, ny)];
        if ((dd === 1 || dd >= 3) && nodeOf[idx(nx, ny)] < 0) { nodeOf[idx(nx, ny)] = id; stack.push([nx, ny]); }
      }
    }
    const mx = cluster.reduce((s, p) => s + p[0], 0) / cluster.length;
    const my = cluster.reduce((s, p) => s + p[1], 0) / cluster.length;
    nodes.push({ x: mx, y: my, pix: cluster, end: cluster.length === 1 && deg[idx(x, y)] === 1 });
  }

  const visited = new Uint8Array(w * h);
  const branches = []; // {a, b, pts:[[x,y]]}
  const walk = (start, first, aId) => {
    const line = [[start[0], start[1]], first];
    visited[idx(first[0], first[1])] = 1;
    let prev = start, cur = first;
    for (;;) {
      if (nodeOf[idx(cur[0], cur[1])] >= 0 && !(cur[0] === first[0] && cur[1] === first[1] && nodeOf[idx(cur[0], cur[1])] === aId && false)) {
        const bId = nodeOf[idx(cur[0], cur[1])];
        if (!(bId === aId && line.length < 3)) return { a: aId, b: bId, pts: line };
      }
      const next = nbrs(cur[0], cur[1]).filter(([x, y]) => !(x === prev[0] && y === prev[1]) && !visited[idx(x, y)] && (nodeOf[idx(x, y)] < 0 || nodeOf[idx(x, y)] !== nodeOf[idx(cur[0], cur[1])]));
      if (!next.length) return { a: aId, b: aId, pts: line };
      // prefer a node pixel (to close the branch), else the nearest orthogonal neighbour
      next.sort((p, q) => (nodeOf[idx(q[0], q[1])] >= 0) - (nodeOf[idx(p[0], p[1])] >= 0) || Math.hypot(p[0] - cur[0], p[1] - cur[1]) - Math.hypot(q[0] - cur[0], q[1] - cur[1]));
      prev = cur;
      cur = next[0];
      visited[idx(cur[0], cur[1])] = 1;
      line.push(cur);
    }
  };
  for (const node of nodes) {
    for (const [px, py] of node.pix) {
      for (const [nx, ny] of nbrs(px, py)) {
        if (nodeOf[idx(nx, ny)] === nodeOf[idx(px, py)]) continue; // inside the same cluster
        if (visited[idx(nx, ny)]) continue;
        const b = walk([px, py], [nx, ny], nodeOf[idx(px, py)]);
        branches.push(b);
      }
    }
  }
  // Pure loops with no nodes.
  for (const [x, y] of pts) {
    if (visited[idx(x, y)] || nodeOf[idx(x, y)] >= 0) continue;
    const start = [x, y];
    const first = nbrs(x, y).find(([a, b]) => !visited[idx(a, b)]);
    if (!first) { visited[idx(x, y)] = 1; branches.push({ a: -1, b: -1, pts: [[x, y], [x + 0.01, y]], dot: true }); continue; }
    visited[idx(x, y)] = 1;
    const b = walk(start, first, -1);
    b.a = b.b = -1;
    branches.push(b);
  }
  return { nodes, branches };
}

const len = (p) => { let t = 0; for (let i = 1; i < p.length; i++) t += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return t; };

function rdp(p, eps) {
  if (p.length < 3) return p;
  const [a, b] = [p[0], p[p.length - 1]];
  let maxD = 0, at = 0;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.abs(dy * p[i][0] - dx * p[i][1] + b[0] * a[1] - b[1] * a[0]) / L;
    if (d > maxD) { maxD = d; at = i; }
  }
  if (maxD <= eps) return [a, b];
  return [...rdp(p.slice(0, at + 1), eps).slice(0, -1), ...rdp(p.slice(at), eps)];
}

function chaikin(p, n) {
  let q = p;
  for (let k = 0; k < n; k++) {
    const r = [q[0]];
    for (let i = 0; i < q.length - 1; i++) {
      r.push([0.75 * q[i][0] + 0.25 * q[i + 1][0], 0.75 * q[i][1] + 0.25 * q[i + 1][1]]);
      r.push([0.25 * q[i][0] + 0.75 * q[i + 1][0], 0.25 * q[i][1] + 0.75 * q[i + 1][1]]);
    }
    r.push(q[q.length - 1]);
    q = r;
  }
  return q;
}

/** Orders branches into pen strokes: start at the leftmost end, keep going straight on at junctions, lift the pen when stuck. */
function order(graph) {
  const { nodes, branches } = graph;
  // Prune short spurs (a branch ending in a free endpoint, short compared to the glyph).
  let live = branches.filter((b) => b.pts.length > 1 || b.dot);
  for (let pass = 0; pass < 2; pass++) {
    live = live.filter((b) => {
      const aEnd = b.a >= 0 && nodes[b.a].end, bEnd = b.b >= 0 && nodes[b.b].end;
      const spur = (aEnd !== bEnd) && len(b.pts) < 9;
      return !spur;
    });
  }
  const used = new Set();
  const strokes = [];
  const endpointsOf = (b) => [b.a, b.b];
  const dirAt = (b, fromStart) => {
    const p = b.pts; const k = Math.min(8, p.length - 1);
    return fromStart ? [p[k][0] - p[0][0], p[k][1] - p[0][1]] : [p[p.length - 1 - k][0] - p[p.length - 1][0], p[p.length - 1 - k][1] - p[p.length - 1][1]];
  };
  const pos = (nodeId, b, atStart) => (nodeId >= 0 ? [nodes[nodeId].x, nodes[nodeId].y] : atStart ? b.pts[0] : b.pts[b.pts.length - 1]);
  const incident = (nodeId) => live.map((b, i) => ({ b, i })).filter(({ b, i }) => !used.has(i) && (b.a === nodeId || b.b === nodeId));

  while (used.size < live.length) {
    // Starting point: unused branch end with the smallest x, preferring a free endpoint.
    let best = null;
    live.forEach((b, i) => {
      if (used.has(i)) return;
      for (const atStart of [true, false]) {
        const id = atStart ? b.a : b.b;
        const p = pos(id, b, atStart);
        const free = id >= 0 && nodes[id].end ? 0 : 1;
        const key = free * 1000 + p[0];
        if (!best || key < best.key) best = { key, i, atStart };
      }
    });
    let { i, atStart } = best;
    let line = [];
    let dir = null;
    for (;;) {
      const b = live[i];
      used.add(i);
      const pts = atStart ? b.pts : [...b.pts].reverse();
      const nodeId = atStart ? b.b : b.a;
      line.push(...(line.length ? pts.slice(1) : pts));
      if (nodeId < 0) break;
      const cand = incident(nodeId);
      if (!cand.length) break;
      const last = line[line.length - 1];
      const heading = [last[0] - line[Math.max(0, line.length - 9)][0], last[1] - line[Math.max(0, line.length - 9)][1]];
      let pick = null;
      for (const c of cand) {
        const startsHere = c.b.a === nodeId;
        const d = dirAt(c.b, startsHere);
        const cos = (d[0] * heading[0] + d[1] * heading[1]) / ((Math.hypot(...d) * Math.hypot(...heading)) || 1);
        if (!pick || cos > pick.cos) pick = { ...c, cos, startsHere };
      }
      i = pick.i; atStart = pick.startsHere;
    }
    strokes.push(line);
  }
  return strokes;
}

const out = {};
let report = [];
for (const ch of CHARS) {
  const glyph = font.charToGlyph(ch);
  if (!glyph || glyph.index === 0) continue;
  const adv = Math.round(glyph.advanceWidth);
  const gp = glyph.getPath(0, 0, UPM); // font units scaled 1:1, y-down in opentype's output
  // opentype getPath returns y-down svg coordinates (y negated). Convert back to y-up for storage.
  const cmds = gp.commands.map((c) => ({ ...c, y: -c.y, y1: c.y1 === undefined ? undefined : -c.y1, y2: c.y2 === undefined ? undefined : -c.y2 }));
  const upPath = { commands: cmds };
  const d = pathData(upPath);
  if (!cmds.length) { out[ch] = { adv, d: "", strokes: [] }; continue; }
  const bb = gp.getBoundingBox(); // svg coords (y down)
  const pad = 30;
  const vx = bb.x1 - pad, vy = bb.y1 - pad, vw = bb.x2 - bb.x1 + 2 * pad, vh = bb.y2 - bb.y1 + 2 * pad;
  const W = Math.ceil(vw * SCALE), H = Math.ceil(vh * SCALE);
  let svgD = gp.toPathData(2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vx} ${vy} ${vw} ${vh}"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#fff"/><path d="${svgD}" fill="#000"/></svg>`;
  const { data, info } = await sharp(Buffer.from(svg)).greyscale().raw().toBuffer({ resolveWithObject: true });
  const img = new Uint8Array(info.width * info.height);
  for (let i = 0; i < img.length; i++) img[i] = data[i] < 128 ? 1 : 0;
  const dist = distance(img, info.width, info.height);
  const sk = Uint8Array.from(img);
  thin(sk, info.width, info.height);
  const graph = trace(sk, info.width, info.height);
  // Every separate blob of ink, so any the pen path misses (the dot on an i, a quote mark) can be given a dot stroke.
  const dots = [];
  {
    const seen = new Uint8Array(img.length);
    const W2 = info.width, H2 = info.height;
    for (let y0 = 0; y0 < H2; y0++) for (let x0 = 0; x0 < W2; x0++) {
      if (!img[y0 * W2 + x0] || seen[y0 * W2 + x0]) continue;
      const stack = [[x0, y0]]; seen[y0 * W2 + x0] = 1;
      const pixels = [];
      let best = [x0, y0], bestD = -1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        pixels.push(cy * W2 + cx);
        const dd = dist[cy * W2 + cx];
        if (dd > bestD) { bestD = dd; best = [cx, cy]; }
        for (const [dx, dy] of N8) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W2 || ny >= H2 || !img[ny * W2 + nx] || seen[ny * W2 + nx]) continue;
          seen[ny * W2 + nx] = 1; stack.push([nx, ny]);
        }
      }
      dots.push({ at: best, r: bestD, pixels });
    }
  }
  // Smooth the traced pixels into a pen-like curve, then drop points that no longer matter (keeps the file small).
  let strokesPx = order(graph).map((q) => rdp(chaikin(rdp(q, 2.2), 2), 1.1)).filter((q) => q.length > 1);
  const toFont = ([px, py]) => [vx + px / (info.width / vw), -(vy + py / (info.height / vh))];
  const REACH = 1.22; // the pen is a little wider than the ink it must uncover
  const strokeWidths = strokesPx.map((q) => {
    let r = 1;
    for (const [px, py] of q) {
      for (let yy = Math.round(py) - 2; yy <= Math.round(py) + 2; yy++) for (let xx = Math.round(px) - 2; xx <= Math.round(px) + 2; xx++) {
        if (xx >= 0 && yy >= 0 && xx < info.width && yy < info.height) r = Math.max(r, dist[yy * info.width + xx]);
      }
    }
    return r * REACH;
  });
  // Coverage: how much of the ink lies within the pen's reach of the derived path?
  const cover = new Uint8Array(info.width * info.height);
  strokesPx.forEach((st, si) => {
    const R = strokeWidths[si];
    for (let i = 0; i < st.length; i++) {
      const [ax, ay] = st[i]; const [bx, by] = st[Math.min(i + 1, st.length - 1)];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let t = 0; t <= steps; t++) {
        const cx = ax + ((bx - ax) * t) / steps, cy = ay + ((by - ay) * t) / steps;
        for (let yy = Math.floor(cy - R); yy <= Math.ceil(cy + R); yy++) for (let xx = Math.floor(cx - R); xx <= Math.ceil(cx + R); xx++) {
          if (xx < 0 || yy < 0 || xx >= info.width || yy >= info.height) continue;
          if ((xx - cx) ** 2 + (yy - cy) ** 2 <= R * R) cover[yy * info.width + xx] = 1;
        }
      }
    }
  });
  const discAt = (cx, cy, R) => {
    for (let yy = Math.floor(cy - R); yy <= Math.ceil(cy + R); yy++) for (let xx = Math.floor(cx - R); xx <= Math.ceil(cx + R); xx++) {
      if (xx < 0 || yy < 0 || xx >= info.width || yy >= info.height) continue;
      if ((xx - cx) ** 2 + (yy - cy) ** 2 <= R * R) cover[yy * info.width + xx] = 1;
    }
  };
  for (const blob of dots) {
    const uncovered = blob.pixels.filter((i) => !cover[i]).length / blob.pixels.length;
    if (uncovered < 0.35) continue;
    const R = blob.r * REACH + 1;
    strokesPx.push([[blob.at[0], blob.at[1]], [blob.at[0] + 0.02, blob.at[1]]]);
    strokeWidths.push(R);
    discAt(blob.at[0], blob.at[1], R);
  }
  let inkPx = 0, missed = 0;
  for (let i = 0; i < img.length; i++) if (img[i]) { inkPx++; if (!cover[i]) missed++; }
  if (missed / inkPx > 0.012) console.log("LOW COVERAGE", ch, (100 * missed / inkPx).toFixed(2) + "%");
  // Each stroke is [pen width, x0, y0, x1, y1, ...] in font units.
  const strokes = strokesPx.map((q, si) => [fmt((2 * strokeWidths[si]) / SCALE), ...q.flatMap((p) => { const f = toFont(p); return [fmt(f[0]), fmt(f[1])]; })]);
  out[ch] = { adv, d, strokes };
  report.push(`${ch}:${strokes.length}s`);
}
// Kerning for pairs in the plain alphabet.
const kern = {};
const KCH = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,'!?-"];
for (const a of KCH) for (const b of KCH) {
  const v = font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b));
  if (v) kern[a + b] = Math.round(v);
}
const target = path.join(import.meta.dirname, "..", "lib", "fonts", "pinyon.ts");
const lines = Object.entries(out).map(([ch, g]) => `  ${JSON.stringify(ch)}: { adv: ${g.adv}, d: ${JSON.stringify(g.d)}, strokes: ${JSON.stringify(g.strokes)} },`);
const ts = `// Generated by scripts/make-script-font.mjs from Pinyon Script. Do not edit by hand.
// Pinyon Script: Copyright 2024 The Pinyon Project Authors, SIL Open Font License 1.1 (see Pinyon-Script-OFL.txt).
// \`d\` is the real glyph outline (y up); each stroke is a derived pen path: [pen width, x0, y0, x1, y1, ...].
import type { ScriptFont } from "@/lib/write-on";

export const PINYON: ScriptFont = {
  unitsPerEm: ${UPM},
  ascent: ${Math.round(font.ascender)},
  descent: ${Math.round(font.descender)},
  glyphs: {
${lines.join(String.fromCharCode(10))}
  },
  kern: ${JSON.stringify(kern)},
};
`;
fs.writeFileSync(target, ts);
console.log(Object.keys(out).length, "glyphs;", Object.keys(kern).length, "kerning pairs;", (ts.length / 1024).toFixed(0), "KB ->", target);
console.log(report.join(" "));
