/**
 * Audio unlock. iPhone Safari only lets a page make sound after a tap, so the Unlock gate's first tap starts the
 * page's audio context here. The song (ticket 05) should play through this context (for instance by routing its
 * <audio> element into it), because iOS unlocks a context, not other media elements. Browser only.
 */

type AudioContextClass = typeof AudioContext;

let context: AudioContext | null = null;

/** The shared audio context, once `unlockAudio` has run (null before the first tap, or where audio is unavailable). */
export const audioContext = (): AudioContext | null => context;

/** Call from inside a tap or key press. Safe to call again: once the context is running, later calls do nothing. */
export function unlockAudio(): void {
  if (context?.state === "running") return;
  try {
    const Context: AudioContextClass | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
    if (!Context) return;
    context ??= new Context();
    void context.resume();
    // A single silent sample is what makes iOS treat the context as unlocked.
    const silent = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = silent;
    source.connect(context.destination);
    source.start(0);
  } catch {
    /* No audio on this device; the story works without it. */
  }
}
