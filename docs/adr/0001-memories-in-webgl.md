# Memories are textured planes in the WebGL scene

For a Memory to pop out from between Clouds, and for the Flyers to pass into Clouds, the Memories, Clouds and Flyers must share one depth buffer. So each Memory is a textured plane with a bevelled pink frame in the same Three.js scene, with its Caption drawn to a texture in the Caveat font. Native page scrolling is kept: invisible page sections set the scroll length, and a hidden list carries the alt text for screen readers.

We rejected keeping Memories as page elements, because they could then only sit behind or in front of the whole canvas, never between individual Clouds. The cost is that a device without WebGL needs a separate plain-photo fallback (same frame and Captions, no Clouds or Flyers), which also serves reduced-motion.
