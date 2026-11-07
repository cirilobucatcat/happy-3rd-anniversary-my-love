"use client";

import { useEffect, useState } from "react";
import { parseStartProgress, startScroll } from "@/lib/scroll";
import Sky from "@/components/Sky";
import Memories from "@/components/Memories";
import DebugOverlay from "@/components/DebugOverlay";

/** Owns the one ScrollTrigger and the one ticker; everything else subscribes to them. */
export default function Experience() {
  const [debug, setDebug] = useState(false);

  useEffect(() => {
    // Browser-only: the query string is read here, never during server render.
    const search = window.location.search;
    setDebug(new URLSearchParams(search).has("debug"));
    return startScroll({ initialProgress: parseStartProgress(search) });
  }, []);

  return (
    <>
      <Sky />
      <Memories />
      {debug && <DebugOverlay />}
    </>
  );
}
