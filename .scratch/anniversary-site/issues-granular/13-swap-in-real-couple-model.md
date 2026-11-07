# 13 Swap in the real couple model (optional)

Status: open
Slice: 4
Type: task
Blocked by: 04

## What to build

Replace the low-poly placeholder with the user's real `couple.glb`.

- Check the model against the budget (2 MB and 30,000 triangles) and report anything over.
- Adjust scale, orientation, pivot and the rim light so it flies correctly along the Flight path.
- Keep the placeholder as a fallback if loading fails.

## Needs from the user

A `couple.glb` file (from a photo-to-3D tool, a 3D artist, or Blender), placed at `public/models/couple.glb`. Note that online tools upload the user's photos to that service.

## Acceptance criteria

- [ ] The real model loads from `public/models/couple.glb` and flies the whole route without clipping.
- [ ] It stays black matte with a readable pink rim light.
- [ ] A broken or missing file falls back to the placeholder, not a blank screen.
