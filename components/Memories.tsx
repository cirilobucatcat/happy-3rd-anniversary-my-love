import type { Memory } from "@/content/memories";
import { ANNIVERSARY, CHAPTERS, DATE_LOCALE, DAY_ONE, INTRO } from "@/content/memories";
import { LetterPlain } from "@/components/Letter";
import WriteOnText from "@/components/WriteOnText";
import { dayNumber, formatDate, formatDayNumber } from "@/lib/days";
import type { Timeline } from "@/lib/timeline";

type Props = { memories: readonly Memory[]; timeline: Timeline };

/**
 * What a screen reader says about a Memory: its alt text (by default the Month label or the Caption, see
 * `layoutMemories`), plus the handwritten line when the Creator wrote a different alt text, since the line is drawn
 * in WebGL and is otherwise not in the page.
 */
export const describeMemory = (m: Memory) =>
  m.alt === m.line ? m.alt : `${m.alt}. ${m.kind === "month" ? "Month" : "Caption"}: ${m.line}`;

/**
 * The page the WebGL Sky scrolls over. The Memories themselves are drawn in the 3D scene (ADR 0001), so the page is
 * only invisible spacers whose heights set how long the scroll is, plus a visually hidden list that carries every
 * Memory's alt text for screen readers.
 */
export function Spacers({ memories, timeline }: Props) {
  return (
    <>
      <main className="story" aria-label="Our story">
        {timeline.spacers.map((section, i) => (
          <div
            key={i}
            className="story-spacer"
            data-kind={section.kind}
            data-chapter={section.chapterId}
            style={{ height: `${section.screens * 100}svh` }}
          />
        ))}
        {/* The page is one screen taller than the scroll itself. */}
        <div style={{ height: "100svh" }} />
      </main>
      <div className="sr-only">
        {CHAPTERS.map((chapter) => (
          <section key={chapter.id} aria-label={chapter.title}>
            <h2>{chapter.title}</h2>
            <ul>
              {memories
                .filter((m) => m.chapterId === chapter.id)
                .map((m) => (
                  <li key={m.src}>{describeMemory(m)}</li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

/**
 * The plain version, for devices with no WebGL or with reduced motion: the Intro, then every Memory stacked in a pink
 * frame with its handwritten line (a Caption, or a Month label in the Years), one under another, each Chapter opened
 * by its title and date, and the Letter at the end. No Clouds, no Flyers, no bounce.
 */
export function PlainList({ memories }: { memories: readonly Memory[] }) {
  return (
    <main className="plain" aria-label="Our story">
      <header className="plain-intro">
        <h1 className="plain-intro-title">
          <WriteOnText text={INTRO.title} />
        </h1>
        <p>{INTRO.line}</p>
      </header>
      {CHAPTERS.map((chapter) => (
        <section key={chapter.id} className="plain-chapter">
          <h2 className="plain-title">
            <WriteOnText text={chapter.title} />
          </h2>
          <p className="plain-date">
            <WriteOnText text={formatDate(chapter.date, DATE_LOCALE)} />
            {dayNumber(DAY_ONE, chapter.date) >= 1 && (
              <span className="plain-day">Day {formatDayNumber(dayNumber(DAY_ONE, chapter.date))}</span>
            )}
          </p>
          <ul className="plain-list">
            {memories
              .filter((m) => m.chapterId === chapter.id)
              .map((m) => (
                <li key={m.src} className={`plain-memory plain-memory--${m.side}`}>
                  <figure className="plain-frame">
                    <div className="plain-mat">
                      {/* Plain img: the Next image optimizer is not available with static export. */}
                      <img src={m.src} alt={m.alt} loading="lazy" decoding="async" style={{ aspectRatio: m.ratio }} />
                    </div>
                    <figcaption className="plain-line">
                      <WriteOnText text={m.line} maxWidthEm={7.5} />
                    </figcaption>
                  </figure>
                </li>
              ))}
          </ul>
        </section>
      ))}
      {/* Where the Day counter ends up: the Anniversary's own day number, just above the Letter. */}
      <p className="plain-anniversary">
        {formatDate(ANNIVERSARY, DATE_LOCALE)} <span aria-hidden="true">&middot;</span> Day{" "}
        {formatDayNumber(dayNumber(DAY_ONE, ANNIVERSARY))}
      </p>
      <LetterPlain />
    </main>
  );
}
