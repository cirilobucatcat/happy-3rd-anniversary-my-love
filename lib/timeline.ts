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
  /** The Intro: the first thing she sees once the gate opens. It holds still, then fades as she starts to scroll. */
  intro: 0.7,
  introFadeFrom: 0.25,
  introFadeTo: 0.65,
  /** Space a Chapter's title takes before its first Memory. The title writes inside it, and (after the first) a Cloud pass too. */
  title: 2.0,
  titleWriteFrom: 0.1,
  titleWriteTo: 1.2,
  /** The Chapter's date writes just under its title, starting as the title nears its end. */
  dateWriteFrom: 1.0,
  dateWriteTo: 1.45,
  /** The written title holds, then fades away, so the Chapter's first Memory has the screen to itself. */
  titleFadeFrom: 1.7,
  titleFadeTo: 1.9,
  /** Scroll given to each Memory (arrive, be read, leave). */
  memory: 1.2,
  /** After the last Memory (screens counted from the end of the last Memory): the Turn-around, then the Letter. */
  turnAroundFrom: 0.2,
  turnAroundTo: 2.0,
  /** The Letter's card rises while the Flyers finish turning; the greeting starts writing once they have settled. */
  letterCardFrom: 1.2,
  letterCardTo: 2.0,
  greeting: 0.6,
  /** The body appears line by line over this many screens: more for a longer Letter (by word count), within limits. */
  letterWordsPerScreen: 28,
  letterBodyMin: 3,
  letterBodyMax: 14,
  /** The Closing line writes last, then the scroll holds so it stays on screen. */
  closing: 0.9,
  hold: 0.4,
  /** The Flyers spring up this long after the first title finishes writing, over this much scrolling. */
  flyersPopDelay: 0.1,
  flyersPopSpan: 0.3,
  /** A Cloud pass sits this far after a Chapter change, and spans this many screens in total. */
  passCentre: 0.3,
  passSpan: 0.5,
} as const;

/**
 * How long one screen of scrolling takes at a relaxed pace: a lazy flick, a look, another flick. At 1.2 screens a
 * Memory, that is a little under 8 seconds each; the Letter section comes to about a minute.
 */
export const RELAXED_SECONDS_PER_SCREEN = 6.5;

/** The Letter's word count used when none is given (the placeholder Letter is about this long). */
const DEFAULT_LETTER_WORDS = 110;

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
  /** The Chapter's date (ISO) and the Write-on of its large date under the title, across [dateFrom, dateTo] (progress). */
  date: string;
  dateFrom: number;
  dateTo: number;
};

export type TimelineMemory = Span & { index: number; chapterId: string };

export type Pass = Span & { centre: number };

export type Spacer = { kind: "intro" | "title" | "memory" | "tail"; screens: number; chapterId?: string; memoryIndex?: number };

/** The Letter's stretches of scroll, in order: card up, greeting, body line by line, then the Closing line last. */
export type LetterSpans = { card: Span; greeting: Span; body: Span; closing: Span };

export type TimelineOptions = {
  /** Words in the Letter's body; a longer Letter gets more scroll. */
  letterWords?: number;
};

export type Timeline = {
  /** How far she can scroll, in screens. The page is one screen taller than this. */
  scrollScreens: number;
  chapters: TimelineChapter[];
  memories: TimelineMemory[];
  /** One per Chapter change, centred a little after the change. */
  passes: Pass[];
  turnAround: Span;
  /** The Intro's stretch, and the part of it over which it fades away. */
  intro: Span;
  introFade: Span;
  letter: LetterSpans;
  /** When the Flyers spring up: just after the first Chapter title has finished writing. The Flight path starts here. */
  flyersPop: Span;
  /** Heights in screens, in page order, of the invisible spacers that make the page as long as the scroll. */
  spacers: Spacer[];
};

export function buildTimeline(chapters: readonly Chapter[], options: TimelineOptions = {}): Timeline {
  const letterWords = options.letterWords ?? DEFAULT_LETTER_WORDS;
  const bodyScreens = Math.min(SCREENS.letterBodyMax, Math.max(SCREENS.letterBodyMin, letterWords / SCREENS.letterWordsPerScreen));

  // Work in screens first.
  let cursor = 0;
  const rawChapters: { id: string; title: string; date: string; from: number; to: number }[] = [];
  const rawMemories: { index: number; chapterId: string; from: number; to: number }[] = [];
  const spacers: Spacer[] = [{ kind: "intro", screens: SCREENS.intro }];
  cursor += SCREENS.intro;
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
    rawChapters.push({ id: chapter.id, title: chapter.title, date: chapter.date, from, to: cursor });
  }
  const tailStart = cursor;
  // The Letter: the greeting, then the body, then the Closing line, then a hold so the last line stays on screen.
  const greetingFrom = SCREENS.letterCardTo;
  const bodyFrom = greetingFrom + SCREENS.greeting;
  const closingFrom = bodyFrom + bodyScreens;
  const closingTo = closingFrom + SCREENS.closing;
  const tail = closingTo + SCREENS.hold;
  spacers.push({ kind: "tail", screens: tail });
  const total = cursor + tail;

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
      date: c.date,
      dateFrom: p(c.from + SCREENS.dateWriteFrom),
      dateTo: p(c.from + SCREENS.dateWriteTo),
    })),
    memories: rawMemories.map((m) => ({ index: m.index, chapterId: m.chapterId, from: p(m.from), to: p(m.to) })),
    // The Chapter changes are the starts of every Chapter but the first.
    passes: rawChapters.slice(1).map((c) => ({
      centre: p(c.from + SCREENS.passCentre),
      from: p(c.from + SCREENS.passCentre - SCREENS.passSpan / 2),
      to: p(c.from + SCREENS.passCentre + SCREENS.passSpan / 2),
    })),
    turnAround: { from: p(tailStart + SCREENS.turnAroundFrom), to: p(tailStart + SCREENS.turnAroundTo) },
    intro: { from: 0, to: p(SCREENS.intro) },
    introFade: { from: p(SCREENS.introFadeFrom), to: p(SCREENS.introFadeTo) },
    letter: {
      card: { from: p(tailStart + SCREENS.letterCardFrom), to: p(tailStart + SCREENS.letterCardTo) },
      greeting: { from: p(tailStart + greetingFrom), to: p(tailStart + bodyFrom) },
      body: { from: p(tailStart + bodyFrom), to: p(tailStart + closingFrom) },
      closing: { from: p(tailStart + closingFrom), to: p(tailStart + closingTo) },
    },
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

/** How long, in seconds, a relaxed pass through the whole story takes. Use it to judge whether the story is the right length. */
export function relaxedSeconds(timeline: Pick<Timeline, "scrollScreens">): number {
  return timeline.scrollScreens * RELAXED_SECONDS_PER_SCREEN;
}
