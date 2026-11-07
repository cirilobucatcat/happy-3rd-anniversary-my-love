/**
 * The timeline: where each Chapter title, Memory, Cloud pass and the Turn-around happen along the scroll.
 *
 * Everything is worked out in "screens" (one screen = the viewport height, `svh`) and turned into scroll progress
 * (0 to 1), so the scene never has to measure the page. The page itself is just invisible spacers of the
 * same heights (see components/Memories.tsx), which is what makes the two agree.
 */
import type { Chapter } from "@/content/memories";
import type { Schedule } from "@/lib/route";

/** Layout in screens. Memories follow one another, so the next one arrives as the last one leaves. */
export const SCREENS = {
  /** Space a Chapter's title takes before its first Memory. The title writes inside it, and (after the first) a Cloud pass too. */
  title: 2.0,
  titleWriteFrom: 0.1,
  titleWriteTo: 1.2,
  /** The written title holds, then fades away, so the Chapter's first Memory has the screen to itself. */
  titleFadeFrom: 1.7,
  titleFadeTo: 1.9,
  /** Scroll given to each Memory (arrive, be read, leave). */
  memory: 1.2,
  /** After the last Memory: the Turn-around, then (ticket 04) the Letter. */
  tail: 2.2,
  turnAroundFrom: 0.2,
  turnAroundTo: 2.0,
  /** The Flyers spring up this long after the first title finishes writing, over this much scrolling. */
  flyersPopDelay: 0.1,
  flyersPopSpan: 0.3,
  /** A Cloud pass sits this far after a Chapter change, and spans this many screens in total. */
  passCentre: 0.3,
  passSpan: 0.5,
} as const;

export type Span = { from: number; to: number };

export type TimelineChapter = Span & {
  id: string;
  title: string;
  /** The Chapter title's Write-on runs across [titleFrom, titleTo] (progress). */
  titleFrom: number;
  titleTo: number;
  /** The finished title fades out across [fadeFrom, fadeTo]. */
  fadeFrom: number;
  fadeTo: number;
};

export type TimelineMemory = Span & { index: number; chapterId: string };

export type Pass = Span & { centre: number };

export type Spacer = { kind: "title" | "memory" | "tail"; screens: number; chapterId?: string; memoryIndex?: number };

export type Timeline = {
  /** How far she can scroll, in screens. The page is one screen taller than this. */
  scrollScreens: number;
  chapters: TimelineChapter[];
  memories: TimelineMemory[];
  /** One per Chapter change, centred a little after the change. */
  passes: Pass[];
  turnAround: Span;
  /** When the Flyers spring up: just after the first Chapter title has finished writing. The Flight path starts here. */
  flyersPop: Span;
  /** Heights in screens, in page order, of the invisible spacers that make the page as long as the scroll. */
  spacers: Spacer[];
};

export function buildTimeline(chapters: readonly Chapter[]): Timeline {
  // Work in screens first.
  let cursor = 0;
  const rawChapters: { id: string; title: string; from: number; to: number }[] = [];
  const rawMemories: { index: number; chapterId: string; from: number; to: number }[] = [];
  const spacers: Spacer[] = [];
  let index = 0;
  for (const chapter of chapters) {
    const from = cursor;
    spacers.push({ kind: "title", screens: SCREENS.title, chapterId: chapter.id });
    cursor += SCREENS.title;
    for (let i = 0; i < chapter.memories.length; i++) {
      rawMemories.push({ index, chapterId: chapter.id, from: cursor, to: cursor + SCREENS.memory });
      spacers.push({ kind: "memory", screens: SCREENS.memory, chapterId: chapter.id, memoryIndex: index });
      cursor += SCREENS.memory;
      index += 1;
    }
    rawChapters.push({ id: chapter.id, title: chapter.title, from, to: cursor });
  }
  const tailStart = cursor;
  spacers.push({ kind: "tail", screens: SCREENS.tail });
  const total = cursor + SCREENS.tail;

  const p = (screens: number) => screens / total;
  return {
    scrollScreens: total,
    chapters: rawChapters.map((c) => ({
      id: c.id,
      title: c.title,
      from: p(c.from),
      to: p(c.to),
      titleFrom: p(c.from + SCREENS.titleWriteFrom),
      titleTo: p(c.from + SCREENS.titleWriteTo),
      fadeFrom: p(c.from + SCREENS.titleFadeFrom),
      fadeTo: p(c.from + SCREENS.titleFadeTo),
    })),
    memories: rawMemories.map((m) => ({ index: m.index, chapterId: m.chapterId, from: p(m.from), to: p(m.to) })),
    // The Chapter changes are the starts of every Chapter but the first.
    passes: rawChapters.slice(1).map((c) => ({
      centre: p(c.from + SCREENS.passCentre),
      from: p(c.from + SCREENS.passCentre - SCREENS.passSpan / 2),
      to: p(c.from + SCREENS.passCentre + SCREENS.passSpan / 2),
    })),
    turnAround: { from: p(tailStart + SCREENS.turnAroundFrom), to: p(tailStart + SCREENS.turnAroundTo) },
    flyersPop: {
      from: p(rawChapters[0].from + SCREENS.titleWriteTo + SCREENS.flyersPopDelay),
      to: p(rawChapters[0].from + SCREENS.titleWriteTo + SCREENS.flyersPopDelay + SCREENS.flyersPopSpan),
    },
    spacers,
  };
}

/** How far through a stretch of scroll `progress` is, 0 to 1 (clamped). */
export function phaseOf(span: Span, progress: number): number {
  return Math.min(1, Math.max(0, (progress - span.from) / (span.to - span.from)));
}

/** What the Flight path needs from the timeline: when it starts, and when the Cloud passes and the Turn-around happen. */
export function scheduleOf(timeline: Timeline): Schedule {
  return { start: timeline.flyersPop.from, passes: timeline.passes, turnAround: timeline.turnAround };
}
