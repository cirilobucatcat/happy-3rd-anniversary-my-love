import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture, Vector3, type Object3D } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTERS, layoutMemories } from "@/content/memories";
import { CONTEXT_RESTORE_WAIT_MS } from "@/lib/context-watch";
import { createStage, type RendererLike } from "@/lib/scene";
import { buildTimeline } from "@/lib/timeline";

const memories = layoutMemories(CHAPTERS);
const timeline = buildTimeline(CHAPTERS);
const options = { memories, timeline };
const dive = timeline.passes[1];
const flyBy = (k: number) => timeline.seaFlyBys[k];

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

    it("always draws the Flyers after (in front of) any Pop-out Memory that is on screen", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      let checked = 0;
      // Sweep How we met and Year 1: whenever a Memory is drawn in a frame, the Flyers must come later in that frame.
      for (let p = 0; p <= dive.from; p += 0.005) {
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

    it("draws the Sea first and by itself, behind everything, and only once the dive's Cloud pass has begun to bring it up", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      let seaFrames = 0;
      for (let p = 0; p <= 1; p += 0.01) {
        const calls: { sea: boolean; others: boolean }[] = [];
        renderers[0].render.mockImplementation(() =>
          calls.push({
            sea: stage.sea.visible,
            others: stage.flyers.visible || stage.memories.some((m) => m.visible),
          }),
        );
        stage.update(p, 0.016);
        const seaAt = calls.findIndex((c) => c.sea);
        if (p < (dive.from + dive.to) / 2) expect(seaAt).toBe(-1);
        if (seaAt >= 0) {
          seaFrames += 1;
          expect(seaAt).toBe(0); // the first layer drawn
          expect(calls[seaAt].others).toBe(false); // on its own
          expect(calls.filter((c) => c.sea)).toHaveLength(1);
        }
      }
      expect(seaFrames).toBeGreaterThan(20); // through Year 2 and the start of the climb, then it has fallen away
      stage.dispose();
    });

    it("hides the Sea again when she scrolls back up out of Year 2", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      stage.update(timeline.seaFlyBys[3].alongside, 0.016);
      const calls: boolean[] = [];
      renderers[0].render.mockImplementation(() => calls.push(stage.sea.visible));
      stage.update(dive.from - 0.01, 0.016);
      expect(calls.some(Boolean)).toBe(false);
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

  describe("the camera", () => {
    it("is the fixed side view, a few degrees off the middle, until the dive", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      for (const p of [0, 0.1, 0.3, dive.from]) {
        stage.update(p, 0.016);
        expect(stage.camera.position.length()).toBeCloseTo(10, 5);
        expect(Math.hypot(stage.camera.position.x, stage.camera.position.y)).toBeLessThan(1.2);
      }
      stage.dispose();
    });

    it("follows from behind and above in Year 2, so the Flyers' backs show", async () => {
      const stage = make();
      await stage.ready;
      stage.resize(390, 844);
      for (const k of [0, 4, 8, 11]) {
        stage.update(flyBy(k).alongside, 0.016);
        const behind = stage.camera.position.z - stage.flyers.position.z;
        expect(behind).toBeGreaterThan(3 * stage.flyers.scale.x);
        expect(stage.camera.position.y).toBeGreaterThan(stage.flyers.position.y);
      }
      stage.dispose();
    });

    it("puts the Flyers low in the middle of the screen in Year 2, on a phone and a laptop", async () => {
      for (const [w, h] of [
        [390, 844],
        [1440, 900],
      ]) {
        const stage = make();
        await stage.ready;
        stage.resize(w, h);
        for (const k of [1, 6, 10]) {
          stage.update(flyBy(k).alongside, 0.016);
          const at = stage.flyers.position.clone().project(stage.camera);
          expect(Math.abs(at.x)).toBeLessThan(0.2);
          expect(at.y).toBeLessThan(-0.3);
          expect(at.y).toBeGreaterThan(-0.85);
        }
        stage.dispose();
      }
    });
  });

  describe("Fly-by pictures", () => {
    let current: ReturnType<typeof make> | null = null;
    const stage = () => current!;
    const lastRenderer = () => renderers[renderers.length - 1];
    afterEach(() => current?.dispose());

    it("shows a picture only while the Flyers are near it: lost in the haze far away, drawn when close", async () => {
      current = make();
      await current.ready;
      current.resize(390, 844);
      const card = stage().memories[flyBy(5).index];
      const drawnAt = (p: number) => {
        let drawn = false;
        lastRenderer().render.mockImplementation(() => (drawn ||= card.visible));
        stage().update(p, 0.016);
        return drawn;
      };
      expect(drawnAt(flyBy(5).alongside - 0.05)).toBe(false); // far ahead
      expect(drawnAt(flyBy(5).alongside)).toBe(true); // alongside
      expect(drawnAt(flyBy(5).alongside + 0.05)).toBe(false); // far behind
    });

    it("never moves: a picture stays where it hangs while the Flyers go by", async () => {
      current = make();
      await current.ready;
      current.resize(390, 844);
      const card = stage().memories[flyBy(3).index];
      stage().update(flyBy(3).alongside - 0.01, 0.016);
      const before = card.position.clone();
      stage().update(flyBy(3).alongside + 0.01, 0.016);
      expect(card.position.distanceTo(before)).toBe(0);
      expect(card.scale.x).toBe(1); // and nothing scales or bounces in
    });

    it("is drawn by real depth against the Flyers: before them while it is still ahead, after them once they have passed", async () => {
      current = make();
      await current.ready;
      current.resize(390, 844);
      const card = stage().memories[flyBy(7).index];
      const order = (p: number) => {
        const calls: { flyers: boolean; card: boolean }[] = [];
        lastRenderer().render.mockImplementation(() => calls.push({ flyers: stage().flyers.visible, card: card.visible }));
        stage().update(p, 0.016);
        const cardAt = calls.findIndex((c) => c.card);
        const flyersAt = calls.findIndex((c) => c.flyers);
        return cardAt < 0 ? "none" : cardAt < flyersAt ? "card first" : "flyers first";
      };
      const seen = new Set<string>();
      const a = flyBy(7).alongside;
      for (let p = a - 0.012; p <= a + 0.012; p += 0.0005) seen.add(order(p));
      expect(seen.has("card first")).toBe(true); // ahead of them, further from the camera
      expect(seen.has("flyers first")).toBe(true); // passed, nearer to the camera
    });

    it("climbs face on in Year 3: the camera is in front of the Flyers on the +z side and rises with them to the end, and the Flyers are drawn", async () => {
      for (const [w, h] of [[390, 844], [1440, 900]]) {
        current = make();
        await current.ready;
        current.resize(w, h);
        const turnAround = timeline.passes[2];
        let drawnFlyers = 0;
        let frames = 0;
        let lastHeight = -Infinity;
        for (let p = turnAround.to + 0.002; p <= 1; p += 0.01) {
          const calls: boolean[] = [];
          lastRenderer().render.mockImplementation(() => calls.push(stage().flyers.visible));
          stage().update(p, 0.016);
          frames += 1;
          if (calls.some(Boolean)) drawnFlyers += 1;
          const camera = stage().camera.position;
          const flyers = stage().flyers.position;
          expect(Number.isFinite(camera.x + camera.y + camera.z)).toBe(true);
          expect(camera.z - flyers.z).toBeGreaterThan(7 * stage().flyers.scale.x);
          expect(camera.y).toBeGreaterThan(flyers.y);
          expect(camera.y).toBeGreaterThanOrEqual(lastHeight - 1e-9);
          lastHeight = camera.y;
        }
        expect(frames).toBeGreaterThan(30);
        expect(drawnFlyers).toBe(frames);
        current.dispose();
      }
    });

    const skyFlyBy = (k: number) => timeline.skyFlyBys[k];
    const reflectionOn = (card: Object3D) => card.children.some((o) => o.type === "Group" && o.visible && o.scale.y === -1);

    it("hangs Year 3's pictures in the Sky: each is lost in the haze far away, drawn while the Flyers climb past it, and gone again after", async () => {
      current = make();
      await current.ready;
      current.resize(390, 844);
      timeline.skyFlyBys.forEach((f) => expect(timeline.memories[f.index].chapterId).toBe("year-3"));
      for (const k of [0, 1, 5, 11]) {
        const card = stage().memories[skyFlyBy(k).index];
        const drawnAt = (p: number) => {
          let drawn = false;
          lastRenderer().render.mockImplementation(() => (drawn ||= card.visible));
          stage().update(p, 0.016);
          return drawn;
        };
        expect(drawnAt(skyFlyBy(k).alongside - 0.04)).toBe(false); // far below, still to come
        expect(drawnAt(skyFlyBy(k).alongside)).toBe(true);
        expect(drawnAt(skyFlyBy(k).alongside + 0.04)).toBe(false); // far above, left behind
      }
    });

    it("never moves a Year 3 picture while the Flyers go by, and nothing scales or bounces in", async () => {
      current = make();
      await current.ready;
      current.resize(390, 844);
      const card = stage().memories[skyFlyBy(4).index];
      stage().update(skyFlyBy(4).alongside - 0.01, 0.016);
      const before = card.position.clone();
      stage().update(skyFlyBy(4).alongside + 0.01, 0.016);
      expect(card.position.distanceTo(before)).toBe(0);
      expect(card.scale.x).toBe(1);
    });

    it("gives a Year 3 picture no reflection, while Year 2's pictures keep theirs", async () => {
      current = make();
      await current.ready;
      current.resize(390, 844);
      const sea = stage().memories[flyBy(5).index];
      stage().update(flyBy(5).alongside, 0.016);
      expect(reflectionOn(sea)).toBe(true);
      for (const k of [0, 3, 7, 11]) {
        const sky = stage().memories[skyFlyBy(k).index];
        stage().update(skyFlyBy(k).alongside, 0.016);
        expect(reflectionOn(sky)).toBe(false);
      }
      stage().update(flyBy(5).alongside, 0.016); // and scrolling back brings Year 2's back
      expect(reflectionOn(sea)).toBe(true);
    });

    it("draws Clouds, pictures and the Flyers by their real depth from the face-on camera, so what is nearer is drawn later", async () => {
      current = make();
      await current.ready;
      current.resize(390, 844);
      const scene = stage().flyers.parent!;
      const sprites = scene.children.filter((o) => o.type === "Sprite");
      const camera = stage().camera;
      const forward = new Vector3();
      const depth = (o: Object3D) => o.position.clone().sub(camera.position).dot(camera.getWorldDirection(forward));
      let checked = 0;
      for (const k of [0, 3, 6, 9, 11]) {
        const card = stage().memories[skyFlyBy(k).index];
        const layers: { card: boolean; flyers: boolean; sprites: Object3D[] }[] = [];
        lastRenderer().render.mockImplementation(() => layers.push({ card: card.visible, flyers: stage().flyers.visible, sprites: sprites.filter((s) => s.visible) }));
        for (const p of [skyFlyBy(k).alongside - 0.004, skyFlyBy(k).alongside, skyFlyBy(k).alongside + 0.003]) {
          layers.length = 0;
          stage().update(p, 0.016);
          const mine = layers.findIndex((l) => l.card);
          if (mine < 0) continue;
          const here = depth(card);
          layers.forEach((l, at) => {
            for (const sprite of l.sprites) {
              checked += 1;
              if (at < mine) expect(depth(sprite)).toBeGreaterThanOrEqual(here - 1e-6); // drawn earlier: further away
              if (at > mine) expect(depth(sprite)).toBeLessThanOrEqual(here + 1e-6); // drawn later: nearer
            }
          });
        }
      }
      expect(checked).toBeGreaterThan(0);
    });

    it("draws the Sea through Year 2 and not at all once it has fallen away out of the frame in Year 3", async () => {
      current = make();
      await current.ready;
      current.resize(390, 844);
      const seaDrawn = (p: number) => {
        let drawn = false;
        lastRenderer().render.mockImplementation(() => (drawn ||= stage().sea.visible));
        stage().update(p, 0.016);
        return drawn;
      };
      expect(seaDrawn(flyBy(5).alongside)).toBe(true);
      expect(seaDrawn(timeline.passes[2].to)).toBe(true); // below them at the start of the climb
      expect(seaDrawn(skyFlyBy(5).alongside)).toBe(false);
      expect(seaDrawn(1)).toBe(false);
      expect(seaDrawn(flyBy(5).alongside)).toBe(true); // and back, when she scrolls up
    });

    it("loads each Year 3 picture before it is clear and frees it again once the Flyers are well past, never holding more than 4", async () => {
      current = make();
      current.resize(390, 844);
      const k = 6;
      const src = memories[skyFlyBy(k).index].src;
      const callOf = () => (loadPhoto.mock.calls as unknown as [string][]).findIndex(([s]) => s === src);
      let most = 0;
      for (let p = skyFlyBy(k).alongside - 0.06; p <= skyFlyBy(k).alongside + 0.14; p += 0.002) {
        stage().update(p, 0.016);
        await flush();
        most = Math.max(most, stage().textures);
        // From a little before it starts to show until it has gone, its photo is in memory.
        if (Math.abs(p - skyFlyBy(k).alongside) < 0.01) expect(callOf()).toBeGreaterThanOrEqual(0);
      }
      expect(most).toBeLessThanOrEqual(4);
      expect(photos[callOf()].dispose).toHaveBeenCalled();
    });

    it("loads only the pictures near the Flyers, a few at a time, all the way through Years 2 and 3", async () => {
      current = make();
      current.resize(390, 844);
      let most = 0;
      for (let p = timeline.levelAt; p <= 1; p += 0.004) {
        stage().update(p, 0.016);
        await flush();
        most = Math.max(most, stage().textures);
      }
      expect(most).toBeLessThanOrEqual(4);
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
