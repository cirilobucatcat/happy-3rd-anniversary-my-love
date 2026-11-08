import { describe, expect, it } from "vitest";
import { ANNIVERSARY, CHAPTERS, DAY_ONE, GATE, INTRO, LETTER, layoutMemories, type Chapter } from "@/content/memories";
import { addYears, dayNumber } from "@/lib/days";
import { isRightAnswer, normalizeAnswer, wrongAnswerMessage } from "@/lib/gate";
import { letterWords } from "@/lib/letter";

describe("placeholder content", () => {
  const memories = layoutMemories(CHAPTERS);

  it("has about 15 to 20 Memories", () => {
    expect(memories.length).toBeGreaterThanOrEqual(15);
    expect(memories.length).toBeLessThanOrEqual(20);
  });

  it("gives every Memory a photo and a Caption", () => {
    for (const m of memories) {
      expect(m.src).toMatch(/^\/photos\/.+\.(svg|jpg|jpeg|png|webp)$/);
      expect(m.caption.trim().length).toBeGreaterThan(0);
    }
  });

  it("has Chapters with an id, title and date", () => {
    for (const c of CHAPTERS) {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("layoutMemories", () => {
  const chapters: Chapter[] = [
    { id: "a", title: "A", date: "2024-01-01", memories: [{ src: "/photos/1.svg", caption: "one" }, { src: "/photos/2.svg", caption: "two" }] },
    { id: "b", title: "B", date: "2025-01-01", memories: [{ src: "/photos/3.svg", caption: "three" }] },
  ];

  it("flattens Chapters in the order they are written", () => {
    expect(layoutMemories(chapters).map((m) => m.caption)).toEqual(["one", "two", "three"]);
  });

  it("alternates left and right across Chapter boundaries", () => {
    expect(layoutMemories(chapters).map((m) => m.side)).toEqual(["left", "right", "left"]);
  });

  it("keeps alternating after a Memory is removed", () => {
    const trimmed: Chapter[] = [{ ...chapters[0], memories: [chapters[0].memories[1]] }, chapters[1]];
    expect(layoutMemories(trimmed).map((m) => m.side)).toEqual(["left", "right"]);
  });

  it("remembers which Chapter each Memory belongs to", () => {
    expect(layoutMemories(chapters).map((m) => m.chapterId)).toEqual(["a", "a", "b"]);
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
