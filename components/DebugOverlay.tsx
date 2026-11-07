"use client";

import { useEffect, useRef } from "react";
import { debugStats, subscribe } from "@/lib/scroll";

/** `?debug`: live progress plus how many ScrollTriggers and ticker callbacks exist. */
export default function DebugOverlay() {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    return subscribe((progress) => {
      const { triggers, tickerCallbacks } = debugStats();
      if (ref.current) {
        ref.current.textContent = `progress ${progress.toFixed(3)}\nScrollTriggers ${triggers}\nticker callbacks ${tickerCallbacks}`;
      }
    });
  }, []);

  return <pre ref={ref} className="debug" aria-hidden="true" />;
}
