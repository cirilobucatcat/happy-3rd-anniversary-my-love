import { addYears } from "@/lib/days";

/**
 * THE content file. Add, remove or reorder Memories here and nothing else needs to change:
 * the left/right side is worked out from the order, so it always alternates.
 *
 * Everything marked PLACEHOLDER is stand-in text until the Creator supplies the real thing: the Day 1 date, the
 * Unlock question and its answers, the Intro, and the Letter. Photos and Captions are placeholders too.
 *
 * Dates are written YYYY-MM-DD. Day 1 is the day they became a couple. The three Year Chapters hang off it (Year 1
 * opens on Day 1, Year 2 a year later, Year 3 two years later) and the Anniversary is three years after, so changing
 * DAY_ONE changes every date and every number on the Day counter with no other edit. How we met sits before Day 1,
 * so it keeps a date of its own.
 *
 * Photos live in /public/photos. Drop a photo there, then run `npm run resize-photos`.
 * `ratio` is width / height of the photo (default 0.8, a portrait photo). Set it for
 * landscape (1.33) or square (1) photos so nothing gets cropped.
 * `alt` is what a screen reader says about the photo (default: the Caption).
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

export type MemoryInput = {
  src: string;
  caption: string;
  ratio?: number;
  alt?: string;
};

export type Chapter = {
  id: string;
  title: string;
  /** ISO date the Chapter opens (placeholder dates until the Creator supplies real ones). */
  date: string;
  memories: MemoryInput[];
};

export type Memory = Required<Omit<MemoryInput, "alt">> & {
  alt?: string;
  side: "left" | "right";
  chapterId: string;
};

export const CHAPTERS: Chapter[] = [
  {
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
    id: "year-1",
    title: "Year 1",
    date: DAY_ONE,
    memories: [
      { src: "/photos/04.svg", caption: "Day 1. Us.", ratio: 0.8 },
      { src: "/photos/05.svg", caption: "Our first trip together", ratio: 1.33 },
      { src: "/photos/06.svg", caption: "Pink skies, your favourite", ratio: 0.8 },
      { src: "/photos/07.svg", caption: "Lost, and happy about it", ratio: 1 },
      { src: "/photos/08.svg", caption: "Rain, but we danced anyway", ratio: 0.75 },
    ],
  },
  {
    id: "year-2",
    title: "Year 2",
    date: addYears(DAY_ONE, 1),
    memories: [
      { src: "/photos/09.svg", caption: "Two years in and still giddy", ratio: 0.8 },
      { src: "/photos/10.svg", caption: "Sunday mornings with you", ratio: 1.33 },
      { src: "/photos/11.svg", caption: "You, in my favourite dress", ratio: 0.8 },
      { src: "/photos/12.svg", caption: "Our kind of adventure", ratio: 1 },
      { src: "/photos/13.svg", caption: "Home is wherever you are", ratio: 0.75 },
    ],
  },
  {
    id: "year-3",
    title: "Year 3",
    date: addYears(DAY_ONE, 2),
    memories: [
      { src: "/photos/14.svg", caption: "Still choosing you", ratio: 0.8 },
      { src: "/photos/15.svg", caption: "Quiet evenings, loud laughter", ratio: 1.33 },
      { src: "/photos/16.svg", caption: "Another year, another favourite photo", ratio: 0.8 },
      { src: "/photos/17.svg", caption: "You make ordinary days golden", ratio: 1 },
      { src: "/photos/18.svg", caption: "Here's to us", ratio: 0.75 },
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

/** Flattens the Chapters into one ordered list and assigns alternating sides. */
export function layoutMemories(chapters: Chapter[]): Memory[] {
  return chapters
    .flatMap((chapter) => chapter.memories.map((m) => ({ ...m, chapterId: chapter.id })))
    .map((m, i) => ({
      src: m.src,
      caption: m.caption,
      alt: m.alt,
      ratio: m.ratio ?? 0.8,
      chapterId: m.chapterId,
      side: i % 2 === 0 ? ("left" as const) : ("right" as const),
    }));
}
