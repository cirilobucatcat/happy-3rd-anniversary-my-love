"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { REDUCED_MOTION_QUERY, prefersReducedMotion, webglAvailable } from "@/lib/capabilities";
import { parseStartProgress, refreshScroll, startScroll } from "@/lib/scroll";
import { buildTimeline } from "@/lib/timeline";
import Sky from "@/components/Sky";
import ChapterTitles from "@/components/ChapterTitles";
import { PlainList, Spacers } from "@/components/Memories";
import DebugOverlay from "@/components/DebugOverlay";

// WebGL only exists in the browser, so this never renders on the server.
const SkyCanvas = dynamic(() => import("@/components/SkyCanvas"), { ssr: false });

/**
 * `pending` is what the server renders and the first client render shows, before we know what the device can do.
 * `stage` is the animated 3D Sky; `list` is the plain stacked list of Memories (no WebGL, or reduced motion).
 */
type Mode = "pending" | "stage" | "list";

/** Owns the one ScrollTrigger and the one ticker; everything else subscribes to them. */
export default function Experience() {
  const [debug, setDebug] = useState(false);
  const [mode, setMode] = useState<Mode>("pending");
  const memories = useMemo(() => layoutMemories(CHAPTERS), []);
  const timeline = useMemo(() => buildTimeline(CHAPTERS), []);

  useEffect(() => {
    // Browser-only: the query string is read here, never during server render.
    const search = window.location.search;
    setDebug(new URLSearchParams(search).has("debug"));
    return startScroll({ initialProgress: parseStartProgress(search) });
  }, []);

  // Pick the animated Sky or the plain list, and follow the reduced-motion setting if it changes while the page is open.
  useEffect(() => {
    const choose = () => setMode(prefersReducedMotion() || !webglAvailable() ? "list" : "stage");
    choose();
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    query.addEventListener("change", choose);
    return () => query.removeEventListener("change", choose);
  }, []);

  // The two modes have different page heights, so tell the scroll engine whenever the mode settles.
  useEffect(() => {
    if (mode !== "pending") refreshScroll();
  }, [mode]);

  const unavailable = useCallback(() => setMode("list"), []);

  return (
    <>
      <Sky />
      {mode !== "list" && <Spacers memories={memories} timeline={timeline} />}
      {mode === "stage" && <ChapterTitles timeline={timeline} />}
      {mode === "stage" && <SkyCanvas memories={memories} timeline={timeline} onUnavailable={unavailable} />}
      {mode === "list" && <PlainList memories={memories} />}
      {debug && <DebugOverlay />}
    </>
  );
}
