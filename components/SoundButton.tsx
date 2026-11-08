"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createSongPlayer, type SongPlayer, type SongState } from "@/lib/song";

const NO_SONG: SongState = { available: false, playing: false };
const noUnsubscribe = () => {};

/**
 * The Sound button: plays and pauses the Song. It does nothing until she taps it (browsers, iPhone Safari above all,
 * only allow sound after a tap), and it is not shown at all when no song is set. If the file turns out not to load
 * (nothing is fetched before her first tap) the button disappears at that tap.
 */
export default function SoundButton({ src }: { src: string }) {
  // The <audio> element only exists in the browser, so the player is made after mount.
  const [player, setPlayer] = useState<SongPlayer | null>(null);
  useEffect(() => {
    const made = createSongPlayer(src);
    setPlayer(made);
    return () => {
      made.dispose();
      setPlayer(null);
    };
  }, [src]);

  const subscribe = useCallback((listener: () => void) => (player ? player.subscribe(listener) : noUnsubscribe), [player]);
  const snapshot = useCallback(() => (player ? player.state : NO_SONG), [player]);
  const { available, playing } = useSyncExternalStore(subscribe, snapshot, () => NO_SONG);

  if (!player || !available) return null;
  return (
    <button
      type="button"
      className={`sound${playing ? " sound--on" : ""}`}
      // A fixed name plus `aria-pressed` is how a toggle button is announced ("Play our song, toggle button, pressed");
      // a name that also flipped would make a screen reader say the opposite of the state.
      aria-label="Play our song"
      aria-pressed={playing}
      // play() has to be called inside this handler for iPhone Safari to allow it.
      onClick={() => void player.toggle()}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M4 9.5h3.6L12 6v12l-4.4-3.5H4z" fill="currentColor" />
        {playing ? (
          <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <path d="M16 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
