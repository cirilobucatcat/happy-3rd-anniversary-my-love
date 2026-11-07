import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The one scroll source and the one render tick.
 *
 * - A single ScrollTrigger scrubs a tween across the whole page, giving a smoothed
 *   progress value from 0 to 1.
 * - A single gsap.ticker callback reads that value and tells every subscriber.
 * - Nothing else in the app listens to scroll.
 */

export type Subscriber = (progress: number, dt: number) => void;

export type StartOptions = {
  /** Open the page at this progress (0..1), e.g. from `?p=0.4`. */
  initialProgress?: number | null;
};

const SMOOTHING_SECONDS = 0.6;

const subscribers = new Set<Subscriber>();
const state = { progress: 0 };
let tickerCallbacks = 0;
let teardownCurrent: (() => void) | null = null;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Reads `?p=0.4` from a query string. Returns null if absent or not a number. */
export function parseStartProgress(search: string): number | null {
  const raw = new URLSearchParams(search).get("p");
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? clamp01(n) : null;
}

/** Every module calls this to get (progress, dt in seconds) on each tick. Returns an unsubscribe. */
export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Live counts for the `?debug` overlay and the tests. */
export function debugStats() {
  return {
    progress: state.progress,
    triggers: ScrollTrigger.getAll().length,
    tickerCallbacks,
  };
}

/**
 * Creates the ScrollTrigger and the ticker callback. Returns a cleanup that removes both.
 * Safe to call twice (React Strict Mode, hot reload): a previous instance is torn down first.
 * Browser only: call from an effect, never during server render.
 */
export function startScroll(options: StartOptions = {}): () => void {
  teardownCurrent?.();

  gsap.registerPlugin(ScrollTrigger);

  state.progress = 0;
  const tween = gsap.to(state, { progress: 1, ease: "none", paused: true });
  const trigger = ScrollTrigger.create({
    trigger: document.documentElement,
    start: "top top",
    end: "bottom bottom",
    animation: tween,
    scrub: SMOOTHING_SECONDS,
  });

  const onTick = (_time: number, deltaMs: number) => {
    const dt = deltaMs / 1000;
    for (const fn of subscribers) fn(state.progress, dt);
  };
  gsap.ticker.add(onTick);
  tickerCallbacks += 1;

  const { initialProgress } = options;
  if (initialProgress != null) {
    ScrollTrigger.refresh();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, clamp01(initialProgress) * Math.max(0, max));
    tween.progress(clamp01(initialProgress));
  }

  let done = false;
  const teardown = () => {
    if (done) return;
    done = true;
    gsap.ticker.remove(onTick);
    tickerCallbacks -= 1;
    trigger.kill();
    tween.kill();
    if (teardownCurrent === teardown) teardownCurrent = null;
  };
  teardownCurrent = teardown;
  return teardown;
}

/** Runs `fn` whenever ScrollTrigger recomputes layout (resize, load). Returns an unsubscribe. */
export function onLayout(fn: () => void): () => void {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.addEventListener("refresh", fn);
  return () => ScrollTrigger.removeEventListener("refresh", fn);
}

/** Tells ScrollTrigger the page height changed (for instance when the plain list replaces the spacers). */
export function refreshScroll(): void {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.refresh();
}
