import { describe, expect, it } from "vitest";
import {
  ANNIVERSARY,
  CHAPTERS,
  DATE_LOCALE,
  DAY_ONE,
  GATE,
  INTRO,
  LETTER,
  layoutMemories,
  type Chapter,
  type MetChapter,
} from "@/content/memories";
import { addYears, dayNumber, monthLabel } from "@/lib/days";
import { isRightAnswer, normalizeAnswer, wrongAnswerMessage } from "@/lib/gate";
import { letterWords } from "@/lib/letter";

/** How we met, typed as such, so its Memories' Captions can be read without a cast. */
const metChapter = CHAPTERS.find((c): c is MetChapter => c.kind === "met")!;

describe("placeholder content", () => {
  const memories = layoutMemories(CHAPTERS);
  const chapter = (id: string) => CHAPTERS.find((c) => c.id === id)!;
  const YEARS = ["year-1", "year-2", "year-3"];

  it("has 39 Memories: 3 for How we met and 12 for each Year", () => {
    expect(memories).toHaveLength(39);
    expect(chapter("met").memories).toHaveLength(3);
  });

  it("gives every Memory a photo of its own and a handwritten line", () => {
    for (const m of memories) {
      expect(m.src).toMatch(/^\/photos\/.+\.(svg|jpg|jpeg|png|webp)$/);
      expect(m.line.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(memories.map((m) => m.src)).size).toBe(memories.length);
  });

  it("has Chapters with an id, title and date", () => {
    for (const c of CHAPTERS) {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("holds exactly 12 Memories in each Year, one for every Month", () => {
    for (const id of YEARS) expect(chapter(id).memories).toHaveLength(12);
  });

  it("gives How we met 3 Captions and the Years none", () => {
    expect(metChapter.id).toBe("met");
    for (const m of metChapter.memories) expect(m.caption.trim().length).toBeGreaterThan(0);
    for (const id of YEARS) {
      expect(chapter(id).kind).toBe("year");
      for (const m of chapter(id).memories) expect(m).not.toHaveProperty("caption");
    }
  });
});

describe("the Months", () => {
  const byChapter = (id: string, list = layoutMemories(CHAPTERS)) => list.filter((m) => m.chapterId === id);

  it("labels the Year 1 Memories with their Month, starting from Day 1's own month", () => {
    expect(DAY_ONE).toBe("2024-02-14");
    expect(byChapter("year-1").map((m) => m.line)).toEqual([
      "February 2024", "March 2024", "April 2024", "May 2024", "June 2024", "July 2024",
      "August 2024", "September 2024", "October 2024", "November 2024", "December 2024", "January 2025",
    ]);
  });

  it("carries on across the Years: Year 2 opens with Month 13 and Year 3 with Month 25", () => {
    expect(byChapter("year-2")[0].line).toBe("February 2025");
    expect(byChapter("year-2")[11].line).toBe("January 2026");
    expect(byChapter("year-3")[0].line).toBe("February 2026");
    expect(byChapter("year-3")[11].line).toBe("January 2027");
  });

  it("opens each Year on the Month its Chapter date falls in", () => {
    for (const id of ["year-1", "year-2", "year-3"]) {
      expect(byChapter(id)[0].line).toBe(monthLabel(CHAPTERS.find((c) => c.id === id)!.date, DATE_LOCALE));
    }
  });

  it("gives all 36 Months a different label", () => {
    const labels = layoutMemories(CHAPTERS).filter((m) => m.kind === "month").map((m) => m.line);
    expect(labels).toHaveLength(36);
    expect(new Set(labels).size).toBe(36);
  });

  it("leaves How we met with its Captions, since it comes before Day 1 and has no Months", () => {
    const met = byChapter("met");
    expect(met.every((m) => m.kind === "caption")).toBe(true);
    expect(met.map((m) => m.line)).toEqual(metChapter.memories.map((m) => m.caption));
  });

  it("moves every label when only Day 1 moves", () => {
    const later = layoutMemories(CHAPTERS, { dayOne: "2025-02-14" });
    expect(byChapter("year-1", later)[0].line).toBe("February 2025");
    expect(byChapter("year-3", later)[11].line).toBe("January 2028");
    const before = layoutMemories(CHAPTERS).filter((m) => m.kind === "month");
    const after = later.filter((m) => m.kind === "month");
    before.forEach((m, i) => expect(after[i].line).not.toBe(m.line));
  });

  it("writes the labels in the given language", () => {
    expect(byChapter("year-1", layoutMemories(CHAPTERS, { locale: "es-ES" }))[6].line).toMatch(/agosto.*2024/);
  });

  it("works from a Day 1 on the 31st: a short month gets its last day, with no error", () => {
    const labels = byChapter("year-1", layoutMemories(CHAPTERS, { dayOne: "2024-01-31" })).map((m) => m.line);
    expect(labels).toHaveLength(12);
    expect(labels.slice(0, 3)).toEqual(["January 2024", "February 2024", "March 2024"]);
  });

  it("uses the label as a Year Memory's alt text, and the Caption as a How we met Memory's", () => {
    const all = layoutMemories(CHAPTERS);
    expect(byChapter("year-1", all)[0].alt).toBe("February 2024");
    expect(byChapter("met", all)[0].alt).toBe(metChapter.memories[0].caption);
  });

  it("keeps an alt text the Creator wrote", () => {
    const chapters: Chapter[] = [
      {
        kind: "year",
        id: "y",
        title: "Y",
        date: "2024-02-14",
        memories: [{ src: "/photos/1.svg", alt: "Us at the beach" }, { src: "/photos/2.svg" }],
      },
    ];
    const [first, second] = layoutMemories(chapters, { dayOne: "2024-02-14" });
    expect(first.alt).toBe("Us at the beach");
    expect(first.line).toBe("February 2024");
    expect(second.alt).toBe("March 2024");
  });
});

describe("layoutMemories", () => {
  const chapters: Chapter[] = [
    {
      kind: "met",
      id: "a",
      title: "A",
      date: "2024-01-01",
      memories: [{ src: "/photos/1.svg", caption: "one" }, { src: "/photos/2.svg", caption: "two" }],
    },
    { kind: "year", id: "b", title: "B", date: "2025-01-01", memories: [{ src: "/photos/3.svg" }] },
  ];
  const withMet = (memories: MetChapter["memories"]): Chapter[] => [{ ...(chapters[0] as MetChapter), memories }, chapters[1]];

  it("flattens Chapters in the order they are written", () => {
    expect(layoutMemories(chapters, { dayOne: "2025-01-01" }).map((m) => m.line)).toEqual(["one", "two", "January 2025"]);
  });

  it("alternates left and right across Chapter boundaries", () => {
    expect(layoutMemories(chapters).map((m) => m.side)).toEqual(["left", "right", "left"]);
  });

  it("keeps alternating after a Memory is removed", () => {
    const trimmed = withMet([{ src: "/photos/2.svg", caption: "two" }]);
    expect(layoutMemories(trimmed).map((m) => m.side)).toEqual(["left", "right"]);
  });

  it("remembers which Chapter each Memory belongs to", () => {
    expect(layoutMemories(chapters).map((m) => m.chapterId)).toEqual(["a", "a", "b"]);
  });

  it("counts Months only across the Year Chapters, so removing a How we met Memory moves no label", () => {
    const trimmed = withMet([{ src: "/photos/1.svg", caption: "one" }]);
    expect(layoutMemories(trimmed, { dayOne: "2025-01-01" })[1].line).toBe("January 2025");
  });
});

describe("the story's dates", () => {
  const chapter = (id: string) => CHAPTERS.find((c) => c.id === id)!;

  it("has How we met before Day 1, then Year 1, Year 2 and Year 3 in order", () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(["met", "year-1", "year-2", "year-3"]);
    expect(dayNumber(DAY_ONE, chapter("met").date)).toBeLessThanOrEqual(0);
    const dates = CHAPTERS.map((c) => c.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("opens each Year exactly a year after the one before, starting from Day 1, so moving Day 1 moves them all", () => {
    expect(chapter("year-1").date).toBe(DAY_ONE);
    expect(chapter("year-2").date).toBe(addYears(DAY_ONE, 1));
    expect(chapter("year-3").date).toBe(addYears(DAY_ONE, 2));
    expect(ANNIVERSARY).toBe(addYears(DAY_ONE, 3));
  });

  it("puts the placeholder Anniversary on Day 1,097", () => {
    expect(DAY_ONE).toBe("2024-02-14");
    expect(dayNumber(DAY_ONE, ANNIVERSARY)).toBe(1097);
  });
});

describe("the Unlock question", () => {
  it("has a question and at least one accepted answer", () => {
    expect(GATE.question.trim().length).toBeGreaterThan(0);
    expect(GATE.answers.length).toBeGreaterThan(0);
    expect(GATE.wrongMessages.length).toBeGreaterThan(0);
  });

  it("accepts each of its own answers", () => {
    for (const answer of GATE.answers) expect(isRightAnswer(answer, GATE.answers)).toBe(true);
  });

  it("never gives the answer away in the question or in any kind wrong-answer message, not even the built-in one used when none are listed", () => {
    for (const text of [GATE.question, ...GATE.wrongMessages, wrongAnswerMessage(1, [])]) {
      for (const answer of GATE.answers) expect(normalizeAnswer(text)).not.toContain(normalizeAnswer(answer));
    }
  });
});

describe("the Intro and the Letter", () => {
  it("has an Intro title", () => {
    expect(INTRO.title.trim().length).toBeGreaterThan(0);
  });

  it("has a greeting, a body of a few paragraphs, and the Closing line that ends the site", () => {
    expect(LETTER.greeting.trim().length).toBeGreaterThan(0);
    expect(LETTER.body.length).toBeGreaterThanOrEqual(2);
    expect(letterWords(LETTER)).toBeGreaterThan(40);
    expect(LETTER.closing).toBe("Happy 3rd anniversary, my love.");
  });
});
