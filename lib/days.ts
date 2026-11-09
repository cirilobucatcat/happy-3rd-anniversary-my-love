/**
 * Dates and the Day counter. Everything is worked out from real calendar dates ("YYYY-MM-DD", read as plain
 * calendar days in UTC so neither daylight saving nor the viewer's time zone can shift a day), so the Anniversary
 * lands on Day 1,096 or 1,097 depending on whether a leap day falls in between, and moving Day 1 moves every number.
 */

const MS_PER_DAY = 86_400_000;

const notADate = (iso: string) => new Error(`"${iso}" is not a date: write it as YYYY-MM-DD, for example 2024-02-14.`);

function parts(iso: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw notADate(iso);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw notADate(iso);
  return { year, month, day };
}

/** Whole days since 1970-01-01 for a calendar date. */
function epochDay(iso: string): number {
  const { year, month, day } = parts(iso);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/** Day 1 is `dayOne` itself; the day after is Day 2. Dates before Day 1 come out as zero or less. */
export function dayNumber(dayOne: string, date: string): number {
  return epochDay(date) - epochDay(dayOne) + 1;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The same month and day `years` later; a leap day lands on the 28th in a year that has none. */
export function addYears(iso: string, years: number): string {
  return addMonths(iso, 12 * years);
}

/**
 * The same day of the month `months` later, counted from `iso` itself (never from the month before), so a short month
 * clamps to its last day without dragging the months after it down: from the 31st, January gives February 28 or 29,
 * and March is the 31st again. Month 1 of the story is `addMonths(dayOne, 0)`.
 */
export function addMonths(iso: string, months: number): string {
  const { year, month, day } = parts(iso);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${String(targetYear).padStart(4, "0")}-${pad2(targetMonth)}-${pad2(Math.min(day, lastDay))}`;
}

/** "August 2024" (or the equivalent in `locale`): the Month label written under a Memory. */
export function monthLabel(iso: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "long" }).format(
    new Date(epochDay(iso) * MS_PER_DAY),
  );
}

/** "February 14, 2024" (or the equivalent in `locale`). */
export function formatDate(iso: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(
    new Date(epochDay(iso) * MS_PER_DAY),
  );
}

/** The Day counter's number as written on screen: "367", "1,097". */
export function formatDayNumber(day: number, locale = "en-US"): string {
  return day.toLocaleString(locale);
}

export type CounterInput = {
  /** The day they became a couple. */
  dayOne: string;
  /** The Anniversary (content/memories.ts works it out as three years after Day 1): the counter climbs to its day number. */
  anniversary: string;
  /** Where each Chapter opens on the scroll (progress, 0 to 1) and the date it opens on, in story order. */
  chapters: readonly { from: number; date: string }[];
  /** Where the last Chapter ends: the counter reaches the Anniversary here and holds. */
  end: number;
};

/**
 * The Day counter as a function of scroll progress. Each Chapter that opens on or after Day 1 starts at its own
 * day number and the counter climbs evenly to the next one; the last climbs to the Anniversary. It is null
 * (nothing shown) before Day 1, which is where How we met sits.
 */
export function dayCounter({ dayOne, anniversary, chapters, end }: CounterInput): (progress: number) => number | null {
  const stops = chapters
    .map((c) => ({ progress: c.from, day: dayNumber(dayOne, c.date) }))
    .filter((s) => s.day >= 1);
  if (stops.length === 0) return () => null;
  stops.push({ progress: end, day: dayNumber(dayOne, anniversary) });

  return (progress) => {
    if (progress < stops[0].progress) return null;
    for (let i = 1; i < stops.length; i++) {
      const [a, b] = [stops[i - 1], stops[i]];
      if (progress < b.progress) {
        const t = (progress - a.progress) / (b.progress - a.progress);
        // The tiny nudge keeps float error (366.9999999) from showing yesterday's number at a boundary.
        return Math.floor(a.day + (b.day - a.day) * t + 1e-9);
      }
    }
    return stops[stops.length - 1].day;
  };
}
