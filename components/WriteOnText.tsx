"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { PINYON } from "@/lib/fonts/pinyon";
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
  className?: string;
};

/** Font units of room round the text: the flourishes of a script overshoot its box. */
const PAD = 260;

/**
 * Handwritten text that draws itself stroke by stroke (the Write-on). The letters are always the real filled
 * letters of the script font; a hidden pen path moves along each one in writing order and uncovers it, so no pen
 * is ever shown. Reusable for Captions, Chapter titles, and the Letter's greeting and Closing line.
 */
export default function WriteOnText({ text, range, maxWidthEm, className }: Props) {
  const laid = useMemo(
    () => layoutText(text, PINYON, { maxWidth: maxWidthEm ? maxWidthEm * PINYON.unitsPerEm : undefined }),
    [text, maxWidthEm],
  );
  const lengths = useMemo(() => laid.strokes.map((s) => s.length), [laid]);
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const maskId = `wo${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    if (!range) return;
    let last = NaN;
    return subscribe((progress) => {
      const t = phaseOf(range, progress);
      if (t === last) return;
      last = t;
      strokeProgress(lengths, t).forEach((f, i) => {
        const el = paths.current[i];
        if (!el) return;
        // Hidden outright at 0: a zero-length dash with round caps would still leave a dot.
        el.style.visibility = f > 0 ? "visible" : "hidden";
        el.style.strokeDasharray = f >= 1 ? "none" : `${f} 2`;
      });
    });
  }, [range, lengths]);

  const width = laid.width + 2 * PAD;
  const height = laid.height + 2 * PAD;
  const outlines = laid.glyphs.map((g, i) => (
    <path key={i} d={g.d} transform={`translate(${g.x} ${g.y}) scale(1 -1)`} />
  ));

  return (
    <svg
      className={className}
      viewBox={`${-PAD} ${-PAD} ${width} ${height}`}
      // Sized by the em so every piece of writing has the same size letters: 1em = `--write-em`.
      style={{ width: `calc(var(--write-em, 1em) * ${(width / PINYON.unitsPerEm).toFixed(3)})`, height: "auto", overflow: "visible" }}
      role="img"
      aria-label={text}
      focusable="false"
    >
      {range ? (
        <>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={-PAD} y={-PAD} width={width} height={height}>
              <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
                {laid.strokes.map((stroke, i) => (
                  <path
                    key={i}
                    ref={(el) => {
                      paths.current[i] = el;
                    }}
                    d={strokePathData(stroke)}
                    pathLength={1}
                    strokeWidth={stroke.width}
                    // Not yet scrolled to: nothing drawn (also what the server renders).
                    style={{ visibility: "hidden", strokeDasharray: "0 2" }}
                  />
                ))}
              </g>
            </mask>
          </defs>
          <g fill="currentColor" mask={`url(#${maskId})`}>
            {outlines}
          </g>
        </>
      ) : (
        <g fill="currentColor">{outlines}</g>
      )}
    </svg>
  );
}
