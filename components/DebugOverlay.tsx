"use client";

import { useEffect, useRef } from "react";
import { debugStats, subscribe } from "@/lib/scroll";
import { relaxedSeconds, type Timeline } from "@/lib/timeline";

/** 248 seconds as "4:08". Rounds the whole duration first, so 179.6 seconds is "3:00", never "2:60". */
const formatMinutes = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * `?debug`: live progress, how many ScrollTriggers and ticker callbacks exist, how long a relaxed pass takes, and the
 * frame rate (smoothed over about a second), which is the number to watch when scrolling on a real phone. iPhone Safari
 * does not let a page read its own memory use, so there is no memory line.
 */
export default function DebugOverlay({ timeline }: { timeline: Timeline }) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pace = `${timeline.scrollScreens.toFixed(1)} screens, about ${formatMinutes(relaxedSeconds(timeline))} at a relaxed pace`;
    let fps = 0;
    return subscribe((progress, dt) => {
      if (dt > 0) fps = fps === 0 ? 1 / dt : fps * 0.95 + (1 / dt) * 0.05;
      const { triggers, tickerCallbacks } = debugStats();
      if (ref.current) {
        ref.current.textContent = `progress ${progress.toFixed(3)}\nframes per second ${Math.round(fps)}\nScrollTriggers ${triggers}\nticker callbacks ${tickerCallbacks}\n${pace}`;
      }
    });
  }, [timeline]);

  return <pre ref={ref} className="debug" aria-hidden="true" />;
}
