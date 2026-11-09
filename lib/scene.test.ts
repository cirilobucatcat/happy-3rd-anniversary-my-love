import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { CONTEXT_RESTORE_WAIT_MS } from "@/lib/context-watch";
import { createStage, type RendererLike } from "@/lib/scene";
import { buildTimeline } from "@/lib/timeline";

const memories = layoutMemories(CHAPTERS);
const timeline = buildTimeline(CHAPTERS);
const options = { memories, timeline };

function fakeRenderer(canvas: HTMLCanvasElement) {
  return {
    domElement: canvas,
    autoClear: true,
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    clear: vi.fn(),
    clearDepth: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
  } satisfies RendererLike;
}

const quickModel = async () => {
  const model = new Group();
  model.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  return { model, source: "placeholder" as const };
};

/** A photo texture that tracks whether it was freed. */
function fakePhoto() {
  const texture = new Texture();
  const dispose = vi.spyOn(texture, "dispose");
  return { texture, dispose };
}

describe("createStage", () => {
  let container: HTMLDivElement;
  const renderers: ReturnType<typeof fakeRenderer>[] = [];
  const createRenderer = (canvas: HTMLCanvasElement) => {
    const r = fakeRenderer(canvas);
    renderers.push(r);
    return r;
  };
  const photos: ReturnType<typeof fakePhoto>[] = [];
  const loadPhoto = vi.fn(async () => {
    const p = fakePhoto();
    photos.push(p);
    return p.texture;
  });
  const make = () => createStage(container, options, { createRenderer, loadCouple: quickModel, loadPhoto })!;
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    renderers.length = 0;
    photos.length = 0;
    loadPhoto.mockClear();
  });
  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  describe("lifecycle", () => {
    it("puts exactly one canvas in the container", () => {
      const stage = make();
      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      stage.dispose();
    });

    it("survives React Strict Mode's mount, unmount, mount: one canvas, and the first context released", () => {
      const first = make();
      first.dispose();
      const second = make();
      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
      expect(renderers[0].forceContextLoss).toHaveBeenCalledTimes(1);
      expect(renderers[1].dispose).not.toHaveBeenCalled();
      second.dispose();
    });

    it("disposes once, removes the canvas, and stops rendering afterwards", () => {
      const stage = make();
      stage.resize(390, 844);
      stage.update(0.3, 0.016);
      stage.dispose();
      stage.dispose();
      expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
      expect(container.querySelector("canvas")).toBeNull();
      renderers[0].render.mockClear();
      stage.update(0.5, 0.016);
      stage.resize(800, 600);
      expect(renderers[0].render).not.toHaveBeenCalled();
    });

    it("frees every photo texture it loaded when it is disposed", async () => {
      const stage = make();
      stage.resize(390, 844);
      stage.update(timeline.memories[0].from, 0.016);
      await flush();
      expect(photos.length).toBeGreaterThan(0);
      stage.dispose();
      for (const p of photos) expect(p.dispose).toHaveBeenCalled();
    });

    it("frees a model that finishes loading after the stage was disposed", async () => {
      let finish!: () => void;
      const geometry = new BoxGeometry(1, 1, 1);
      const spy = vi.spyOn(geometry, "dispose");
      const stage = createStage(
        container,
        options,
        {
          createRenderer,
          loadPhoto,
          loadCouple: () =>
            new Promise((resolve) => {
              finish = () => {
                const model = new Group();
                model.add(new Mesh(geometry, new MeshBasicMaterial()));
                resolve({ model, source: "glb" as const });
              };
            }),
        },
      )!;
      stage.dispose();
      finish();
      await stage.ready;
      expect(spy).toHaveBeenCalled();
    });

    it("returns null and leaves nothing behind when WebGL is unavailable", () => {
      const stage = createStage(container, options, {
        createRenderer: () => {
          throw new Error("no webgl");
        },
        loadCouple: quickModel,
        loadPhoto,
      });
      expect(stage).toBeNull();
      expect(container.querySelector("canvas")).toBeNull();
    });
  });

  describe("rendering", () => {
    it("clears by hand and caps the pixel ratio at 2 so phones with 3x screens stay smooth", () => {
      vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(3);
      const stage = make();
      expect(renderers[0].autoClear).toBe(false); // layers are drawn one over another, see lib/draw-order.ts
      stage.resize(390, 844);
      expect(renderers[0].setPixelRatio).toHaveBeenLastCalledWith(2);
      vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(1.5);
      stage.resize(390, 844);
      expect(renderers[0].setPixelRatio).toHaveBeenLastCalledWith(1.5);
      stage.dispose();
    });

    it("sizes the drawing buffer to the container without touching the canvas CSS size", () => {
      const stage = make();
      stage.resize(1440, 900);
      expect(renderers[0].setSize).toHaveBeenLastCalledWith(1440, 900, false);
      stage.dispose();
    });

    it("redraws straight after a resize, because resizing clears the canvas and would flash blank until the next tick", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(1440, 900);
      stage.update(0.5, 0.016);
      renderers[0].render.mockClear();
      stage.resize(390, 844);
      expect(renderers[0].render).toHaveBeenCalled();
      stage.dispose();
    });

    it("draws the Flyers exactly once per update", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      const drawn: boolean[] = [];
      renderers[0].render.mockImplementation(() => drawn.push(stage.flyers.visible));
      stage.update(0.5, 0.016);
      expect(drawn.filter(Boolean)).toHaveLength(1);
      stage.dispose();
    });

    it("draws the pink trail and the Stardust in the Flyers' own layer and nowhere else, so Clouds veil all three together", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      const calls: { flyers: boolean; trail: boolean; stardust: boolean }[] = [];
      renderers[0].render.mockImplementation(() =>
        calls.push({ flyers: stage.flyers.visible, trail: stage.trail.visible, stardust: stage.stardust.visible }),
      );
      for (let p = 0; p <= 1; p += 0.02) stage.update(p, 0.016);
      expect(calls.some((c) => c.stardust)).toBe(true);
      for (const c of calls) {
        expect(c.trail).toBe(c.flyers);
        expect(c.stardust).toBe(c.flyers);
      }
      stage.dispose();
    });

    it("always draws the Flyers after (in front of) any Memory that is on screen", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      let checked = 0;
      // Sweep the whole scroll: whenever a Memory is drawn in a frame, the Flyers must come later in that frame.
      for (let p = 0; p <= 1; p += 0.005) {
        const calls: { flyers: boolean; memory: boolean }[] = [];
        renderers[0].render.mockImplementation(() =>
          calls.push({ flyers: stage.flyers.visible, memory: stage.memories.some((m) => m.visible) }),
        );
        stage.update(p, 0.016);
        const memoryAt = calls.findIndex((c) => c.memory);
        const flyersAt = calls.findIndex((c) => c.flyers);
        if (memoryAt >= 0) {
          checked += 1;
          expect(flyersAt).toBeGreaterThan(memoryAt);
        }
      }
      expect(checked).toBeGreaterThan(20); // there really were frames with a Memory in them
      stage.dispose();
    });
  });

  describe("when the browser takes the WebGL context away (for example after switching apps)", () => {
    const lose = (canvas: HTMLCanvasElement) => {
      const event = new Event("webglcontextlost", { cancelable: true });
      canvas.dispatchEvent(event);
      return event;
    };
    const restore = (canvas: HTMLCanvasElement) => canvas.dispatchEvent(new Event("webglcontextrestored"));
    const tabIs = (hidden: boolean) => {
      vi.spyOn(document, "hidden", "get").mockReturnValue(hidden);
      document.dispatchEvent(new Event("visibilitychange"));
    };
    const makeWatched = () => {
      const onContextFailed = vi.fn();
      const stage = createStage(container, { ...options, onContextFailed }, { createRenderer, loadCouple: quickModel, loadPhoto })!;
      stage.resize(390, 844);
      stage.update(0.5, 0.016);
      return { stage, onContextFailed, renderer: renderers[0] };
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it("lets the browser give the context back, stops drawing into the void while it is gone, and redraws the instant it returns", () => {
      const { stage, renderer } = makeWatched();

      const event = lose(renderer.domElement);
      expect(event.defaultPrevented).toBe(true); // without this the browser never offers the context back

      renderer.render.mockClear();
      renderer.clear.mockClear();
      stage.update(0.55, 0.016);
      expect(renderer.render).not.toHaveBeenCalled();
      expect(renderer.clear).not.toHaveBeenCalled();

      restore(renderer.domElement);
      expect(renderer.render).toHaveBeenCalled(); // no blank canvas while waiting for the next tick

      renderer.render.mockClear();
      stage.update(0.6, 0.016);
      expect(renderer.render).toHaveBeenCalled(); // and carries on as before
      stage.dispose();
    });

    it("asks to be rebuilt if the context is still gone after a few seconds", () => {
      vi.useFakeTimers();
      const { stage, onContextFailed, renderer } = makeWatched();
      lose(renderer.domElement);
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS - 1);
      expect(onContextFailed).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onContextFailed).toHaveBeenCalledTimes(1);
      stage.dispose();
    });

    it("does not ask if the context comes back in time", () => {
      vi.useFakeTimers();
      const { stage, onContextFailed, renderer } = makeWatched();
      lose(renderer.domElement);
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS - 1);
      restore(renderer.domElement);
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS * 3);
      expect(onContextFailed).not.toHaveBeenCalled();
      stage.dispose();
    });

    it("starts the wait only once she is looking at the page, since a hidden page can't get a new context anyway", () => {
      vi.useFakeTimers();
      const { stage, onContextFailed, renderer } = makeWatched();
      tabIs(true);
      lose(renderer.domElement);
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS * 10);
      expect(onContextFailed).not.toHaveBeenCalled();

      tabIs(false);
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS);
      expect(onContextFailed).toHaveBeenCalledTimes(1);
      stage.dispose();
    });

    it("stops the clock if she leaves while it is running, and starts it afresh when she returns", () => {
      vi.useFakeTimers();
      const { stage, onContextFailed, renderer } = makeWatched();
      lose(renderer.domElement);
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS - 1);
      tabIs(true);
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS * 3);
      expect(onContextFailed).not.toHaveBeenCalled();

      tabIs(false);
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS - 1);
      expect(onContextFailed).not.toHaveBeenCalled(); // a full wait again, not what was left over
      vi.advanceTimersByTime(1);
      expect(onContextFailed).toHaveBeenCalledTimes(1);
      stage.dispose();
    });

    it("says nothing once disposed", () => {
      vi.useFakeTimers();
      const { stage, onContextFailed, renderer } = makeWatched();
      lose(renderer.domElement);
      stage.dispose();
      vi.advanceTimersByTime(CONTEXT_RESTORE_WAIT_MS * 3);
      tabIs(false);
      expect(onContextFailed).not.toHaveBeenCalled();
    });
  });

  describe("the Flyers", () => {
    it("move along the path, and scrolling back up returns them to the same place", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(1440, 900);
      stage.update(0.5, 0.016);
      const mid = stage.flyers.position.clone();
      stage.update(0.9, 0.016);
      expect(stage.flyers.position.distanceTo(mid)).toBeGreaterThan(0.5);
      stage.update(0.5, 0.016);
      expect(stage.flyers.position.distanceTo(mid)).toBeLessThan(1e-9);
      stage.dispose();
    });

    it("refit the path when the container changes shape", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(1440, 900);
      stage.update(0.5, 0.016);
      const laptop = stage.flyers.position.clone();
      stage.resize(390, 844);
      stage.update(0.5, 0.016);
      expect(stage.flyers.position.distanceTo(laptop)).toBeGreaterThan(0.1);
      stage.dispose();
    });

    it("are in the middle of the first Cloud pass when the first Chapter changes", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      stage.update(timeline.passes[0].centre, 0.016);
      const at = stage.flyers.position.clone();
      stage.update(timeline.passes[0].centre + 0.2, 0.016);
      expect(stage.flyers.position.distanceTo(at)).toBeGreaterThan(0.3); // and have flown on afterwards
      stage.dispose();
    });
  });

  describe("photo textures", () => {
    it("loads photos lazily: only the Memories near the scroll position, never all of them at once", async () => {
      const stage = make();
      stage.resize(390, 844);
      stage.update(timeline.memories[0].from - 0.02, 0.016); // a little before the first Memory is due
      await flush();
      expect(loadPhoto.mock.calls.length).toBeGreaterThan(0);
      expect(loadPhoto.mock.calls.length).toBeLessThanOrEqual(4);
      expect(loadPhoto.mock.calls.length).toBeLessThan(memories.length);
      stage.dispose();
    });

    it("releases a photo's texture once its Memory is far behind her, and never holds more than a few at a time", async () => {
      const stage = make();
      stage.resize(390, 844);
      let most = 0;
      for (let p = 0; p <= 1; p += 0.01) {
        stage.update(p, 0.016);
        await flush();
        most = Math.max(most, stage.textures);
      }
      expect(most).toBeLessThanOrEqual(4);
      // The first Memory's photo was loaded early on and has been freed long before the end.
      expect(photos[0].dispose).toHaveBeenCalled();
      stage.dispose();
    });
  });

});
