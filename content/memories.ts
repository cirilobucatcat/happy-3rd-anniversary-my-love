import { addMonths, addYears, monthLabel } from "@/lib/days";

/**
 * THE content file. Swap photos, Captions and dates here and nothing else needs to change: the left/right side is
 * worked out from the order, so it always alternates. (Keep each Year at exactly 12 Memories, see below.)
 *
 * Everything marked PLACEHOLDER is stand-in text until the Creator supplies the real thing: the Day 1 date, the
 * Unlock question and its answers, the Intro, and the Letter. Photos and Captions are placeholders too.
 *
 * Dates are written YYYY-MM-DD. Day 1 is the day they became a couple. The three Year Chapters hang off it (Year 1
 * opens on Day 1, Year 2 a year later, Year 3 two years later) and the Anniversary is three years after, so changing
 * DAY_ONE changes every date and every number on the Day counter with no other edit. How we met sits before Day 1,
 * so it keeps a date of its own.
 *
 * One picture for every Month. Each Year holds exactly 12 Memories, in order, one for each Month counted from Day 1
 * (Year 1 is Months 1 to 12, Year 2 is 13 to 24, Year 3 is 25 to 36). A Year's Memory has no Caption: its handwritten
 * line is the Month label ("August 2024"), worked out from DAY_ONE, so moving Day 1 moves every label. How we met
 * has 3 Memories and keeps a Caption of the Creator's own words under each. A Chapter says which it is with `kind`:
 * "met" (How we met, its Memories carry a `caption`) or "year" (a Year, its Memories are just a photo).
 *
 * Photos live in /public/photos. Drop a photo there, then run `npm run resize-photos`.
 * `ratio` is width / height of the photo (default 0.8, a portrait photo). Set it for
 * landscape (1.33) or square (1) photos so nothing gets cropped.
 * `alt` is what a screen reader says about the photo (default: the Month label, or the Caption in How we met).
 */

/** PLACEHOLDER: the day they became a couple. The Day counter starts here, at Day 1. */
export const DAY_ONE = "2024-02-14";

/** The day the Recipient receives the site: three years after Day 1. With the placeholder Day 1 it is Day 1,097. */
export const ANNIVERSARY = addYears(DAY_ONE, 3);

/** Language used to write out dates such as "February 14, 2024". */
export const DATE_LOCALE = "en-US";

/**
 * The Song: the path of one MP3 inside /public, for example "/audio/our-song.mp3" (about 3 to 4 MB). It plays only when
 * the Recipient taps the Sound button. Leave it empty and the button is hidden: the site works silently.
 */
export const SITE = {
  song: "",
};

/** Which handwritten line a Memory carries: a Caption (How we met, up to two lines) or a Month label (the Years, one short line). */
export type LineKind = "caption" | "month";

/** A How we met Memory: a photo with a Caption in the Creator's own words (up to two short lines). */
export type MetMemory = {
  src: string;
  caption: string;
  ratio?: number;
  alt?: string;
};

/** A Memory in Year 1, 2 or 3: just a photo. Its handwritten line is its Month label, so it has no Caption. */
export type YearMemory = {
  src: string;
  ratio?: number;
  alt?: string;
};

type ChapterBase = {
  id: string;
  title: string;
  /** ISO date the Chapter opens (placeholder dates until the Creator supplies real ones). */
  date: string;
};

/** How we met: before Day 1, so no Months, and 3 Captions. */
export type MetChapter = ChapterBase & { kind: "met"; memories: MetMemory[] };

/** Year 1, 2 or 3: 12 Memories, one for every Month. */
export type YearChapter = ChapterBase & { kind: "year"; memories: YearMemory[] };

export type Chapter = MetChapter | YearChapter;

/** One Memory as the rest of the site sees it: where it sits, and the handwritten line under it. */
export type Memory = {
  src: string;
  /** Width / height of the photo. */
  ratio: number;
  /** What a screen reader says about the photo: the Creator's own alt text, else the line below. */
  alt: string;
  /** The handwritten line under the frame: a Caption (How we met) or a Month label such as "August 2024" (the Years). */
  line: string;
  kind: LineKind;
  side: "left" | "right";
  chapterId: string;
};

