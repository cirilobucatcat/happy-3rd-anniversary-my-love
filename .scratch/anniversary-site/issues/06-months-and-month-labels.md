# 06: Months and Month labels

**What to build:** One picture for every Month. Year 1, Year 2 and Year 3 each hold 12 Memories (36 in all) with a Month label where the Caption used to be, How we met keeps its 3 Captions, and the Wiggle is gone. The flight does not change yet: every Memory still pops out, and the page is longer for now.

- **Content:** each Year Chapter in `content/memories.ts` holds exactly 12 Memories, with no Caption. How we met keeps 3 Memories, each with a Caption. The types make the difference visible (a Year's Memory is `{ src, ratio?, alt? }`; How we met's also has `caption`).
- **Months:** `lib/days.ts` gets `addMonths` (counted from `DAY_ONE`; a short month clamps to its last day, so a Day 1 on the 31st gives Feb 28 or 29) and a `monthLabel` that writes "August 2024" in `DATE_LOCALE`. Month 1 is Day 1's own month and date. Moving `DAY_ONE` moves every label.
- **Month label:** drawn in the Memory's handwritten line with the same Write-on as a Caption, finishing by the time the Memory has settled. It is one short line, so the room kept under a frame shrinks (`CAPTION_SHARE` in `lib/memory-layout.ts`) and the frames can be a little bigger. Default alt text is the label (Years) or the Caption (How we met).
- **Placeholders:** 39 placeholder pictures (`public/photos/01` to `39`), 3 for How we met and 12 for each Year.
- **Wiggle removed everywhere:** delete `lib/wiggle.ts`, the hover and tap handling in `lib/scene.ts`, `components/SkyCanvas.tsx` and `lib/memory-card.ts`, and their tests. Hovering or tapping a Memory does nothing.
- **Fallback list:** the plain list (no WebGL, reduced motion) shows the Month labels too.
- **Pacing for now:** every Memory keeps 1.2 screens, so the page is about 63 screens until tickets 07 and 08 shorten Years 2 and 3.

**Blocked by:** 05: Polish and ship.

**Status:** done. Built on branch `ticket-06-months-and-month-labels`, checked in headless Edge against the production build (phone and laptop), typecheck clean, 332 tests pass.

**Needs from the Creator:** nothing yet. Later: one real picture for each of the 36 Months, and a Caption for each of the 3 How we met pictures.

- [x] Year 1, Year 2 and Year 3 each show exactly 12 Memories, in order, each with a Month label such as "February 2024"; How we met shows 3 Memories with their Captions. _(`content/memories.ts`: `Chapter` is now `MetChapter | YearChapter`, so a Year Memory cannot carry a Caption. Labels come out as February 2024 to January 2027.)_
- [x] Changing `DAY_ONE` changes every Month label; a Day 1 on the 31st gives the last day of a short month with no error. _(`layoutMemories` counts every label from Day 1 itself, so a clamp never drags later months down.)_
- [x] Month labels write themselves on with scroll and undraw in reverse, and are complete once the Memory has settled. _(Seen at an early point ("Au"), a later one ("August 2") and settled. This needed a fix to the Write-on that Captions had too: see "Found on the way" below.)_
- [x] Hovering or tapping a Memory does nothing, and no Wiggle code or tests remain. _(`lib/wiggle.ts`, the pointer handling in `lib/scene.ts` and `components/SkyCanvas.tsx`, and the swing code in `lib/memory-card.ts` are gone, with their tests and the now-unused `settled` flag.)_
- [x] The plain list shows the Month labels, and screen readers get alt text for every Memory. _(Checked with reduced motion on: 39 Memories as 3 / 12 / 12 / 12, no canvas, alt text is the Month label or the Caption.)_
- [x] Tests cover the new seams: `addMonths` and `monthLabel` (including the clamp), and a content check that each Year has 12 Memories and How we met has Captions. _(`lib/days.test.ts`, `content/memories.test.ts`.)_

**Decisions made while building**

- The room under a frame is chosen per Memory: a Month label (one short line) gets `MONTH_LABEL_SHARE` 0.22 of the frame's width, while How we met's Captions (up to two lines) keep `CAPTION_SHARE` 0.34, so they are not squeezed. Frames of the 36 Year Memories come out about 10% bigger where the screen's height is the limit (laptops).
- Handwritten text in the Memory is now called the "line" in code (`Memory.line`, `lineProgress`, `setLineProgress`) since it is a Caption or a Month label.
- `scripts/make-placeholders.mjs` had not worked since ticket 04 (the content file imports `@/lib/days`, which plain Node cannot resolve). It now registers `scripts/alias-loader.mjs` first.

**Found on the way**

- The Write-on of the Memory's line painted nothing while partly written: it applied each pen stroke with `destination-in`, which clears everything outside the stroke, so several separate strokes left only their (empty) overlap, and a Caption only appeared all at once when it finished. Fixed by drawing the pen path on a shared scratch canvas and applying it in one draw (`lib/memory-card.ts`). Painting to a canvas cannot be unit-tested in jsdom, so this was checked by eye in the real page.
- Pacing for now, as the ticket expected: 63.3 screens, about 6 min 51 s at a relaxed pace. `lib/route.test.ts`'s "steady pace" check had to be loosened for the whole path (to 4.5), because the opening and the Turn-around stayed short while each Year doubled; the three Years still pass the strict 2.2 check against each other. **Tighten it back to 2.2 when tickets 07 and 08 land.**
