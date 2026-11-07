/**
 * Write-on: handwritten text that draws itself stroke by stroke as she scrolls (and undraws on the way back).
 *
 * The script font (Pinyon Script) is an outline font, so each letter also carries a derived pen path: the strokes a
 * hand would make, in order, each with the width of pen it needs (scripts/make-script-font.mjs builds them). The text
 * is always drawn as the real filled letters; the pen path decides which part of them is showing, so no pen is ever
 * visible and a finished word is exactly the font's own lettering.
 *
 * This module is pure: it lays text out (`layoutText`), says how much of each stroke is written at a given scroll
 * progress (`strokeProgress`), and has two small helpers for painting that result. The page text (SVG) and the
 * Memory Captions (canvas texture) both use it, so they write identically.
 */

export type ScriptFont = {
  unitsPerEm: number;
  ascent: number;
  /** Negative, as in the font file. */
  descent: number;
  glyphs: Record<string, {
    adv: number;
    /** The glyph's filled outline as SVG path data, in font units with y pointing up. */
    d: string;
    /** Pen strokes in writing order: [pen width, x0, y0, x1, y1, ...] in font units, y up. */
    strokes: number[][];
  }>;
  /** Extra advance between pairs of letters, keyed by the two characters. */
  kern?: Record<string, number>;
};

export type Stroke = {
  /** Flat x,y pairs in font units, y pointing down the page. */
  points: number[];
  /** Length of the polyline, in font units. */
  length: number;
  /** Width of pen that uncovers the letter under this stroke, in font units. */
  width: number;
};

/** One letter's filled outline, placed on the page: draw `d` with the origin at (x, y) and the y axis flipped. */
export type PlacedGlyph = { d: string; x: number; y: number };

export type TextStrokes = {
  strokes: Stroke[];
  glyphs: PlacedGlyph[];
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

/** Typographic characters the script font may lack, written with their plain cousins. */
const SUBSTITUTES: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
};

/** The characters of `text` the font can draw, with typographic ones swapped for plain ones where needed. */
function drawable(text: string, font: ScriptFont): string[] {
  const out: string[] = [];
  for (const raw of text) {
    if (font.glyphs[raw]) out.push(raw);
    else for (const ch of SUBSTITUTES[raw] ?? "") if (font.glyphs[ch]) out.push(ch);
  }
  return out;
}

const polylineLength = (pts: number[]) => {
  let total = 0;
  for (let i = 2; i < pts.length; i += 2) total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return total;
};

/** Lays `text` out as strokes in writing order (line by line, letter by letter), with each letter's filled outline. */
export function layoutText(text: string, font: ScriptFont, options: LayoutOptions = {}): TextStrokes {
  const lineStep = (options.lineHeight ?? 0.95) * font.unitsPerEm;
  const spaceAdv = font.glyphs[" "]?.adv ?? font.unitsPerEm * 0.3;

  const widthOf = (line: string) => {
    let width = 0;
    let prev = "";
    for (const ch of drawable(line, font)) {
      width += (font.kern?.[prev + ch] ?? 0) + font.glyphs[ch].adv;
      prev = ch;
    }
    return width;
  };

  // Greedy word wrap.
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (options.maxWidth && line && widthOf(candidate) + spaceAdv > options.maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const strokes: Stroke[] = [];
  const glyphs: PlacedGlyph[] = [];
  let width = 0;
  lines.forEach((content, row) => {
    let penX = 0;
    const baseline = font.ascent + row * lineStep;
    let prev = "";
    for (const raw of content) {
      if (raw === " ") {
        penX += spaceAdv;
        prev = "";
        continue;
      }
      for (const ch of drawable(raw, font)) {
        const glyph = font.glyphs[ch];
        penX += font.kern?.[prev + ch] ?? 0;
        if (glyph.d) glyphs.push({ d: glyph.d, x: penX, y: baseline });
        for (const [penWidth, ...flat] of glyph.strokes) {
          const points: number[] = [];
          for (let i = 0; i < flat.length; i += 2) points.push(penX + flat[i], baseline - flat[i + 1]);
          strokes.push({ points, length: polylineLength(points), width: penWidth });
        }
        penX += glyph.adv;
        prev = ch;
      }
    }
    width = Math.max(width, penX);
  });

  return {
    strokes,
    glyphs,
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
