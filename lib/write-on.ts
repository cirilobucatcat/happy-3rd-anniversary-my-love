/**
 * Write-on: handwritten text that draws itself stroke by stroke as she scrolls (and undraws on the way back).
 *
 * A single-line script font stores every letter as pen strokes, so there is a real order to draw them in and no
 * pen is ever shown. This module is pure: it lays text out as strokes (`layoutText`), says how much of each stroke
 * is written at a given scroll progress (`strokeProgress`), and has two small helpers for painting that result.
 * The page text (SVG) and the Memory Captions (canvas texture) both use it, so they write identically.
 */

export type StrokeFont = {
  unitsPerEm: number;
  ascent: number;
  /** Negative, as in the font file. */
  descent: number;
  glyphs: Record<string, { adv: number; strokes: number[][] }>;
};

export type Stroke = {
  /** Flat x,y pairs in font units, y pointing down the page. */
  points: number[];
  /** Length of the polyline, in font units. */
  length: number;
};

export type TextStrokes = {
  strokes: Stroke[];
  /** Size of the laid-out text in font units. */
  width: number;
  height: number;
  totalLength: number;
  unitsPerEm: number;
};

export type LayoutOptions = {
  /** Wrap onto new lines so no line is wider than this (font units). */
  maxWidth?: number;
  /** Distance between baselines as a share of the em (default 0.95). */
  lineHeight?: number;
};

/** Typographic characters the script font lacks, written with their plain cousins. */
const SUBSTITUTES: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
};

function glyphsFor(text: string, font: StrokeFont) {
  const out: StrokeFont["glyphs"][string][] = [];
  for (const raw of text) {
    for (const ch of SUBSTITUTES[raw] ?? raw) {
      const glyph = font.glyphs[ch];
      if (glyph) out.push(glyph);
    }
  }
  return out;
}

const polylineLength = (pts: number[]) => {
  let total = 0;
  for (let i = 2; i < pts.length; i += 2) total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return total;
};

/** Lays `text` out as strokes in writing order (line by line, letter by letter). */
export function layoutText(text: string, font: StrokeFont, options: LayoutOptions = {}): TextStrokes {
  const lineStep = (options.lineHeight ?? 0.95) * font.unitsPerEm;
  const spaceAdv = font.glyphs[" "]?.adv ?? font.unitsPerEm * 0.3;
  const widthOf = (word: string) => glyphsFor(word, font).reduce((sum, g) => sum + g.adv, 0);

  // Greedy word wrap.
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (options.maxWidth && line && widthOf(candidate) > options.maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const strokes: Stroke[] = [];
  let width = 0;
  lines.forEach((content, row) => {
    let penX = 0;
    const baseline = font.ascent + row * lineStep;
    for (const raw of content) {
      if (raw === " ") {
        penX += spaceAdv;
        continue;
      }
      for (const ch of SUBSTITUTES[raw] ?? raw) {
        const glyph = font.glyphs[ch];
        if (!glyph) continue;
        for (const s of glyph.strokes) {
          const points: number[] = [];
          for (let i = 0; i < s.length; i += 2) points.push(penX + s[i], baseline - s[i + 1]);
          strokes.push({ points, length: polylineLength(points) });
        }
        penX += glyph.adv;
      }
    }
    width = Math.max(width, penX);
  });

  return {
    strokes,
    width,
    height: lines.length ? font.ascent - font.descent + (lines.length - 1) * lineStep : 0,
    totalLength: strokes.reduce((sum, s) => sum + s.length, 0),
    unitsPerEm: font.unitsPerEm,
  };
}

/**
 * How much of each stroke is written at `progress` (0 to 1): strokes are drawn one after another at an even pen
 * speed, so each one finishes before the next begins. A pure function of progress, so scrolling back undraws them.
 */
export function strokeProgress(lengths: readonly number[], progress: number): number[] {
  const total = lengths.reduce((sum, n) => sum + n, 0);
  const p = Math.min(1, Math.max(0, progress));
  let written = p * total;
  return lengths.map((len) => {
    if (len <= 0) return p > 0 ? 1 : 0;
    const f = Math.min(1, Math.max(0, written / len));
    written -= len;
    return f;
  });
}

/** The first `fraction` of a polyline (by length) as flat x,y pairs, for painting a half-written stroke. */
export function partialPoints(stroke: Stroke, fraction: number): number[] {
  if (fraction >= 1) return stroke.points;
  if (fraction <= 0) return [];
  const pts = stroke.points;
  let left = stroke.length * fraction;
  const out = [pts[0], pts[1]];
  for (let i = 2; i < pts.length; i += 2) {
    const seg = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (seg >= left) {
      const t = seg > 0 ? left / seg : 0;
      out.push(pts[i - 2] + (pts[i] - pts[i - 2]) * t, pts[i - 1] + (pts[i + 1] - pts[i - 1]) * t);
      return out;
    }
    left -= seg;
    out.push(pts[i], pts[i + 1]);
  }
  return out;
}

/** SVG path data for a whole stroke (used with `pathLength` and dash offsets by the page text). */
export function strokePathData(stroke: Stroke): string {
  const p = stroke.points;
  let d = `M${p[0]} ${p[1]}`;
  for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
  return d;
}
