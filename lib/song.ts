/**
 * The Song: one piece of music the Recipient starts and stops with the Sound button. Browser only (it makes an <audio>
 * element), but the player takes the element from a factory so tests can supply a fake.
 *
 * The Song plays straight through an <audio> element, not through the page's Web Audio context (`lib/audio.ts`): the
 * element keeps playing when the iPhone's silent switch is on, which Web Audio would not.
 */

/** The slice of HTMLAudioElement we use. */
export type AudioLike = Pick<
  HTMLAudioElement,
  "play" | "pause" | "paused" | "loop" | "preload" | "addEventListener" | "removeEventListener"
>;

export type SongState = {
  /** False when no song is configured or the file could not be loaded: the Sound button is then not shown. */
  available: boolean;
  playing: boolean;
};

export type SongPlayer = {
  /** The current state. A new object each time it changes, so it works with `useSyncExternalStore`. */
  readonly state: SongState;
  /** Play if paused, pause if playing. Call it directly from a tap or click handler. */
  toggle(): Promise<void>;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

export type SongDeps = {
  createAudio?: (src: string) => AudioLike;
};

const defaultCreateAudio = (src: string): AudioLike => {
  const audio = new Audio();
  // `preload` before `src`: giving it a source is what makes the browser decide what to download.
  audio.preload = "none";
  audio.src = src;
  return audio;
};

export function createSongPlayer(src: string, deps: SongDeps = {}): SongPlayer {
  const { createAudio = defaultCreateAudio } = deps;

  let state: SongState = { available: true, playing: false };
  const listeners = new Set<() => void>();
  /** Changes the state and tells the button, but only if something actually changed. */
  const setState = (next: Partial<SongState>) => {
    const merged = { ...state, ...next };
    if (merged.available === state.available && merged.playing === state.playing) return;
    state = merged;
    for (const listener of listeners) listener();
  };

  // No song configured: the site works silently and the Sound button is not shown.
  if (!src.trim()) {
    state = { available: false, playing: false };
    return { state, toggle: async () => {}, subscribe: () => () => {}, dispose: () => {} };
  }

  const audio = createAudio(src);
  audio.loop = true;
  audio.preload = "none"; // the song is several MB: nothing is downloaded until she taps
  // A wrong path or a broken file (this only shows up once she taps, since nothing is fetched before): carry on
  // silently rather than keeping a button that does nothing.
  const onError = () => setState({ available: false, playing: false });
  // `playing` follows what the audio element really does, not what was asked of it: a phone call, Siri, unplugged
  // headphones or the lock screen's pause button can all stop the music without going through the button.
  const onPlay = () => setState({ playing: true });
  const onPause = () => setState({ playing: false });
  audio.addEventListener("error", onError);
  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onPause);

  // Leaving the page (another app, another tab) pauses the music; coming back picks it up where it was, but only if
  // she had not paused it herself.
  let resumeOnReturn = false;
  const onVisibility = () => {
    if (document.hidden) {
      if (!audio.paused) {
        resumeOnReturn = true;
        audio.pause();
      }
    } else if (resumeOnReturn) {
      resumeOnReturn = false;
      audio.play().catch(() => {}); // if the browser will not resume it, the button already shows it as paused
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    get state() {
      return state;
    },

    async toggle() {
      if (!audio.paused) {
        audio.pause();
        return;
      }
      try {
        // No await before play(): iPhone Safari only allows it while the tap is still being handled. The state
        // changes through the element's own "play" event.
        await audio.play();
      } catch {
        /* The browser refused (not a tap, or no sound allowed): it stays paused, and so does the button. */
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose() {
      document.removeEventListener("visibilitychange", onVisibility);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      listeners.clear();
      resumeOnReturn = false;
      audio.pause();
    },
  };
}
