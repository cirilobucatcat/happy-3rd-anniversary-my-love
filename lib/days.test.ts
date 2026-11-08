import { describe, expect, it } from "vitest";
import { addYears, dayCounter, dayNumber, formatDate, formatDayNumber } from "@/lib/days";

describe("dayNumber: Day 1 is the day they became a couple", () => {
  it("calls Day 1 itself Day 1, and counts on from there", () => {
    expect(dayNumber("2024-02-14", "2024-02-14")).toBe(1);
    expect(dayNumber("2024-02-14", "2024-02-15")).toBe(2);
  });

  it("counts the 2024 leap day: a year after Day 1 is Day 367, not 366", () => {
    expect(dayNumber("2024-02-14", "2025-02-14")).toBe(367);
  });

  it("puts the placeholder Anniversary on Day 1,097", () => {
    expect(dayNumber("2024-02-14", "2027-02-14")).toBe(1097);
  });

  it("makes the Anniversary Day 1,096 when no leap day falls in between", () => {
    expect(dayNumber("2025-02-14", "2028-02-14")).toBe(1096);
  });

  it("gives a date before Day 1 a number of zero or less", () => {
    // 5 January to 14 February is 40 days.
    expect(dayNumber("2024-02-14", "2024-01-05")).toBe(-39);
  });

  it("is not thrown by daylight saving or the viewer's time zone", () => {
    // Across the March change of clocks in the northern hemisphere, and across the October one.
    expect(dayNumber("2024-03-09", "2024-03-11")).toBe(3);
    expect(dayNumber("2024-10-25", "2024-11-02")).toBe(9);
  });

  it("says plainly when a date is not YYYY-MM-DD", () => {
    expect(() => dayNumber("2024-02-14", "14/02/2024")).toThrow(/YYYY-MM-DD/);
    expect(() => dayNumber("2024-02-14", "2025-02-30")).toThrow(/YYYY-MM-DD/);
  });
});

describe("addYears", () => {
  it("keeps the month and day", () => {
    expect(addYears("2024-02-14", 1)).toBe("2025-02-14");
    expect(addYears("2024-02-14", 3)).toBe("2027-02-14");
  });

  it("moves a leap day to the 28th in a year that has none", () => {
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });
});

describe("formatDate", () => {
  it("writes the date out in full, whatever time zone the viewer is in", () => {
    expect(formatDate("2024-02-14", "en-US")).toBe("February 14, 2024");
    expect(formatDate("2025-12-01", "en-US")).toBe("December 1, 2025");
  });
});

describe("formatDayNumber", () => {
  it("writes the number with thousands separators, as the Day counter shows it", () => {
    expect(formatDayNumber(1)).toBe("1");
    expect(formatDayNumber(367)).toBe("367");
    expect(formatDayNumber(1097)).toBe("1,097");
  });
});

describe("dayCounter: the number climbs with the story", () => {
  // Chapters open at these points of the scroll; the last one ends at 0.9.
  const chapters = [
    { from: 0.1, date: "2024-01-05" }, // How we met: before Day 1
    { from: 0.2, date: "2024-02-14" }, // Year 1
    { from: 0.4, date: "2025-02-14" }, // Year 2
    { from: 0.7, date: "2026-02-14" }, // Year 3
  ];
  const counter = dayCounter({ dayOne: "2024-02-14", anniversary: "2027-02-14", chapters, end: 0.9 });

  it("shows nothing before Day 1, during How we met", () => {
    expect(counter(0)).toBeNull();
    expect(counter(0.15)).toBeNull();
  });

  it("reads Day 1 at the start of Year 1", () => {
    expect(counter(0.2)).toBe(1);
  });

  it("reads each Year's own day number as that Chapter opens", () => {
    expect(counter(0.4)).toBe(367);
    expect(counter(0.7)).toBe(732);
  });

  it("climbs evenly between them", () => {
    // Halfway through Year 1: 1 + 366 / 2.
    expect(counter(0.3)).toBe(184);
  });

  it("ends on the Anniversary's day number and stays there through the Letter", () => {
    expect(counter(0.9)).toBe(1097);
    expect(counter(1)).toBe(1097);
  });

  it("never goes down as she scrolls forward", () => {
    let last = 0;
    for (let i = 0; i <= 1000; i++) {
      const day = counter(i / 1000);
      if (day === null) continue;
      expect(day).toBeGreaterThanOrEqual(last);
      last = day;
    }
  });

  it("changes every number when only Day 1 changes", () => {
    const later = dayCounter({
      dayOne: "2025-02-14",
      anniversary: "2028-02-14",
      chapters: [
        { from: 0.1, date: "2025-01-05" },
        { from: 0.2, date: "2025-02-14" },
        { from: 0.4, date: "2026-02-14" },
        { from: 0.7, date: "2027-02-14" },
      ],
      end: 0.9,
    });
    expect(later(0.2)).toBe(1);
    expect(later(0.4)).toBe(366);
    // No leap day between 14 Feb 2025 and 14 Feb 2028, so the Anniversary is Day 1,096.
    expect(later(0.9)).toBe(1096);
  });

  it("shows nothing at all if no Chapter comes on or after Day 1", () => {
    const none = dayCounter({ dayOne: "2030-01-01", anniversary: "2033-01-01", chapters, end: 0.9 });
    expect(none(0.5)).toBeNull();
  });
});
