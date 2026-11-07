# 04: Her story

**What to build:** The full story the Recipient experiences: the Unlock question, the Intro, four Chapters with a climbing Day counter, about 4 minutes of pacing with a progress cue, and the Letter ending on the Closing line.

- Unlock question: an opening screen where the site stays hidden and does not scroll until the answer is right. Question and accepted answers live in `content/memories.ts` (a few spellings, case and spaces ignored). Kind wrong-answer feedback, a nice transition into the Sky. The first tap also unlocks audio on iOS. A soft gate, not real security.
- Intro, then Chapter openers (large title and date) for How we met, Year 1, Year 2 and Year 3.
- Day counter in the HUD climbing from Day 1 to the Anniversary's day number, computed from real dates in `content/memories.ts` (How we met sits before Day 1). Placeholder Day 1 is 2024-02-14, giving Day 1,097.
- Pacing: page height of roughly 25 to 30 screen heights, tuned so a relaxed pass takes about 4 minutes (range 2 to 5), plus a thin, unobtrusive progress cue.
- Letter on a cream paper card in the deep-rose Sky; the Flyers finish their Turn-around (ticket 03) and settle near the card. The greeting and the Closing line, "Happy 3rd anniversary, my love.", use the Write-on from ticket 03; the body appears line by line in the same script as she scrolls. The Closing line appears last and stays on screen.
- Chapter-title Write-on and the three Cloud passes at Chapter changes come from ticket 03; this ticket supplies the real Chapter openers they attach to.

**Blocked by:** 03: The 3D sky.

**Status:** ready-for-agent

**Needs from the Creator:** the real Day 1 date, the Unlock question and answer(s), the Letter text and its language, and Chapter titles or dates if they differ from the defaults. Use placeholders until then.

- [ ] Wrong answers show a kind message without revealing the answer; the right answer fades the gate out and enables scrolling.
- [ ] The gate works with the iOS on-screen keyboard without breaking the layout.
- [ ] Chapter titles and dates come from `content/memories.ts`.
- [ ] The counter reads Day 1 at the start of Year 1 and ends on the Anniversary's day number (1,097 with the placeholder date); changing the Day 1 date changes every number with no other edit.
- [ ] A relaxed scroll (about 10 seconds per Memory plus about a minute for the Letter) takes roughly 4 minutes.
- [ ] Adding or removing Memories changes the length without breaking the Flight path or Sky timing.
- [ ] A long Letter stays readable on a phone with no horizontal scroll, and the Flyers do not cover the text.
- [ ] The Closing line appears last and stays on screen.
