# Memories are textured planes in the WebGL scene

For a Memory to pop out from between Clouds, and for the Flyers to pass into Clouds, the Memories, Clouds and Flyers must share one scene and one draw order. So each Memory is a textured plane with a bevelled pink frame in the same Three.js scene, with its Caption drawn to a texture (the real Pinyon Script letters, uncovered along a derived pen path so they can write themselves on). Native page scrolling is kept: invisible page sections set the scroll length, and a hidden list carries the alt text for screen readers.

We rejected keeping Memories as page elements, because they could then only sit behind or in front of the whole canvas, never between individual Clouds. The cost is that a device without WebGL needs a separate plain-photo fallback (same frame and Captions, no Clouds or Flyers), which also serves reduced-motion.

## Amendment (2026-11-09)

The "Flyers always in front of every Memory" rule below applies only to Pop-out (How we met and Year 1). In Year 2 and Year 3 Memories are Fly-bys and the camera follows the Flyers, so they are drawn by real depth (see ADR 0002).

## How the order is kept (decided while building ticket 03)

A literal shared depth buffer cannot do what the story needs: the Flyers must always be in front of every Memory, even though their path swings further from the camera than a Memory's plane. So the scene is drawn in layers, back to front (`lib/draw-order.ts`): Cloud puffs are sorted by real depth against each Memory's real depth, so a Memory really does pass through a Cloud. The Flyers are placed at the depth of the nearest Memory if they are further back, so they never fall behind one, while a Cloud that is nearer than the Flyers still veils them. Each Memory and the Flyers get a layer of their own with a cleared depth buffer, so frames and limbs still occlude themselves correctly. Settled Memories sit nearer than every Cloud puff, and no Cloud pass overlaps a Memory on screen (the timeline keeps them apart), so no Cloud ever has to sit between a Memory and the Flyers.
