# 08e: Ending, cleanup and length

Slice 5 of 6 of [08: Year 3 face-on climb](08-year-3-face-on-climb.md).

**What to build:** Finish the story. Check the ending end to end, remove everything only the old Turn-around and ticket 07's Year 3 stand-in used, and bring the pacing checks back to their tight bounds.

- **Ending:** the Flyers slow to a stop face on below the Letter card, and the Letter section (card, greeting, body, Closing line, hold) works exactly as before. Walk it with `?p=` on a phone and a laptop, including a long Letter.
- **Cleanup:** search for what is now unused and remove it, including its tests. Likely places: the Sea leg's rest-at-the-end code and `restAt` handling in `lib/sea-route.ts`, the "for now" comments in `lib/timeline.ts` (`FLY_BY_CHAPTERS`, `SCREENS`, `turnAround`) and `lib/camera-rig.ts`, anything in `lib/scene.ts` that kept the Chase camera to the end, and any `Schedule` or `Timeline` field nothing reads. Run typecheck and look for unused exports.
- **Length:** `?debug` shows about 54 screens and about 5.8 minutes at the relaxed pace (0.7 Intro, 8.0 titles, 3.6 How we met, 14.4 Year 1, 9.6 Year 2, 9.6 Year 3, about 7.8 Letter).
- **Pacing tests:** the "steady pace" check in `lib/route.test.ts` goes back to a whole-path bound of 2.2 (ticket 06 loosened it to 4.5), and the pacing test in `lib/timeline.test.ts` goes back to about 5.8 minutes with the per-section budget above.
- **Plain list and reduced motion** still carry the whole story: 3, 12, 12 and 12 Memories with Month labels, and the Letter.
- **Docs:** `spec.md`, `ARCHITECTURE.md` and the ticket 07 "Left for later" note say what is now true; parent ticket 08 is marked done.

**Blocked by:** 08a, 08b, 08c and 08d.

**Status:** not started

**Needs from the Creator:** nothing.

- [ ] The Flyers stop face on below the Letter card and the Letter and Closing line work exactly as before, on a phone (portrait) and a laptop.
- [ ] There is no Turn-around just before the Letter any more, and no dead code from it or from ticket 07's Year 3 stand-in remains.
- [ ] `?debug` shows about 54 screens and about 5.8 minutes.
- [ ] The "steady pace" check in `lib/route.test.ts` has a whole-path bound of 2.2 and passes; the pacing test in `lib/timeline.test.ts` is back to about 5.8 minutes and passes.
- [ ] The plain list and reduced motion still carry the whole story.
- [ ] The whole story, scrolled start to finish on a phone (portrait) and a laptop, has no jump, no horizontal scroll and no empty stretch.
- [ ] Typecheck, production build and the full test suite pass.
