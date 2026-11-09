/**
 * The timeline: where each Chapter title, Memory, Cloud pass and the end of the flight happen along the scroll.
 *
 * Everything is worked out in "screens" (one screen = the viewport height, `svh`) and turned into scroll progress
 * (0 to 1), so the scene never has to measure the page. The page itself is just invisible spacers of the
 * same heights (see components/Memories.tsx), which is what makes the two agree.
 */
import type { Chapter } from "@/content/memories";
import type { Schedule } from "@/lib/route";

/**
 * The Chapters whose Memories are Fly-bys (hanging beside the route, clear as the Flyers pass) and not Pop-outs from
 * behind a Cloud. How we met and Year 1 keep the Pop-out. Year 2's are over the Sea; Year 3's will be in the open Sky (ticket 08d).
 */
export const FLY_BY_CHAPTERS: readonly string[] = ["year-2", "year-3"];

/** The Chapter whose Fly-bys are over the Sea: the Sea leg of the route is flown for these pictures only. */
export const SEA_CHAPTER = "year-2";

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
  /** Scroll given to each Pop-out Memory (arrive, be read, leave). */
  memory: 1.2,
  /** Scroll given to each Fly-by Memory (haze, clear as the Flyers pass, haze again). */
  flyByMemory: 0.8,
  /** After the dive pass clears, the Flyers take this long to pull out and be level over the Sea. */
  levelOut: 0.6,
  /** After the last Sea picture the Flyers start to pull up out of the Sea this long later (before the Year 2 to Year 3 Cloud pass, which begins 0.05 screens after the Chapter change). */
  pullUpAfter: 0.15,
  /** After the last Memory (screens counted from the end of the last Memory): the Flyers slow to a stop, then the Letter. */
  restFrom: 0.2,
  restTo: 2.0,
  /** The Letter's card rises while the Flyers finish slowing; the greeting starts writing once they have settled. */
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

export type TimelineMemory = Span & { index: number; chapterId: string; motion: "pop-out" | "fly-by" };

/** A Fly-by picture: which Memory it is (and its Chapter), the progress at which the Flyers are alongside it, and the side it hangs on. */
export type FlyBy = { index: number; chapterId: string; alongside: number; side: "left" | "right" };

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
  /** The Fly-by pictures in order, with the side each hangs on (alternating, starting on the left). */
  flyBys: FlyBy[];
  /** The Fly-bys over the Sea (Year 2's): the first of `flyBys`. The Sea leg of the route is flown for these. */
  seaFlyBys: FlyBy[];
  /** When the Flyers have pulled out of the dive and are level over the Sea (a little after the Year 1 to Year 2 Cloud pass clears). */
  levelAt: number;
  /** When the Flyers have finished the Sea leg and begin to pull up out of the water, a little after the last Sea picture. */
  pullUpFrom: number;
  /** The stretch over which the Flyers slow to a stop under the Letter; they are at rest by `rest.to` (`Schedule.restAt`). */
  rest: Span;
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
  const rawMemories: { index: number; chapterId: string; from: number; to: number; motion: "pop-out" | "fly-by" }[] = [];
  const spacers: Spacer[] = [{ kind: "intro", screens: SCREENS.intro }];
  cursor += SCREENS.intro;
  let index = 0;
  for (const chapter of chapters) {
    const from = cursor;
    spacers.push({ kind: "title", screens: SCREENS.title, chapterId: chapter.id });
    cursor += SCREENS.title;
    const motion = FLY_BY_CHAPTERS.includes(chapter.id) ? "fly-by" : "pop-out";
    const screens = motion === "fly-by" ? SCREENS.flyByMemory : SCREENS.memory;
    for (let i = 0; i < chapter.memories.length; i++) {
      rawMemories.push({ index, chapterId: chapter.id, from: cursor, to: cursor + screens, motion });
      spacers.push({ kind: "memory", screens, chapterId: chapter.id, memoryIndex: index });
      cursor += screens;
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
  const memories = rawMemories.map((m): TimelineMemory => ({ index: m.index, chapterId: m.chapterId, from: p(m.from), to: p(m.to), motion: m.motion }));
  const flyBys = memories
    .filter((m) => m.motion === "fly-by")
    .map((m, k): FlyBy => ({ index: m.index, chapterId: m.chapterId, alongside: (m.from + m.to) / 2, side: k % 2 === 0 ? "left" : "right" }));
  const seaFlyBys = flyBys.filter((f) => f.chapterId === SEA_CHAPTER);
  // The Chapter changes are the starts of every Chapter but the first.
  const passes = rawChapters.slice(1).map((c) => ({
    centre: p(c.from + SCREENS.passCentre),
    from: p(c.from + SCREENS.passCentre - SCREENS.passSpan / 2),
    to: p(c.from + SCREENS.passCentre + SCREENS.passSpan / 2),
  }));
  const levelAt = passes.length >= 2 ? passes[1].to + p(SCREENS.levelOut) : passes.length ? passes[0].to + p(SCREENS.levelOut) : 0;
  // Pull up a little after the last Sea picture; never later than the Cloud pass that hides the swing.
  const lastSea = seaFlyBys[seaFlyBys.length - 1];
  const pullUpFrom = Math.min(lastSea ? lastSea.alongside + p(SCREENS.pullUpAfter) : levelAt, passes[2] ? passes[2].from - p(0.1) : 1);
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
    memories,
    passes,
    flyBys,
    seaFlyBys,
    levelAt,
    pullUpFrom,
    rest: { from: p(tailStart + SCREENS.restFrom), to: p(tailStart + SCREENS.restTo) },
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

/**
 * What the Flight path needs from the timeline: when it starts, when the Cloud passes happen, when the Flyers are level
 * over the Sea, where Year 2's Fly-by pictures are, when they pull up out of the Sea, and when they slow and come to rest at the end.
 */
export function scheduleOf(timeline: Timeline): Schedule {
  return {
    start: timeline.flyersPop.from,
    passes: timeline.passes,
    levelAt: timeline.levelAt,
    flyBys: timeline.seaFlyBys,
    pullUpFrom: timeline.pullUpFrom,
    restFrom: timeline.rest.from,
    restAt: timeline.rest.to,
  };
}

/** How long, in seconds, a relaxed pass through the whole story takes. Use it to judge whether the story is the right length. */
export function relaxedSeconds(timeline: Pick<Timeline, "scrollScreens">): number {
  return timeline.scrollScreens * RELAXED_SECONDS_PER_SCREEN;
}
