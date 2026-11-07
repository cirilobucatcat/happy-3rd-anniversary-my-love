# 11 Fallbacks: reduced motion and no WebGL

Status: open
Slice: 4
Type: task
Blocked by: 03, 05

## What to build

- Reduced motion (`prefers-reduced-motion`): simple fades for Memories, no Flight path and no parallax.
- No WebGL (context creation fails): the page works fully without the Flyers.
- Context loss on a phone (for example after switching apps) recovers without a blank screen.

## Acceptance criteria

- [ ] With reduced motion on, the full story is still readable and nothing flies.
- [ ] With WebGL disabled, there is no error and the Memories, counter and letter all work.
- [ ] Returning to the tab after backgrounding restores the 3D canvas.
