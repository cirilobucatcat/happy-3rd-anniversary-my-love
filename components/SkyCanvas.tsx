"use client";

import { useEffect, useRef, useState } from "react";
import type { Memory } from "@/content/memories";
import { subscribe } from "@/lib/scroll";
import { createStage } from "@/lib/scene";
import type { Timeline } from "@/lib/timeline";

type Props = {
  memories: readonly Memory[];
  timeline: Timeline;
  /** Called if WebGL turns out to be unavailable, so the page can fall back to the plain list. */
  onUnavailable: () => void;
};

/** After this many fresh Stages in a row that also lost their context for good, give up and show the plain list. */
const MAX_REBUILDS = 2;
/** A rebuilt Stage that has kept its context this long (milliseconds) counts as healthy. */
const HEALTHY_AFTER_MS = 30_000;

/**
 * The fixed, transparent WebGL layer: Clouds, Memories and the Flyers. Browser only (Experience loads it with
 * ssr: false). Pointer input is read from the window, so the canvas itself never gets in the way of scrolling.
 */
export default function SkyCanvas({ memories, timeline, onUnavailable }: Props) {
  const host = useRef<HTMLDivElement>(null);
  // How many times in a row the browser took the WebGL context and never gave it back, so a new Stage was made. A new
  // Stage that keeps its context for HEALTHY_AFTER_MS resets it, so losses hours apart never add up to the plain list.
  const failures = useRef(0);
  // Changing this re-runs the effect below, which disposes the dead Stage and builds a fresh one.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const stage = createStage(el, {
      memories,
      timeline,
      onContextFailed: () => {
        if (failures.current < MAX_REBUILDS) {
          failures.current += 1;
          setGeneration((g) => g + 1);
        } else {
          onUnavailable();
        }
      },
    });
    if (!stage) {
      onUnavailable();
      return;
    }
    const healthy = window.setTimeout(() => {
      failures.current = 0;
    }, HEALTHY_AFTER_MS);

    const resize = () => stage.resize(el.clientWidth, el.clientHeight);
    resize();
    // Watching the element (not the window) also catches the phone toolbar collapsing.
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const unsubscribe = subscribe((progress, dt) => stage.update(progress, dt));

    const toNdc = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) };
    };
    // Hover is a mouse thing; on a phone the same Wiggle comes from a tap (which is a click).
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const { x, y } = toNdc(e);
      stage.pointerMove(x, y);
    };
    const onClick = (e: MouseEvent) => {
      const { x, y } = toNdc(e);
      stage.tap(x, y);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("click", onClick, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("click", onClick);
      window.clearTimeout(healthy);
      unsubscribe();
      observer.disconnect();
      stage.dispose();
    };
  }, [memories, timeline, onUnavailable, generation]);

  return <div ref={host} className="stage" aria-hidden="true" />;
}
