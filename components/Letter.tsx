"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import WriteOnText from "@/components/WriteOnText";
import { LETTER } from "@/content/memories";
import { PINYON } from "@/lib/fonts/pinyon";
import { letterView, liftFor } from "@/lib/letter";
import { subscribe } from "@/lib/scroll";
import type { Timeline } from "@/lib/timeline";
import { layoutText } from "@/lib/write-on";

/**
 * Body lines wrap at this many ems. The card sizes its letters from its own width (see `.letter-card` in
 * globals.css: one em is the card's inner width divided by a little more than this), so the same lines fit a phone
 * and a laptop, and only the size of the letters changes.
 */
const BODY_EM = 11.2;

/** The Closing line is written larger than the body and wraps at this many (larger) ems: "Happy 3rd anniversary," then "my love.". */
const CLOSING_EM = 10.2;

/** What a screen reader calls the Letter. */
const LETTER_LABEL = "A letter for you";

/** Room round each paragraph's drawing, in font units: script flourishes overshoot their box. */
const PAD_X = 140;
const PAD_Y = 80;
/** Where a line visually ends below its baseline, as a share of the em (used to know when a line has fully arrived). */
const BELOW_BASELINE = 0.5;
/** Room kept under the newest line when a long Letter slides up, in pixels. */
const LIFT_MARGIN = 18;

/** One paragraph of the body laid out as lines of real Pinyon letters. */
function useParagraphs() {
  return useMemo(() => {
    const laid = LETTER.body.map((text) => layoutText(text, PINYON, { maxWidth: BODY_EM * PINYON.unitsPerEm }));
    // Global line numbers, so lines can come in one after another across paragraphs.
    let first = 0;
    const paragraphs = laid.map((text, index) => {
      const start = first;
      first += text.rows;
      const rows = Array.from({ length: text.rows }, (_, row) => ({
        index: start + row,
        glyphs: text.glyphs.filter((g) => g.row === row),
      }));
      return { index, text, rows, width: text.width + 2 * PAD_X, height: text.height + 2 * PAD_Y };
    });
    return { paragraphs, lineCount: first };
  }, []);
}

/**
 * The Letter on a cream paper card, in the deep-rose Sky. The card rises, the greeting writes itself on, the body
 * comes in line by line in the same script, and the Closing line writes itself last and stays on screen. A Letter
 * too long to fit slides up inside the card so the newest line is always in view. It sits in the top of the screen,
 * above where the Flyers settle: lib/route.ts ends them about three quarters of the way down, and `.letter-window` in
 * globals.css keeps the card's bottom edge well above that. Change one and look at the other.
 */
