"use client";

import { useEffect, useRef } from "react";
import { skyLayers, stackedOpacities } from "@/lib/sky";
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

type LayerKey = "dawn" | "day" | "sunset" | "rose" | "stars";

/**
 * The Sky's colour: four gradient layers that cross-fade (opacity only) as she scrolls, and stars at the end.
 * The Clouds are not here: they live in the 3D scene (components/SkyCanvas.tsx), at their own depths.
 */
export default function Sky() {
  const layers = useRef<Record<LayerKey, HTMLDivElement | null>>({
    dawn: null,
    day: null,
    sunset: null,
    rose: null,
    stars: null,
  });

  useEffect(() => {
    return subscribe((progress) => {
      const weights = skyLayers(progress);
      const opacity = { ...stackedOpacities(weights), stars: weights.stars };
      for (const key of ["dawn", "day", "sunset", "rose", "stars"] as const) {
        const el = layers.current[key];
        if (el) el.style.opacity = String(opacity[key]);
      }
    });
  }, []);

  return (
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
    </div>
  );
}
