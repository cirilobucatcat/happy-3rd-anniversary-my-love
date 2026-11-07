# 04 Flyers: low-poly couple on a transparent 3D canvas

Status: open
Slice: 2
Type: task
Blocked by: 01

## What to build

The 3D layer and the placeholder couple.

- `components/FlyersCanvas.tsx`, loaded with `next/dynamic` and `ssr: false`: a fixed, transparent, `pointer-events: none` canvas above the Memories.
- `lib/scene.ts`: Three.js renderer, camera, lights, resize handling, pixel ratio capped for phones, and a `dispose()` that frees the renderer, geometries and materials (React Strict Mode mounts twice in development).
- `lib/flyers.ts`: a simple low-poly couple built in code, holding hands, leaning forward about 30 degrees in a flying pose. Her long hair and dress trail behind her; his hair is short.
- Black matte material with a pink rim light.
- Optional: if `public/models/couple.glb` exists, load it instead (budget 2 MB and 30,000 triangles).
- Rendered from the shared `gsap.ticker` subscription, never its own `requestAnimationFrame` loop.

## Acceptance criteria

- [ ] The couple is visible over the pink sky and reads as two people holding hands.
- [ ] The rim light keeps the black shape readable on the sky and over dark photos.
- [ ] Dropping a valid `couple.glb` into `public/models/` replaces the placeholder without code changes.
- [ ] Resizing the window keeps the canvas sharp and correctly proportioned.
- [ ] After a hot reload there is exactly one canvas and one WebGL context.
