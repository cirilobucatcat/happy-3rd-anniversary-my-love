"use client";

import { useEffect, useRef } from "react";
import WriteOnText from "@/components/WriteOnText";
import { subscribe } from "@/lib/scroll";
import { phaseOf, type Timeline, type TimelineChapter } from "@/lib/timeline";

/** One Chapter title: it writes itself on as the Chapter begins, holds, then fades before the first Memory emerges. */
function ChapterTitle({ chapter }: { chapter: TimelineChapter }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribe((progress) => {
      const el = ref.current;
      if (!el) return;
      const written = phaseOf({ from: chapter.titleFrom, to: chapter.titleTo }, progress) > 0;
      const gone = phaseOf({ from: chapter.fadeFrom, to: chapter.fadeTo }, progress);
      const opacity = written ? 1 - gone : 0;
      el.style.opacity = String(opacity);
      el.style.visibility = opacity > 0 ? "visible" : "hidden";
    });
  }, [chapter]);

  return (
    <div className="chapter-title" ref={ref} style={{ visibility: "hidden" }}>
      <WriteOnText text={chapter.title} range={{ from: chapter.titleFrom, to: chapter.titleTo }} />
    </div>
  );
}

/**
 * The Chapter titles: fixed near the top of the screen, in front of the WebGL layer so nothing (Clouds or the Flyers)
 * ever covers one. Only one is ever showing.
 */
export default function ChapterTitles({ timeline }: { timeline: Timeline }) {
  return (
    <div className="chapter-titles" aria-hidden="true">
      {timeline.chapters.map((chapter) => (
        <ChapterTitle key={chapter.id} chapter={chapter} />
      ))}
    </div>
  );
}
