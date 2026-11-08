import { describe, expect, it } from "vitest";
import { isRightAnswer, wrongAnswerMessage } from "@/lib/gate";

describe("isRightAnswer: the Unlock question's soft lock", () => {
  const accepted = ["The Pier", "pier at sunset"];

  it("accepts an exact answer", () => {
    expect(isRightAnswer("The Pier", accepted)).toBe(true);
  });

  it("ignores case and extra or missing spaces", () => {
    expect(isRightAnswer("  the   PIER ", accepted)).toBe(true);
    expect(isRightAnswer("thepier", accepted)).toBe(true);
  });

  it("accepts any of the listed spellings", () => {
    expect(isRightAnswer("Pier at Sunset", accepted)).toBe(true);
  });

  it("ignores punctuation and accents, so a phone keyboard's habits do not lock her out", () => {
    expect(isRightAnswer("café del mar!", ["Cafe del Mar"])).toBe(true);
    expect(isRightAnswer("the pier.", accepted)).toBe(true);
    expect(isRightAnswer("It's ours", ["its ours"])).toBe(true);
  });

  it("rejects a wrong answer, and a partial one", () => {
    expect(isRightAnswer("the park", accepted)).toBe(false);
    expect(isRightAnswer("pier", accepted)).toBe(false);
  });

  it("rejects an empty answer, even if an accepted spelling is only punctuation", () => {
    expect(isRightAnswer("", accepted)).toBe(false);
    expect(isRightAnswer("   ", accepted)).toBe(false);
    expect(isRightAnswer("...", ["..."])).toBe(false);
  });

  it("compares letters in any script, not just English ones", () => {
    expect(isRightAnswer("MAHAL KO", ["mahal ko"])).toBe(true);
    expect(isRightAnswer("我爱你", ["我爱你"])).toBe(true);
  });
});

describe("wrongAnswerMessage: kind feedback that moves on with each try", () => {
  const messages = ["not quite", "so close", "think back"];

  it("starts with the first message and moves through them in order", () => {
    expect(wrongAnswerMessage(1, messages)).toBe("not quite");
    expect(wrongAnswerMessage(2, messages)).toBe("so close");
    expect(wrongAnswerMessage(3, messages)).toBe("think back");
  });

  it("starts over once it has used them all", () => {
    expect(wrongAnswerMessage(4, messages)).toBe("not quite");
  });

  it("still says something kind if the Creator lists no messages", () => {
    expect(wrongAnswerMessage(1, []).length).toBeGreaterThan(0);
  });
});
