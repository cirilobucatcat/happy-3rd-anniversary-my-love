"use client";

import { useEffect, useRef } from "react";
import { subscribe } from "@/lib/scroll";
import { createFlyersScene } from "@/lib/scene";

/** The fixed, transparent WebGL layer with the Flyers. Browser only: Experience loads it with ssr: false. */
export default function FlyersCanvas() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const scene = createFlyersScene(el);
    if (!scene) return; // no WebGL: the page simply has no Flyers (see the fallbacks ticket)

    const resize = () => scene.resize(el.clientWidth, el.clientHeight);
    resize();
    // Watching the element (not the window) also catches the phone toolbar collapsing.
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const unsubscribe = subscribe((progress, dt) => scene.update(progress, dt));

    return () => {
      unsubscribe();
      observer.disconnect();
      scene.dispose();
    };
  }, []);

  return <div ref={host} className="flyers" aria-hidden="true" />;
}
