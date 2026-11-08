/**
 * Keeps an eye on a canvas's WebGL context. The browser can take it away (an iPhone does when she switches apps) and
 * three.js rebuilds its GPU objects when it comes back, but only if we let the browser give it back; and if it never
 * does, the owner has to build a new canvas. Browser only.
 */

/** How long a lost context may stay lost, with the page visible, before the owner is asked to rebuild. */
export const CONTEXT_RESTORE_WAIT_MS = 3000;

export type ContextWatchHandlers = {
  /** The browser gave the context back: redraw at once, so the canvas is never left blank waiting for the next tick. */
  onRestored: () => void;
  /** The context is still gone after `CONTEXT_RESTORE_WAIT_MS` of the page being visible: build a fresh canvas. */
  onFailed?: () => void;
};

export type ContextWatch = {
  /** True while the context is gone: there is nothing to draw into. */
  readonly lost: boolean;
  dispose(): void;
};

export function watchContext(canvas: HTMLCanvasElement, { onRestored, onFailed }: ContextWatchHandlers): ContextWatch {
  let lost = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stopWaiting = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  // The wait only runs while she is looking at the page: a hidden page can't get a new context anyway, and a wait
  // that was running when she left starts again in full when she is back.
  const startWaiting = () => {
    stopWaiting();
    if (document.hidden) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (lost) onFailed?.();
    }, CONTEXT_RESTORE_WAIT_MS);
  };

  const onContextLost = (event: Event) => {
    event.preventDefault(); // without this the browser never offers the context back
    lost = true;
    startWaiting();
  };
  const onContextRestored = () => {
    lost = false;
    stopWaiting();
    onRestored();
  };
  const onVisibility = () => {
    if (!lost) return;
    if (document.hidden) stopWaiting();
    else startWaiting();
  };

  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  document.addEventListener("visibilitychange", onVisibility);

  return {
    get lost() {
      return lost;
    },
    dispose() {
      stopWaiting();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
