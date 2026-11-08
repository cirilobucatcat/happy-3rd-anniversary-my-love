/**
 * The Letter: what shows on the cream card at each point of the scroll. Everything here is a pure function of scroll
 * progress, so scrolling back undoes it exactly.
 *
 * The order is fixed: the card rises, the greeting writes itself on, the body comes in line by line, and the Closing
 * line writes itself last. At the end of the scroll all of it is showing, so the Closing line stays on screen.
 */
import { phaseOf, type LetterSpans } from "@/lib/timeline";

export type LetterContent = {
  /** Written on with the Write-on, e.g. "My love,". */
  greeting: string;
  /** Paragraphs of the body, which appears line by line. */
  body: readonly string[];
  /** The line that ends the site, written on last: "Happy 3rd anniversary, my love.". */
  closing: string;
};

export type LetterView = {
  /** How far the card has risen into place (0 to 1). */
  card: number;
  /** How much of the greeting is written (0 to 1). */
  greeting: number;
  /** How much of each body line is in (0 to 1), one entry per line, in order. */
  lines: number[];
  /** How much of the Closing line is written (0 to 1). */
  closing: number;
};

/** Words in the body of the Letter. A longer Letter gets more scroll (see lib/timeline.ts). */
export function letterWords(letter: LetterContent): number {
  return letter.body.reduce((sum, paragraph) => sum + paragraph.split(/\s+/).filter(Boolean).length, 0);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Lines come in one after another: line `i` is in the `i`-th `1/count` of the body's stretch. */
function lineReveal(count: number, t: number): number[] {
  return Array.from({ length: count }, (_, i) => smooth(Math.min(1, Math.max(0, t * count - i))));
}

/** What the Letter shows at `progress`, for a body that has `lineCount` lines at the current screen size. */
export function letterView(spans: LetterSpans, progress: number, lineCount: number): LetterView {
  return {
    card: phaseOf(spans.card, progress),
    greeting: phaseOf(spans.greeting, progress),
    lines: lineReveal(lineCount, phaseOf(spans.body, progress)),
    closing: phaseOf(spans.closing, progress),
  };
}

/**
 * How far to slide the Letter's text up so the newest piece stays inside the card, for a Letter too long to fit.
 * `bottoms` is where each piece ends (greeting, each line, Closing line) in pixels from the top of the text, in
 * order; `reveals` is how much of each is in. The newest piece counts only as far as it has come in, so the text
 * slides up smoothly rather than jumping a line at a time.
 */
export function liftFor(bottoms: readonly number[], reveals: readonly number[], windowHeight: number, margin = 0): number {
  let newest = -1;
  for (let i = reveals.length - 1; i >= 0; i--) {
    if (reveals[i] > 0) {
      newest = i;
      break;
    }
  }
  if (newest < 0) return 0;
  const before = newest > 0 ? bottoms[newest - 1] : 0;
  const bottom = before + (bottoms[newest] - before) * reveals[newest];
  return Math.max(0, bottom + margin - windowHeight);
}
