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

**Status:** not started

**Needs from the Creator:** nothing yet. Later: one real picture for each of the 36 Months, and a Caption for each of the 3 How we met pictures.

- [ ] Year 1, Year 2 and Year 3 each show exactly 12 Memories, in order, each with a Month label such as "February 2024"; How we met shows 3 Memories with their Captions.
- [ ] Changing `DAY_ONE` changes every Month label; a Day 1 on the 31st gives the last day of a short month with no error.
- [ ] Month labels write themselves on with scroll and undraw in reverse, and are complete once the Memory has settled.
- [ ] Hovering or tapping a Memory does nothing, and no Wiggle code or tests remain.
- [ ] The plain list shows the Month labels, and screen readers get alt text for every Memory.
- [ ] Tests cover the new seams: `addMonths` and `monthLabel` (including the clamp), and a content check that each Year has 12 Memories and How we met has Captions.
