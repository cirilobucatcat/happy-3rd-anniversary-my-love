# 06 Chapters and day counter

Status: open
Slice: 3
Type: task
Blocked by: 03

## What to build

- Intro title screen, then Chapter openers (large title and date) for How we met, Year 1, Year 2 and Year 3.
- A Day counter in the HUD that climbs from Day 1 up to the Anniversary's day number across the Chapters (How we met sits before Day 1). The numbers are computed from real dates in `content/memories.ts`, never hard-coded.

## Needs from the user

The date they became a couple (Day 1). The Anniversary is computed as exactly three years later. Until the real date arrives, use the placeholder Day 1 of 2024-02-14. Also chapter titles or dates if they differ from the defaults.

## Acceptance criteria

- [ ] Chapter titles and dates come from `content/memories.ts`.
- [ ] The counter reads Day 1 at the start of Year 1 and the Anniversary's day number (1,096, or 1,097 across a leap day) at the end of Year 3.
- [ ] With the placeholder Day 1 of 2024-02-14, the counter ends on Day 1,097.
- [ ] Changing the Day 1 date in `content/memories.ts` changes every number with no other edit.
- [ ] The counter format is readable on a phone (for example "Day 1,096").
