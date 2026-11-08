"use client";

import { useEffect, useMemo, useRef } from "react";
import { ANNIVERSARY, DAY_ONE } from "@/content/memories";
import { dayCounter, formatDayNumber } from "@/lib/days";
import { subscribe } from "@/lib/scroll";
import type { Timeline } from "@/lib/timeline";

/**
 * The HUD: the Day counter (which climbs from Day 1 to the Anniversary's day number, and is not shown during How we
 * met, which comes before Day 1) and a thin progress cue along the top edge showing how far through the story she is.
 * Both come from the dates in content/memories.ts, so there is nothing else to edit when Day 1 changes.
 */
export default function Hud({ timeline }: { timeline: Timeline }) {
  const counter = useMemo(
    () =>
      dayCounter({
        dayOne: DAY_ONE,
        anniversary: ANNIVERSARY,
        chapters: timeline.chapters.map((c) => ({ from: c.from, date: c.date })),
        end: timeline.chapters[timeline.chapters.length - 1].to,
      }),
    [timeline],
  );
  const day = useRef<HTMLDivElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let shown: number | null | undefined;
    return subscribe((progress) => {
      if (fill.current) fill.current.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
      const today = counter(progress);
      if (today === shown) return;
      shown = today;
      if (day.current) day.current.style.opacity = today === null ? "0" : "1";
      if (number.current && today !== null) number.current.textContent = formatDayNumber(today);
    });
  }, [counter]);

  return (
    <div className="hud" aria-hidden="true">
      <div className="hud-cue">
        <div className="hud-cue-fill" ref={fill} />
      </div>
      <div className="hud-day" ref={day} style={{ opacity: 0 }}>
        <span className="hud-day-label">Day</span>
        <span className="hud-day-number" ref={number}>
          1
        </span>
      </div>
    </div>
  );
}
