import { describe, expect, it } from "vitest";
import { CHAPTERS, layoutMemories, type Chapter } from "@/content/memories";

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
