"use client";

import { useEffect, useRef } from "react";
import { debugStats, subscribe } from "@/lib/scroll";
import { relaxedSeconds, type Timeline } from "@/lib/timeline";

/** 248 seconds as "4:08". Rounds the whole duration first, so 179.6 seconds is "3:00", never "2:60". */
const formatMinutes = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** `?debug`: live progress, how many ScrollTriggers and ticker callbacks exist, and how long a relaxed pass takes. */
export default function DebugOverlay({ timeline }: { timeline: Timeline }) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pace = `${timeline.scrollScreens.toFixed(1)} screens, about ${formatMinutes(relaxedSeconds(timeline))} at a relaxed pace`;
    return subscribe((progress) => {
      const { triggers, tickerCallbacks } = debugStats();
      if (ref.current) {
        ref.current.textContent = `progress ${progress.toFixed(3)}\nScrollTriggers ${triggers}\nticker callbacks ${tickerCallbacks}\n${pace}`;
      }
    });
  }, [timeline]);

  return <pre ref={ref} className="debug" aria-hidden="true" />;
}
