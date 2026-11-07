"use client";

import { useEffect, useRef } from "react";
import { skyLayers } from "@/lib/sky";
import { subscribe } from "@/lib/scroll";

/**
 * Deterministic star field. Integer-only maths (mulberry32) and rounded output, so the
 * server and the browser render byte-identical markup (no hydration mismatch).
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

const STARS = (() => {
  const rand = mulberry32(2027);
  return Array.from({ length: 70 }, () => ({
    left: round(rand() * 100),
    top: round(rand() * 70),
    size: round(1.5 + rand() * 2.5),
    delay: round(rand() * 4),
  }));
})();

/** Soft clouds placed across a layer twice as wide as the screen. */
const CLOUDS = {
  far: [
    { left: 4, top: 10, w: 22 },
    { left: 30, top: 28, w: 18 },
    { left: 55, top: 8, w: 24 },
    { left: 78, top: 30, w: 20 },
  ],
  mid: [
    { left: 10, top: 40, w: 28 },
    { left: 42, top: 18, w: 26 },
    { left: 70, top: 52, w: 30 },
  ],
  near: [
    { left: 20, top: 72, w: 36 },
    { left: 62, top: 60, w: 40 },
  ],
} as const;

/** Layer drift as a percent of its own (200vw) width over the whole scroll. Nearer = faster. */
const DRIFT = { far: 5, mid: 12, near: 26 } as const;

type Depth = keyof typeof CLOUDS;
type LayerKey = "dawn" | "day" | "sunset" | "rose" | "stars";

function CloudLayer({ depth, refCb }: { depth: Depth; refCb: (el: HTMLDivElement | null) => void }) {
  return (
    <div className={`cloud-layer cloud-layer--${depth}`} ref={refCb}>
      {CLOUDS[depth].map((c, i) => (
        <span key={i} className="cloud" style={{ left: `${c.left}%`, top: `${c.top}%`, width: `${c.w}%` }} />
      ))}
    </div>
  );
}

export default function Sky() {
  const layers = useRef<Record<LayerKey, HTMLDivElement | null>>({
    dawn: null,
    day: null,
    sunset: null,
    rose: null,
    stars: null,
  });
  const clouds = useRef<Record<Depth, HTMLDivElement | null>>({ far: null, mid: null, near: null });

  useEffect(() => {
    return subscribe((progress) => {
      const s = skyLayers(progress);
      for (const key of ["dawn", "day", "sunset", "rose", "stars"] as const) {
        const el = layers.current[key];
        if (el) el.style.opacity = String(s[key]);
      }
      for (const depth of ["far", "mid", "near"] as const) {
        const el = clouds.current[depth];
        if (el) el.style.transform = `translate3d(${-progress * DRIFT[depth]}%, 0, 0)`;
      }
    });
  }, []);

  return (
    <>
      <div className="sky" aria-hidden="true">
        <div className="sky-layer sky-dawn" ref={(el) => { layers.current.dawn = el; }} />
        <div className="sky-layer sky-day" ref={(el) => { layers.current.day = el; }} style={{ opacity: 0 }} />
        <div className="sky-layer sky-sunset" ref={(el) => { layers.current.sunset = el; }} style={{ opacity: 0 }} />
        <div className="sky-layer sky-rose" ref={(el) => { layers.current.rose = el; }} style={{ opacity: 0 }} />
        <div className="stars" ref={(el) => { layers.current.stars = el; }} style={{ opacity: 0 }}>
          {STARS.map((s, i) => (
            <span
              key={i}
              className="star"
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
            />
          ))}
        </div>
        <CloudLayer depth="far" refCb={(el) => { clouds.current.far = el; }} />
        <CloudLayer depth="mid" refCb={(el) => { clouds.current.mid = el; }} />
      </div>
      {/* Near wisps sit in front of the Memories. */}
      <div className="sky-front" aria-hidden="true">
        <CloudLayer depth="near" refCb={(el) => { clouds.current.near = el; }} />
      </div>
    </>
  );
}
