import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { debugStats, parseStartProgress, startScroll, subscribe } from "@/lib/scroll";

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  ScrollTrigger.getAll().forEach((t) => t.kill());
});

describe("parseStartProgress", () => {
  it("reads ?p= as a number", () => {
    expect(parseStartProgress("?p=0.4")).toBe(0.4);
  });

  it("clamps to 0..1", () => {
    expect(parseStartProgress("?p=7")).toBe(1);
    expect(parseStartProgress("?p=-2")).toBe(0);
  });

  it("returns null when absent or not a number", () => {
    expect(parseStartProgress("")).toBeNull();
    expect(parseStartProgress("?debug")).toBeNull();
    expect(parseStartProgress("?p=abc")).toBeNull();
  });
});

describe("startScroll", () => {
  it("creates exactly one ScrollTrigger and one ticker callback", () => {
    const stop = startScroll();
    expect(debugStats()).toMatchObject({ triggers: 1, tickerCallbacks: 1 });
    stop();
  });

  it("leaves nothing behind after teardown", () => {
    startScroll()();
    expect(debugStats()).toMatchObject({ triggers: 0, tickerCallbacks: 0 });
  });

  it("survives React Strict Mode: mount, cleanup, mount leaves exactly one of each", () => {
    startScroll()();
    const stop = startScroll();
    expect(debugStats()).toMatchObject({ triggers: 1, tickerCallbacks: 1 });
    stop();
    expect(debugStats()).toMatchObject({ triggers: 0, tickerCallbacks: 0 });
  });

  it("survives a hot reload that mounts again without cleaning up first", () => {
    startScroll();
    const stop = startScroll();
    expect(debugStats()).toMatchObject({ triggers: 1, tickerCallbacks: 1 });
    stop();
  });

  it("calls each subscriber once per tick, even after a double mount", () => {
    startScroll()();
    const stop = startScroll();
    const fn = vi.fn();
    const unsubscribe = subscribe(fn);
    gsap.ticker.tick();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    unsubscribe();
    gsap.ticker.tick();
    expect(fn).toHaveBeenCalledTimes(1);
    stop();
  });

  it("opens at the requested progress", () => {
    const stop = startScroll({ initialProgress: 0.4 });
    const fn = vi.fn();
    subscribe(fn);
    gsap.ticker.tick();
    expect(fn.mock.calls[0][0]).toBeCloseTo(0.4);
    stop();
  });

  it("stops notifying subscribers after teardown", () => {
    const stop = startScroll();
    const fn = vi.fn();
    subscribe(fn);
    stop();
    gsap.ticker.tick();
    expect(fn).not.toHaveBeenCalled();
  });
});
