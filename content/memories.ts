/**
 * THE content file. Add, remove or reorder Memories here and nothing else needs to change:
 * the left/right side is worked out from the order, so it always alternates.
 *
 * Photos live in /public/photos. Drop a photo there, then run `npm run resize-photos`.
 * `ratio` is width / height of the frame (default 0.8, a portrait photo). Set it for
 * landscape (1.33) or square (1) photos so nothing gets cropped.
 */

export type MemoryInput = {
  src: string;
  caption: string;
  ratio?: number;
};

export type Chapter = {
  id: string;
  title: string;
  /** ISO date the Chapter opens (placeholder dates until the Creator supplies real ones). */
  date: string;
  memories: MemoryInput[];
};

export type Memory = Required<MemoryInput> & {
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
    date: "2024-02-14",
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
    date: "2025-02-14",
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
    date: "2026-02-14",
    memories: [
      { src: "/photos/14.svg", caption: "Still choosing you", ratio: 0.8 },
      { src: "/photos/15.svg", caption: "Quiet evenings, loud laughter", ratio: 1.33 },
      { src: "/photos/16.svg", caption: "Another year, another favourite photo", ratio: 0.8 },
      { src: "/photos/17.svg", caption: "You make ordinary days golden", ratio: 1 },
      { src: "/photos/18.svg", caption: "Here's to us", ratio: 0.75 },
    ],
  },
];

/** Flattens the Chapters into one ordered list and assigns alternating sides. */
export function layoutMemories(chapters: Chapter[]): Memory[] {
  return chapters
    .flatMap((chapter) => chapter.memories.map((m) => ({ ...m, chapterId: chapter.id })))
    .map((m, i) => ({
      src: m.src,
      caption: m.caption,
      ratio: m.ratio ?? 0.8,
      chapterId: m.chapterId,
      side: i % 2 === 0 ? ("left" as const) : ("right" as const),
    }));
}
