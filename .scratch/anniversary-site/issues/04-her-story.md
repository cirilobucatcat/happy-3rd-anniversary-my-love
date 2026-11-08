# 04: Her story

**What to build:** The full story the Recipient experiences: the Unlock question, the Intro, four Chapters with a climbing Day counter, about 4 minutes of pacing with a progress cue, and the Letter ending on the Closing line.

- Unlock question: an opening screen where the site stays hidden and does not scroll until the answer is right. Question and accepted answers live in `content/memories.ts` (a few spellings, case and spaces ignored). Kind wrong-answer feedback, a nice transition into the Sky. The first tap also unlocks audio on iOS. A soft gate, not real security.
- Intro, then Chapter openers (large title and date) for How we met, Year 1, Year 2 and Year 3.
- Day counter in the HUD climbing from Day 1 to the Anniversary's day number, computed from real dates in `content/memories.ts` (How we met sits before Day 1). Placeholder Day 1 is 2024-02-14, giving Day 1,097.
- Pacing: page height of roughly 25 to 30 screen heights, tuned so a relaxed pass takes about 4 minutes (range 2 to 5), plus a thin, unobtrusive progress cue.
- Letter on a cream paper card in the deep-rose Sky; the Flyers finish their Turn-around (ticket 03) and settle near the card. The greeting and the Closing line, "Happy 3rd anniversary, my love.", use the Write-on from ticket 03; the body appears line by line in the same script as she scrolls. The Closing line appears last and stays on screen.
- Chapter-title Write-on and the three Cloud passes at Chapter changes come from ticket 03; this ticket supplies the real Chapter openers they attach to.

**Blocked by:** 03: The 3D sky.

**Follow-up 2026-11-08:** built with placeholder content (Day 1 is 2024-02-14, the Unlock question, Intro and Letter are stand-ins in `content/memories.ts`). Decisions along the way:
- Page length: the Chapters and Memories still take about 30 screens (with the 0.7-screen Intro), and the Turn-around and Letter add about 7, so the page is about 38 screens (agreed with the Creator on 2026-11-08, instead of the 25 to 30 above, which could not hold with slow Chapter titles and a Letter). At a relaxed 6.5 seconds a screen that is about 4 minutes; `?debug` shows the estimate and `lib/timeline.ts` holds the numbers.
- The Letter card is fixed in the upper part of the screen and the Flyers settle below it, so they never cover the text. This works because the route ends them about three quarters of the way down and the card stops about two thirds of the way down (`.letter-window` in `app/globals.css`); there is no test linking the two, so look at both if either changes. The card is drawn above the Flyers' canvas, so text is never covered even if they met. A longer Letter (about 28 words a screen, within limits) scrolls for longer and slides up inside the card.
- `?p=`, `?debug` and `?open` skip the gate; so does a tab that was already unlocked (sessionStorage).
- The gate's first tap starts the page's audio context (`unlockAudio()` in `lib/audio.ts`); the song and its button are ticket 05.

**Known and left alone:** the Sky's colour stages are fixed fractions of the scroll, so the Letter (about the last 16%) opens on a sunset-to-rose blend and is fully deep rose only at the end; the first Letter lines sit on that blend. If you want deep rose from the start of the Letter, move `SKY_STOPS.rose` in `lib/sky.ts` (about 0.85).

**Carried to ticket 05:** the gate and Letter on a real iPhone (the on-screen keyboard was only checked by shrinking the viewport in a headless browser); the plain list for reduced motion and no WebGL has the Intro, Chapter dates and the Letter but no HUD or progress cue; a real timed relaxed pass (the 4 minutes is an estimate from the timeline).

**Status:** done

**Needs from the Creator:** the real Day 1 date, the Unlock question and answer(s), the Letter text and its language, and Chapter titles or dates if they differ from the defaults. Use placeholders until then.

- [x] Wrong answers show a kind message without revealing the answer; the right answer fades the gate out and enables scrolling. (The answer check and the no-leak rule, including the built-in fallback message, are tested; the lock, fade and scroll were checked by driving the page in a headless browser, which is not an automated test.)
- [~] The gate works with the iOS on-screen keyboard without breaking the layout. (Built for it: a 16px field so Safari does not zoom, the form at the top of the screen, and the gate follows the visual viewport. Checked with the visible area shrunk to 516 px; a real iPhone is ticket 05.)
- [x] Chapter titles and dates come from `content/memories.ts`.
- [x] The counter reads Day 1 at the start of Year 1 and ends on the Anniversary's day number (1,097 with the placeholder date); changing the Day 1 date changes every number with no other edit.
- [~] A relaxed scroll (about 10 seconds per Memory plus about a minute for the Letter) takes roughly 4 minutes. (This is an estimate, not a timed pass: the timeline says about 4.1 minutes at a chosen relaxed pace of 6.5 seconds a screen, which makes a Memory about 8 seconds and the Letter section about 50 seconds. A real person scrolling at her own pace is ticket 05; change `RELAXED_SECONDS_PER_SCREEN` or `SCREENS` in `lib/timeline.ts` to retune.)
- [x] Adding or removing Memories changes the length without breaking the Flight path or Sky timing. (Tests build a short, a long and an uneven story and check the Cloud passes, Turn-around, Flight path, Memory placement and each Memory's Clouds on a phone and a laptop. The Sky's colour stages are fixed fractions of the scroll, so they never depended on the count.)
- [x] A long Letter stays readable on a phone with no horizontal scroll, and the Flyers do not cover the text. (Tried with a 300-word Letter at 320 px and larger.)
- [x] The Closing line appears last and stays on screen.
