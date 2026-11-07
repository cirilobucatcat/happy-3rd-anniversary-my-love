# 07 Pacing and progress cue

Status: open
Slice: 3
Type: task
Blocked by: 05, 06

## What to build

Tune the total scroll length so a relaxed pass takes about 4 minutes (acceptable range 2 to 5), and add a subtle progress cue.

- Set page height to roughly 25 to 30 screen heights and adjust the space between Memories, the Chapters and the letter.
- A thin progress cue (for example a small line or trail at the edge) shows how far she is.

## Acceptance criteria

- [ ] A relaxed scroll at about 10 seconds per Memory plus about a minute for the letter takes roughly 4 minutes.
- [ ] The progress cue is visible but unobtrusive on phone and laptop.
- [ ] Adding or removing Memories in `content/memories.ts` changes the length without breaking the Flight path or sky timing.
