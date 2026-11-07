"use client";

import { useEffect, useMemo, useRef } from "react";
import { ALLURE } from "@/lib/fonts/allure";
import { subscribe } from "@/lib/scroll";
import type { Span } from "@/lib/timeline";
import { phaseOf } from "@/lib/timeline";
import { layoutText, strokePathData, strokeProgress } from "@/lib/write-on";

type Props = {
  text: string;
  /**
   * Write the text on as scroll progress crosses this span (0 to 1 of the whole story); it undraws on the way back.
   * Leave it out for text that is simply shown in full (the plain list of Memories).
   */
  range?: Span;
  /** Wrap onto new lines at this width, in em (default: one line). */
  maxWidthEm?: number;
  /** Pen thickness as a share of the em (default 0.035). */
  weight?: number;
  className?: string;
};

const PAD = 60; // font units of room round the text: cursive loops overshoot the box

/**
 * Handwritten text that draws itself stroke by stroke (the Write-on). Each stroke of each letter is an SVG path
 * that is revealed in writing order with no pen shown. Reusable for Captions, Chapter titles, and the Letter's
 * greeting and Closing line.
 */
export default function WriteOnText({ text, range, maxWidthEm, weight = 0.035, className }: Props) {
  const laid = useMemo(
    () => layoutText(text, ALLURE, { maxWidth: maxWidthEm ? maxWidthEm * ALLURE.unitsPerEm : undefined }),
    [text, maxWidthEm],
  );
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const lengths = useMemo(() => laid.strokes.map((s) => s.length), [laid]);

  useEffect(() => {
    if (!range) return;
    let last = NaN;
    const apply = (t: number) => {
      const reveal = strokeProgress(lengths, t);
      reveal.forEach((f, i) => {
        const el = paths.current[i];
        if (!el) return;
        // Hidden outright at 0: a zero-length dash with round caps would still leave a dot.
        el.style.visibility = f > 0 ? "visible" : "hidden";
        el.style.strokeDasharray = f >= 1 ? "none" : `${f} 2`;
      });
    };
    return subscribe((progress) => {
      const t = phaseOf(range, progress);
      if (t === last) return;
      last = t;
      apply(t);
    });
  }, [range, lengths]);

  const width = laid.width + 2 * PAD;
  const height = laid.height + 2 * PAD;
  return (
    <svg
      className={className}
      viewBox={`${-PAD} ${-PAD} ${width} ${height}`}
      // Sized by the em so every piece of writing has the same size letters: 1em = `--write-em`.
      style={{ width: `calc(var(--write-em, 1em) * ${(width / ALLURE.unitsPerEm).toFixed(3)})`, height: "auto", overflow: "visible" }}
      role="img"
      aria-label={text}
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth={weight * ALLURE.unitsPerEm} strokeLinecap="round" strokeLinejoin="round">
        {laid.strokes.map((stroke, i) => (
          <path
            key={i}
            ref={(el) => {
              paths.current[i] = el;
            }}
            d={strokePathData(stroke)}
            pathLength={1}
            // Not yet scrolled to: nothing drawn (also what the server renders). Without a range: all of it.
            style={range ? { visibility: "hidden", strokeDasharray: "0 2" } : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
