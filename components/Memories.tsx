import type { Memory } from "@/content/memories";
import { CHAPTERS } from "@/content/memories";
import WriteOnText from "@/components/WriteOnText";
import type { Timeline } from "@/lib/timeline";

type Props = { memories: readonly Memory[]; timeline: Timeline };

/** Alt text for a Memory's photo. */
export const altOf = (m: Memory) => m.alt ?? m.caption;

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
                  <li key={m.src}>
                    {altOf(m)}. Caption: {m.caption}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

/**
 * The plain version, for devices with no WebGL or with reduced motion: every Memory stacked in a pink frame with its
 * Caption, one under another. No Clouds, no Flyers, no bounce.
 */
export function PlainList({ memories }: { memories: readonly Memory[] }) {
  return (
    <main className="plain" aria-label="Our story">
      {CHAPTERS.map((chapter) => (
        <section key={chapter.id} className="plain-chapter">
          <h2 className="plain-title">
            <WriteOnText text={chapter.title} />
          </h2>
          <ul className="plain-list">
            {memories
              .filter((m) => m.chapterId === chapter.id)
              .map((m) => (
                <li key={m.src} className={`plain-memory plain-memory--${m.side}`}>
                  <figure className="plain-frame">
                    <div className="plain-mat">
                      {/* Plain img: the Next image optimizer is not available with static export. */}
                      <img src={m.src} alt={altOf(m)} loading="lazy" decoding="async" style={{ aspectRatio: m.ratio }} />
                    </div>
                    <figcaption className="plain-caption">
                      <WriteOnText text={m.caption} maxWidthEm={7.5} />
                    </figcaption>
                  </figure>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
