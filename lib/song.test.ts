import { afterEach, describe, expect, it, vi } from "vitest";
import { createSongPlayer, type AudioLike } from "@/lib/song";

/** A stand-in for the browser's audio element: it plays or pauses when told to, and says so with events, like the real one. */
class FakeAudio extends EventTarget implements AudioLike {
  paused = true;
  loop = false;
  preload: AudioLike["preload"] = "";
  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
}

function setup(src = "/audio/our-song.mp3") {
  const audio = new FakeAudio();
  const createAudio = vi.fn((_src: string): AudioLike => audio);
  const player = createSongPlayer(src, { createAudio });
  return { audio, createAudio, player };
}

describe("createSongPlayer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("playing and pausing", () => {
    it("starts only when told to (a tap), and pauses on the next tap", async () => {
      const { audio, player } = setup();
      expect(audio.play).not.toHaveBeenCalled();
      expect(player.state).toEqual({ available: true, playing: false });

      await player.toggle();
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(player.state.playing).toBe(true);

      await player.toggle();
      expect(audio.pause).toHaveBeenCalledTimes(1);
      expect(player.state.playing).toBe(false);
    });

    it("asks the browser to play before doing anything else, because iPhone only allows it inside the tap itself", () => {
      const { audio, player } = setup();
      void player.toggle(); // not awaited: play() must already have been called
      expect(audio.play).toHaveBeenCalledTimes(1);
    });

    it("downloads nothing until she taps, and loops so a short song does not end the music", () => {
      const { audio } = setup();
      expect(audio.preload).toBe("none");
      expect(audio.loop).toBe(true);
    });
  });

  describe("telling the button", () => {
    it("notifies a subscriber on every change, with a new state object each time, until it unsubscribes", async () => {
      const { player } = setup();
      const listener = vi.fn();
      const stop = player.subscribe(listener);
      const before = player.state;

      await player.toggle();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(player.state).not.toBe(before);

      await player.toggle();
      expect(listener).toHaveBeenCalledTimes(2);

      stop();
      await player.toggle();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("notifies when the file turns out to be unplayable", () => {
      const { audio, player } = setup();
      const listener = vi.fn();
      player.subscribe(listener);
      audio.dispatchEvent(new Event("error"));
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the phone plays or pauses it on its own", () => {
    /** What iOS does for a phone call, Siri, unplugged headphones or the lock screen's pause button. */
    const phonePauses = (audio: FakeAudio) => {
      audio.paused = true;
      audio.dispatchEvent(new Event("pause"));
    };
    const phonePlays = (audio: FakeAudio) => {
      audio.paused = false;
      audio.dispatchEvent(new Event("play"));
    };

    it("shows the music as paused when something else paused it, so her next tap plays it again", async () => {
      const { audio, player } = setup();
      await player.toggle();
      phonePauses(audio);
      expect(player.state.playing).toBe(false);

      await player.toggle();
      expect(audio.play).toHaveBeenCalledTimes(2);
      expect(player.state.playing).toBe(true);
    });

    it("shows the music as playing when something else started it, so her next tap pauses it", () => {
      const { audio, player } = setup();
      phonePlays(audio);
      expect(player.state.playing).toBe(true);
    });

    it("only tells the button about real changes", async () => {
      const { audio, player } = setup();
      await player.toggle();
      const listener = vi.fn();
      player.subscribe(listener);
      phonePlays(audio); // already playing
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("leaving and coming back to the tab", () => {
    const tabIs = (hidden: boolean) => {
      vi.spyOn(document, "hidden", "get").mockReturnValue(hidden);
      document.dispatchEvent(new Event("visibilitychange"));
    };

    it("pauses the music when she leaves and picks it up again when she returns", async () => {
      const { audio, player } = setup();
      await player.toggle();

      tabIs(true);
      expect(audio.pause).toHaveBeenCalledTimes(1);
      expect(audio.paused).toBe(true);

      tabIs(false);
      await Promise.resolve();
      expect(audio.play).toHaveBeenCalledTimes(2);
      expect(player.state.playing).toBe(true);
      player.dispose();
    });

    it("does not start music she had already paused", async () => {
      const { audio, player } = setup();
      await player.toggle();
      await player.toggle(); // she paused it herself

      tabIs(true);
      tabIs(false);
      await Promise.resolve();
      expect(audio.play).toHaveBeenCalledTimes(1);
      expect(player.state.playing).toBe(false);
      player.dispose();
    });

    it("shows the music as paused if the browser will not resume it on her return", async () => {
      const { audio, player } = setup();
      await player.toggle();
      tabIs(true);
      audio.play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));
      tabIs(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(player.state.playing).toBe(false);
      player.dispose();
    });

    it("stops listening once disposed, and silences the song", async () => {
      const { audio, player } = setup();
      await player.toggle();
      player.dispose();
      expect(audio.pause).toHaveBeenCalledTimes(1);

      tabIs(true);
      tabIs(false);
      await Promise.resolve();
      expect(audio.play).toHaveBeenCalledTimes(1);
    });
  });

  describe("when there is nothing to play", () => {
    it.each([["an empty string", ""], ["only spaces", "   "]])("has no song for %s: unavailable, no audio element, toggle does nothing", async (_name, src) => {
      const { createAudio, player } = setup(src);
      expect(player.state).toEqual({ available: false, playing: false });
      expect(createAudio).not.toHaveBeenCalled();
      await expect(player.toggle()).resolves.toBeUndefined();
      expect(player.state.playing).toBe(false);
    });

    it("stays paused, without throwing, if the browser refuses to play", async () => {
      const { audio, player } = setup();
      audio.play.mockRejectedValueOnce(new DOMException("play() was blocked", "NotAllowedError"));
      await expect(player.toggle()).resolves.toBeUndefined();
      expect(player.state).toEqual({ available: true, playing: false });
    });

    it("becomes unavailable if the song file cannot be loaded (a typo in the path, a broken file)", () => {
      const { audio, player } = setup();
      audio.dispatchEvent(new Event("error"));
      expect(player.state).toEqual({ available: false, playing: false });
    });
  });
});