export default function Letter({ timeline }: { timeline: Timeline }) {
  const { paragraphs, lineCount } = useParagraphs();

  const card = useRef<HTMLDivElement>(null);
  const textWindow = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const greeting = useRef<HTMLDivElement>(null);
  const closing = useRef<HTMLDivElement>(null);
  const svgs = useRef<(SVGSVGElement | null)[]>([]);
  const lines = useRef<(SVGGElement | null)[]>([]);
  /** Where each piece ends (greeting, every line, Closing line), in pixels from the top of the text. */
  const bottoms = useRef<number[]>([]);
  const windowHeight = useRef(0);

  // Measure where each piece ends, now and whenever the card changes size (rotation, the phone toolbar, a resize).
  useLayoutEffect(() => {
    const measure = () => {
      const col = column.current;
      if (!col || !textWindow.current) return;
      const top = col.getBoundingClientRect().top;
      const bottomOf = (el: Element | null) => (el ? el.getBoundingClientRect().bottom - top : 0);
      const out: number[] = [bottomOf(greeting.current)];
      paragraphs.forEach((p, i) => {
        const svg = svgs.current[i];
        if (!svg) return;
        const box = svg.getBoundingClientRect();
        const scale = box.height / p.height;
        for (let row = 0; row < p.text.rows; row++) {
          const baseline = PAD_Y + PINYON.ascent + row * p.text.lineStep;
          out.push(box.top - top + (baseline + BELOW_BASELINE * PINYON.unitsPerEm) * scale);
        }
      });
      out.push(bottomOf(closing.current));
      bottoms.current = out;
      windowHeight.current = textWindow.current.clientHeight;
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (textWindow.current) observer.observe(textWindow.current);
    if (column.current) observer.observe(column.current);
    return () => observer.disconnect();
  }, [paragraphs]);

  useEffect(() => {
    let last = "";
    return subscribe((progress) => {
      const view = letterView(timeline.letter, progress, lineCount);
      const el = card.current;
      if (!el) return;

      el.style.opacity = String(view.card);
      el.style.visibility = view.card > 0 ? "visible" : "hidden";
      el.style.transform = `translateY(${((1 - view.card) * 44).toFixed(1)}px) rotate(-0.6deg)`;

      const reveals = [view.greeting, ...view.lines, view.closing];
      const lift = liftFor(bottoms.current, reveals, windowHeight.current, LIFT_MARGIN);
      const key = `${view.card.toFixed(3)}|${reveals.map((r) => r.toFixed(3)).join(",")}|${lift.toFixed(1)}`;
      if (key === last) return;
      last = key;

      view.lines.forEach((reveal, i) => {
        const g = lines.current[i];
        if (!g) return;
        g.style.opacity = String(reveal);
        // Each line rises a little as it comes in (in font units, since this is an SVG transform).
        g.style.transform = `translateY(${((1 - reveal) * 0.55 * PINYON.unitsPerEm).toFixed(0)}px)`;
      });
      if (column.current) column.current.style.transform = `translateY(${(-lift).toFixed(1)}px)`;
    });
  }, [timeline, lineCount]);

  return (
    <div className="letter" aria-label={LETTER_LABEL} role="region">
      <div className="letter-card" ref={card} style={{ opacity: 0, visibility: "hidden" }}>
        <div className="letter-window" ref={textWindow}>
          <div className="letter-column" ref={column}>
            <div className="letter-greeting" ref={greeting}>
              <WriteOnText text={LETTER.greeting} range={timeline.letter.greeting} maxWidthEm={8} />
            </div>
            <div className="letter-body">
              {paragraphs.map((p, i) => (
                <svg
                  key={i}
                  ref={(el) => {
                    svgs.current[i] = el;
                  }}
                  className="letter-paragraph"
                  viewBox={`${-PAD_X} ${-PAD_Y} ${p.width} ${p.height}`}
                  style={{ width: `calc(var(--write-em) * ${(p.width / PINYON.unitsPerEm).toFixed(3)})`, height: "auto", overflow: "visible" }}
                  role="img"
                  aria-label={LETTER.body[i]}
                  focusable="false"
                >
                  {p.rows.map((row) => (
                    <g
                      key={row.index}
                      ref={(el) => {
                        lines.current[row.index] = el;
                      }}
                      fill="currentColor"
                      style={{ opacity: 0 }}
                    >
                      {row.glyphs.map((g, k) => (
                        <path key={k} d={g.d} transform={`translate(${g.x} ${g.y}) scale(1 -1)`} />
                      ))}
                    </g>
                  ))}
                </svg>
              ))}
            </div>
            <div className="letter-closing" ref={closing}>
              <WriteOnText text={LETTER.closing} range={timeline.letter.closing} maxWidthEm={CLOSING_EM} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The same Letter as plain, finished text, for the list that replaces the animated Sky (no WebGL, or reduced
 * motion). Nothing writes or slides; it is simply all there.
 */
export function LetterPlain() {
  return (
    <section className="letter-plain" aria-label={LETTER_LABEL}>
      <div className="letter-card letter-card--plain">
        <div className="letter-window letter-window--plain">
          <div className="letter-greeting">
            <WriteOnText text={LETTER.greeting} maxWidthEm={8} />
          </div>
          <div className="letter-body">
            {LETTER.body.map((paragraph, i) => (
              <WriteOnText key={i} text={paragraph} maxWidthEm={BODY_EM} className="letter-paragraph" />
            ))}
          </div>
          <div className="letter-closing">
            <WriteOnText text={LETTER.closing} maxWidthEm={CLOSING_EM} />
          </div>
        </div>
      </div>
    </section>
  );
}
