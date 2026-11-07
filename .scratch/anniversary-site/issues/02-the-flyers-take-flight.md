# 02: The Flyers take flight

**What to build:** A black 3D couple, the Flyers, flying a Flight path over the Sky as the Recipient scrolls: climbs, dives, turns and one loop, with a fading trail. Scrolling back up reverses the flight.

- A fixed, transparent, `pointer-events: none` canvas above the Memories, loaded client-side only. Renderer, camera, lights, resize handling and a pixel ratio capped for phones, with full disposal so React Strict Mode's double mount leaves one canvas and one WebGL context. Rendered from the shared ticker, never its own animation loop.
- A simple low-poly couple built in code, holding hands, leaning forward about 30 degrees. Her long hair and dress trail behind her; his hair is short. Black matte with a pink rim light.
- Optional `public/models/couple.glb` replaces the placeholder with no code change (budget 2 MB and 30,000 triangles); a broken or missing file falls back to the placeholder.
- The Flight path is built from a list of turns (fly right, climb, arc over, dive, one loop, cruise, turn back left), with real 3D banking and heading, fitted to the viewport on resize.

**Blocked by:** 01: Pink sky that scrolls.

**Status:** ready-for-agent

- [ ] The couple reads as two people holding hands over the pink Sky, and the rim light keeps it readable over dark photos.
- [ ] Scrolling down moves the Flyers along the path; scrolling up reverses it.
- [ ] The path has at least one climb, one dive, one left turn and exactly one loop.
- [ ] The Flyers stay on screen at every progress value on phone and laptop sizes.
- [ ] Screenshots at several `?p=` values show clear changes in direction.
- [ ] Resizing keeps the canvas sharp and correctly proportioned.
- [ ] After a hot reload there is exactly one canvas and one WebGL context.
- [ ] A valid `couple.glb` dropped into `public/models/` replaces the placeholder; an invalid one falls back to it.
