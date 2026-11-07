"use client";

import { useEffect, useMemo, useRef } from "react";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { baseTilt, revealState } from "@/lib/memory-motion";
import { onLayout, subscribe } from "@/lib/scroll";

/** Document-space top of an element, ignoring any transform (walks the offsetParent chain). */
function documentTop(el: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

type Measure = { top: number; height: number };

export default function Memories() {
  const memories = useMemo(() => layoutMemories(CHAPTERS), []);
  const frames = useRef<(HTMLElement | null)[]>([]);
  const measures = useRef<Measure[]>([]);
  const view = useRef({ vh: 0, docHeight: 0 });

  useEffect(() => {
    const measure = () => {
      view.current.vh = window.innerHeight;
      view.current.docHeight = document.documentElement.scrollHeight;
      measures.current = frames.current.map((el) =>
        el ? { top: documentTop(el), height: el.offsetHeight } : { top: 0, height: 0 },
      );
    };
    measure();
    const offLayout = onLayout(measure);

    const offTick = subscribe((progress) => {
      const { vh, docHeight } = view.current;
      const scrollY = progress * Math.max(0, docHeight - vh);
      memories.forEach((m, i) => {
        const el = frames.current[i];
        const box = measures.current[i];
        if (!el || !box) return;
        const r = revealState({ top: box.top, height: box.height, scrollY, viewportHeight: vh, side: m.side });
        el.style.opacity = String(r.opacity);
        el.style.transform = `translate3d(${r.x}px, ${r.y}px, 0) rotate(${baseTilt(i) + r.rotate}deg)`;
      });
    });

    return () => {
      offTick();
      offLayout();
    };
  }, [memories]);

  return (
    <main className="memories">
      {memories.map((m, i) => (
        <section key={`${m.src}-${i}`} className={`memory memory--${m.side}`} data-chapter={m.chapterId}>
          <figure
            className="frame"
            ref={(el) => {
              frames.current[i] = el;
            }}
            style={{ transform: `rotate(${baseTilt(i)}deg)` }}
          >
            {/* Plain img: the Next image optimizer is not available with static export. */}
            <img className="photo" src={m.src} alt={m.caption} loading="lazy" decoding="async" style={{ aspectRatio: m.ratio }} />
            <figcaption className="caption">{m.caption}</figcaption>
          </figure>
        </section>
      ))}
    </main>
  );
}