export const CHAPTERS: Chapter[] = [
  {
    kind: "met",
    id: "met",
    title: "How we met",
    date: "2024-01-05",
    memories: [
      { src: "/photos/01.svg", caption: "The very first hello", ratio: 0.8 },
      { src: "/photos/02.svg", caption: "You laughed at my joke", ratio: 1 },
      { src: "/photos/03.svg", caption: "I did not want the night to end", ratio: 0.75 },
    ],
  },
  {
    kind: "year",
    id: "year-1",
    title: "Year 1",
    date: DAY_ONE,
    memories: [
      { src: "/photos/04.svg", ratio: 0.8 },
      { src: "/photos/05.svg", ratio: 1.33 },
      { src: "/photos/06.svg", ratio: 0.8 },
      { src: "/photos/07.svg", ratio: 1 },
      { src: "/photos/08.svg", ratio: 0.75 },
      { src: "/photos/09.svg", ratio: 0.8 },
      { src: "/photos/10.svg", ratio: 1.33 },
      { src: "/photos/11.svg", ratio: 1 },
      { src: "/photos/12.svg", ratio: 0.8 },
      { src: "/photos/13.svg", ratio: 0.75 },
      { src: "/photos/14.svg", ratio: 1 },
      { src: "/photos/15.svg", ratio: 0.8 },
    ],
  },
  {
    kind: "year",
    id: "year-2",
    title: "Year 2",
    date: addYears(DAY_ONE, 1),
    memories: [
      { src: "/photos/16.svg", ratio: 0.8 },
      { src: "/photos/17.svg", ratio: 1.33 },
      { src: "/photos/18.svg", ratio: 0.8 },
      { src: "/photos/19.svg", ratio: 1 },
      { src: "/photos/20.svg", ratio: 0.75 },
      { src: "/photos/21.svg", ratio: 0.8 },
      { src: "/photos/22.svg", ratio: 1.33 },
      { src: "/photos/23.svg", ratio: 1 },
      { src: "/photos/24.svg", ratio: 0.8 },
      { src: "/photos/25.svg", ratio: 0.75 },
      { src: "/photos/26.svg", ratio: 1 },
      { src: "/photos/27.svg", ratio: 0.8 },
    ],
  },
  {
    kind: "year",
    id: "year-3",
    title: "Year 3",
    date: addYears(DAY_ONE, 2),
    memories: [
      { src: "/photos/28.svg", ratio: 0.8 },
      { src: "/photos/29.svg", ratio: 1.33 },
      { src: "/photos/30.svg", ratio: 0.8 },
      { src: "/photos/31.svg", ratio: 1 },
      { src: "/photos/32.svg", ratio: 0.75 },
      { src: "/photos/33.svg", ratio: 0.8 },
      { src: "/photos/34.svg", ratio: 1.33 },
      { src: "/photos/35.svg", ratio: 1 },
      { src: "/photos/36.svg", ratio: 0.8 },
      { src: "/photos/37.svg", ratio: 0.75 },
      { src: "/photos/38.svg", ratio: 1 },
      { src: "/photos/39.svg", ratio: 0.8 },
    ],
  },
];

/** The Intro: the title screen she sees once the gate opens, before How we met begins. PLACEHOLDER. */
export const INTRO = {
  title: "Three years of us",
  line: "Scroll slowly. This one is all for you.",
};

/**
 * The Unlock question, asked before the site opens. PLACEHOLDER. A soft gate for a surprise, not real security: the
 * answers sit in the page's code. Case, spaces, punctuation and accents are ignored, so list a few real spellings
 * and not every typo. Keep the answer out of the question and the wrong-answer messages.
 */
export const GATE = {
  title: "Before we begin",
  question: "What do I call you when no one else is listening?",
  answers: ["my love", "love", "mylove"],
  button: "Open",
  placeholder: "Your answer",
  /** Shown one after another on wrong tries (then they start over). Kind, and never the answer. */
  wrongMessages: [
    "Not quite. Think back, you know this one.",
    "So close, but not yet. Try once more.",
    "Hmm, that's not it. I believe in you.",
    "Take your time. There's no rush at all.",
  ],
  /** Shown when she taps the button with nothing typed. */
  emptyMessage: "Type your answer first.",
};

/**
 * The Letter, on a cream card at the end. PLACEHOLDER: the Creator writes the real one, in any language the script
 * font can draw (plain Latin letters and common accents). The body comes in line by line; the greeting and the
 * Closing line write themselves on. A longer Letter simply scrolls for longer.
 */
export const LETTER = {
  greeting: "My love,",
  body: [
    "Three years ago I did not know an ordinary day could turn into the best one of my life. Then you laughed, and everything I thought I knew about being happy got rewritten.",
    "You have been my quiet mornings, my loud adventures, and the first person I want to tell everything to. Every photo you just flew past is a small piece of why I am so grateful.",
    "Thank you for choosing me, again and again. I would choose you in every sky, in every year, for as many as we get.",
  ],
  closing: "Happy 3rd anniversary, my love.",
};

export type LayoutOptions = {
  /** Where the Months are counted from (default: Day 1). */
  dayOne?: string;
  /** The language the Month labels are written in (default: `DATE_LOCALE`). */
  locale?: string;
};

/**
 * Flattens the Chapters into one ordered list, assigns alternating sides, and works out each handwritten line: a
 * Caption in How we met, a Month label in the Years. Months are counted through the Year Chapters in order, so the
 * first Year Memory is Month 1 (Day 1's own month and date) and the 13th is the first day of Year 2. Every label is
 * counted from Day 1 itself, so moving Day 1 moves them all and a short month clamps to its last day.
 */
export function layoutMemories(chapters: Chapter[], { dayOne = DAY_ONE, locale = DATE_LOCALE }: LayoutOptions = {}): Memory[] {
  const flat: Omit<Memory, "side">[] = [];
  let months = 0;
  for (const chapter of chapters) {
    if (chapter.kind === "met") {
      for (const m of chapter.memories) {
        flat.push({ src: m.src, ratio: m.ratio ?? 0.8, alt: m.alt ?? m.caption, line: m.caption, kind: "caption", chapterId: chapter.id });
      }
    } else {
      for (const m of chapter.memories) {
        const line = monthLabel(addMonths(dayOne, months), locale);
        months += 1;
        flat.push({ src: m.src, ratio: m.ratio ?? 0.8, alt: m.alt ?? line, line, kind: "month", chapterId: chapter.id });
      }
    }
  }
  return flat.map((m, i) => ({ ...m, side: i % 2 === 0 ? ("left" as const) : ("right" as const) }));
}
