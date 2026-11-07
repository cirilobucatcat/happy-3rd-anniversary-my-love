import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFlyersScene, type RendererLike } from "@/lib/scene";

function fakeRenderer(canvas: HTMLCanvasElement) {
  return {
    domElement: canvas,
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    forceContextLoss: vi.fn(),
  } satisfies RendererLike;
}

const quickModel = async () => {
  const model = new Group();
  model.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
  return { model, source: "placeholder" as const };
};

describe("createFlyersScene", () => {
  let container: HTMLDivElement;
  const renderers: ReturnType<typeof fakeRenderer>[] = [];
  const createRenderer = (canvas: HTMLCanvasElement) => {
    const r = fakeRenderer(canvas);
    renderers.push(r);
    return r;
  };
  const make = () => createFlyersScene(container, { createRenderer, loadCouple: quickModel })!;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    renderers.length = 0;
  });
  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it("puts exactly one canvas in the container", () => {
    const scene = make();
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    scene.dispose();
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
    const scene = make();
    scene.resize(390, 844);
    scene.update(0.3, 0.016);
    scene.dispose();
    scene.dispose();
    expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("canvas")).toBeNull();
    renderers[0].render.mockClear();
    scene.update(0.5, 0.016);
    scene.resize(800, 600);
    expect(renderers[0].render).not.toHaveBeenCalled();
  });

  it("renders once per update", async () => {
    const scene = make();
    await scene.ready;
    scene.resize(390, 844);
    renderers[0].render.mockClear();
    scene.update(0.5, 0.016);
    expect(renderers[0].render).toHaveBeenCalledTimes(1);
    scene.dispose();
  });

  it("redraws straight after a resize, because resizing clears the canvas and would flash blank until the next tick", async () => {
    const scene = make();
    await scene.ready;
    scene.resize(1440, 900);
    scene.update(0.5, 0.016);
    renderers[0].render.mockClear();
    scene.resize(390, 844);
    expect(renderers[0].render).toHaveBeenCalledTimes(1);
    scene.dispose();
  });

  it("caps the pixel ratio at 2 so phones with 3x screens stay smooth", () => {
    vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(3);
    const scene = make();
    scene.resize(390, 844);
    expect(renderers[0].setPixelRatio).toHaveBeenLastCalledWith(2);
    vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(1.5);
    scene.resize(390, 844);
    expect(renderers[0].setPixelRatio).toHaveBeenLastCalledWith(1.5);
    scene.dispose();
  });

  it("sizes the drawing buffer to the container without touching the canvas CSS size", () => {
    const scene = make();
    scene.resize(1440, 900);
    expect(renderers[0].setSize).toHaveBeenLastCalledWith(1440, 900, false);
    scene.dispose();
  });

  it("moves the Flyers along the path, and scrolling back up returns them to the same place", async () => {
    const scene = make();
    await scene.ready;
    scene.resize(1440, 900);
    scene.update(0.5, 0.016);
    const mid = scene.flyers.position.clone();
    scene.update(0.9, 0.016);
    expect(scene.flyers.position.distanceTo(mid)).toBeGreaterThan(0.5);
    scene.update(0.5, 0.016);
    expect(scene.flyers.position.distanceTo(mid)).toBeLessThan(1e-9);
    scene.dispose();
  });

  it("refits the path when the container changes shape", async () => {
    const scene = make();
    await scene.ready;
    scene.resize(1440, 900);
    scene.update(0.5, 0.016);
    const laptop = scene.flyers.position.clone();
    scene.resize(390, 844);
    scene.update(0.5, 0.016);
    expect(scene.flyers.position.distanceTo(laptop)).toBeGreaterThan(0.1);
    scene.dispose();
  });

  it("frees a model that finishes loading after the scene was disposed", async () => {
    let finish!: () => void;
    const geometry = new BoxGeometry(1, 1, 1);
    const spy = vi.spyOn(geometry, "dispose");
    const scene = createFlyersScene(container, {
      createRenderer,
      loadCouple: () =>
        new Promise((resolve) => {
          finish = () => {
            const model = new Group();
            model.add(new Mesh(geometry, new MeshBasicMaterial()));
            resolve({ model, source: "glb" as const });
          };
        }),
    })!;
    scene.dispose();
    finish();
    await scene.ready;
    expect(spy).toHaveBeenCalled();
  });

  it("returns null and leaves nothing behind when WebGL is unavailable", () => {
    const scene = createFlyersScene(container, {
      createRenderer: () => {
        throw new Error("no webgl");
      },
      loadCouple: quickModel,
    });
    expect(scene).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });
});
