"use client";

import { useEffect, useRef } from "react";
import WriteOnText from "@/components/WriteOnText";
import { INTRO } from "@/content/memories";
import { subscribe } from "@/lib/scroll";
import { phaseOf, type Timeline } from "@/lib/timeline";

type Props = {
  timeline: Timeline;
  /** The gate has opened: the Intro eases in. */
  ready: boolean;
};

/**
 * The Intro: the title screen she sees as the gate fades, before How we met begins. It holds still, then fades
 * away as she scrolls into the first Chapter.
 */
export default function Intro({ timeline, ready }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribe((progress) => {
      const el = ref.current;
      if (!el) return;
      const opacity = 1 - phaseOf(timeline.introFade, progress);
      el.style.opacity = String(opacity);
      el.style.visibility = opacity > 0 ? "visible" : "hidden";
    });
  }, [timeline]);

  return (
    <div className="intro" ref={ref} aria-hidden={ready ? undefined : true}>
      <div className={`intro-inner${ready ? " intro-inner--ready" : ""}`}>
        <h1 className="intro-title">
          <WriteOnText text={INTRO.title} />
        </h1>
        <p className="intro-line">{INTRO.line}</p>
        <span className="intro-cue" aria-hidden="true" />
      </div>
    </div>
  );
}
