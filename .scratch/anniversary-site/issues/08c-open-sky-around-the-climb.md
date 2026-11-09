# 08c: Open Sky around the climb

Slice 3 of 6 of [08: Year 3 face-on climb](08-year-3-face-on-climb.md).

**What to build:** Make the climb feel like a climb. The Sea falls away below at the start, Clouds stream down past, the sunset deepens into rose night and the stars arrive as the Flyers rise.

- **The Sea falls away:** as the camera rises the water drops out of view. The wake, spray and the Flyers' reflection stop once they are off the water. When the Sea is wholly out of the frame it is not drawn at all (no shader or reflection cost on an iPhone). Check that no hard edge or horizon line pops out as it goes. `seaStrength` in `lib/sea.ts` is the existing hook for how strongly the water shows.
- **Clouds stream down:** the route Clouds in `lib/clouds.ts` are strewn above and to the sides of the Sea route today (they use `route.sea.y` and the old rest time). Add the same idea along the climb, so Clouds come down past the camera, on both sides and in front and behind the Flyers' line, tinted by the Sky mood. They form and clear with progress as the Year 2 ones do, with a sensible total count for an iPhone.
- **Stars:** `STARS_START` in `lib/sky.ts` is a fixed 0.8 of the whole scroll. Make the stars follow the climb instead: they begin as the Flyers rise out of the Sea in Year 3 and are fully there by the Letter. The Sky is deep rose by the Letter (sunset to rose across Year 3 is already in `skyStopsOf`; check it still lines up).
- This slice does not need the Year 3 pictures. The stars part has no dependency on the camera and can be done first.

**Blocked by:** 08b: Face-on camera (the Cloud placement and the Sea's fall-away depend on the framing). The stars part can start straight after 07.

**Status:** not started

**Needs from the Creator:** nothing.

- [ ] At the start of the climb the Sea is below and falls away; once it is out of view it is not drawn, and the wake, spray and reflection are gone with it. Scrolling back brings it back with no pop.
- [ ] Clouds stream down past the Flyers through Year 3, tinted by the Sky mood, and the count stays within a sensible budget.
- [ ] The stars arrive during the climb and are fully there by the Letter; the Sky is deep rose at the Letter. Before Year 3 there are no stars.
- [ ] Phone (portrait) and laptop both look right at the start, middle and end of the climb.
- [ ] Tests cover the seams: the Sky layers and stars timing from the timeline (`lib/sky.test.ts`), the Sea strength after the Turn-around, and the Year 3 route Clouds (count, placement along the climb, life against progress) in `lib/clouds.test.ts`.
