"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAPTERS, LETTER, SITE, layoutMemories } from "@/content/memories";
import { REDUCED_MOTION_QUERY, prefersReducedMotion, webglAvailable } from "@/lib/capabilities";
import { letterWords } from "@/lib/letter";
import { parseStartProgress, refreshScroll, startScroll } from "@/lib/scroll";
import { buildTimeline } from "@/lib/timeline";
import Sky from "@/components/Sky";
import ChapterTitles from "@/components/ChapterTitles";
import Gate from "@/components/Gate";
import Hud from "@/components/Hud";
import InAppHint from "@/components/InAppHint";
import Intro from "@/components/Intro";
import Letter from "@/components/Letter";
import { PlainList, Spacers } from "@/components/Memories";
import SoundButton from "@/components/SoundButton";
import DebugOverlay from "@/components/DebugOverlay";

// WebGL only exists in the browser, so this never renders on the server.
const SkyCanvas = dynamic(() => import("@/components/SkyCanvas"), { ssr: false });

/**
 * `pending` is what the server renders and the first client render shows, before we know what the device can do.
 * `stage` is the animated 3D Sky; `list` is the plain stacked list of Memories (no WebGL, or reduced motion).
 */
type Mode = "pending" | "stage" | "list";

/** `locked` until the Unlock question is answered, then `opening` while the gate fades into the Sky, then `open`. */
type GateState = "locked" | "opening" | "open";

/** How long the gate takes to fade away; keep in step with `.gate` in globals.css. */
const GATE_FADE_MS = 900;
const UNLOCKED_KEY = "anniversary-unlocked";

/** While the gate is up, the page must not scroll (see `html[data-locked]` in globals.css). */
const setLocked = (locked: boolean) => {
  document.documentElement.dataset.locked = locked ? "true" : "false";
};

const remembered = () => {
  try {
    return window.sessionStorage.getItem(UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
};

/** Owns the one ScrollTrigger and the one ticker; everything else subscribes to them. */
export default function Experience() {
  const [debug, setDebug] = useState(false);
  const [mode, setMode] = useState<Mode>("pending");
  const [gate, setGate] = useState<GateState>("locked");
  const memories = useMemo(() => layoutMemories(CHAPTERS), []);
  const timeline = useMemo(() => buildTimeline(CHAPTERS, { letterWords: letterWords(LETTER) }), []);

  useEffect(() => {
    // Browser-only: the query string is read here, never during server render.
    const search = window.location.search;
    const params = new URLSearchParams(search);
    setDebug(params.has("debug"));
    // The Creator's own checks (`?p=0.4`, `?debug`, `?open`) skip the gate, and so does a tab that was already unlocked.
    if (params.has("p") || params.has("debug") || params.has("open") || remembered()) {
      setLocked(false);
      setGate("open");
    }
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

  // Once the right answer is given the gate fades; when it has gone, it is removed.
  useEffect(() => {
    if (gate !== "opening") return;
    const timer = window.setTimeout(() => setGate("open"), GATE_FADE_MS + 100); // a little slack
    return () => window.clearTimeout(timer);
  }, [gate]);

  const unlock = useCallback(() => {
    try {
      window.sessionStorage.setItem(UNLOCKED_KEY, "1");
    } catch {
      /* Private browsing: she may be asked again after a reload, which is fine. */
    }
    setLocked(false);
    refreshScroll();
    setGate("opening");
  }, []);

  const unavailable = useCallback(() => setMode("list"), []);

  return (
    <>
      {/* Hidden from everyone, assistive technology included, until the question is answered. */}
      <div inert={gate === "locked"}>
        <Sky timeline={timeline} />
        {mode !== "list" && <Spacers memories={memories} timeline={timeline} />}
        {mode === "stage" && <Intro timeline={timeline} ready={gate !== "locked"} />}
        {mode === "stage" && <ChapterTitles timeline={timeline} />}
        {mode === "stage" && <Letter timeline={timeline} />}
        {mode === "stage" && <Hud timeline={timeline} />}
        {mode === "stage" && <SkyCanvas memories={memories} timeline={timeline} onUnavailable={unavailable} />}
        {mode === "list" && <PlainList memories={memories} />}
        {/* In both the animated Sky and the plain list; it shows nothing when there is no song. */}
        {mode !== "pending" && <SoundButton src={SITE.song} />}
        {debug && <DebugOverlay timeline={timeline} />}
      </div>
      {gate !== "open" && <Gate opening={gate === "opening"} onUnlock={unlock} />}
      {/* Above the gate too: the link is opened in the other app's browser before she answers anything. */}
      <InAppHint />
    </>
  );
}
