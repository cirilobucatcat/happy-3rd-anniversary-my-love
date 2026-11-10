# 08c: Open Sky around the climb

Slice 3 of 6 of [08: Year 3 face-on climb](08-year-3-face-on-climb.md).

**What to build:** Make the climb feel like a climb. The Sea falls away below at the start, Clouds stream down past, the sunset deepens into rose night and the stars arrive as the Flyers rise.

- **The Sea falls away:** as the camera rises the water drops out of view. The wake, spray and the Flyers' reflection stop once they are off the water. When the Sea is wholly out of the frame it is not drawn at all (no shader or reflection cost on an iPhone). Check that no hard edge or horizon line pops out as it goes. `seaStrength` in `lib/sea.ts` is the existing hook for how strongly the water shows.
- **Clouds stream down:** the route Clouds in `lib/clouds.ts` are strewn above and to the sides of the Sea route today (they use `route.sea.y` and the old rest time). Add the same idea along the climb, so Clouds come down past the camera, on both sides and in front and behind the Flyers' line, tinted by the Sky mood. They form and clear with progress as the Year 2 ones do, with a sensible total count for an iPhone.
- **Stars:** `STARS_START` in `lib/sky.ts` is a fixed 0.8 of the whole scroll. Make the stars follow the climb instead: they begin as the Flyers rise out of the Sea in Year 3 and are fully there by the Letter. The Sky is deep rose by the Letter (sunset to rose across Year 3 is already in `skyStopsOf`; check it still lines up).
- This slice does not need the Year 3 pictures. The stars part has no dependency on the camera and can be done first.

**Blocked by:** 08b: Face-on camera (the Cloud placement and the Sea's fall-away depend on the framing). The stars part can start straight after 07.

**Status:** done

**Needs from the Creator:** nothing.

- [x] At the start of the climb the Sea is below and falls away; once it is out of view it is not drawn, and the wake, spray and reflection are gone with it. Scrolling back brings it back with no pop.
- [x] Clouds stream down past the Flyers through Year 3, tinted by the Sky mood, and the count stays within a sensible budget.
- [x] The stars arrive during the climb and are fully there by the Letter; the Sky is deep rose at the Letter. Before Year 3 there are no stars.
- [x] Phone (portrait) and laptop both look right at the start, middle and end of the climb.
- [x] Tests cover the seams: the Sky layers and stars timing from the timeline (`lib/sky.test.ts`), the Sea strength after the Turn-around, and the Year 3 route Clouds (count, placement along the climb, life against progress) in `lib/clouds.test.ts`.

## Decisions made while building

- **The Sea fades by camera height, not by geometry.** It is a flat plane, so at eye level it would fill the lower half of the view for ever. `seaStrength(progress, dive, cameraHeight)` takes the camera's height over the water in Flyer heights and is whole up to `SEA_FALL.from` (14) and gone at `SEA_FALL.to` (36); the climb starts at about 12 and rises about 13 a screen, so the water is still there below at the start and has melted into the Sky after about 2 screens. At 0 `sea.update` returns false and nothing is drawn. The wake, spray and reflection already stop by themselves once the Flyers are off the water.
- **Stars follow the rose.** `skyLayers().stars` is now the rose weight. `skyStopsOf` puts the deep-rose stop at the Letter card's start (`timeline.letter.card.from`), so sunset to rose, and the stars, run from the end of the Turn-around to there. The default fixed stops (no timeline) make the stars come in from 0.7, not 0.8, as a result.
- **Climb Clouds** are a new role, `climb` (`climbClouds` in `lib/clouds.ts`): one every 3.3 Flyer heights up the climb (about 45, 7 puffs each, tested at 14 formed at once or fewer), alternating sides, most behind the Flyers (so never veiling them), a few nearer than them only where the view is wide enough to see them clear of the Flyers' column (a laptop, not a phone). Each forms 14 to 11 heights below the Flyers (above the top of the view) and clears 9 to 13 heights above them; those near the top stay as the Flyers come to rest, so the last frame is not bare.
- Visual check (headless Edge, swiftshader): phone and laptop at the start, middle and end of the climb. The Letter's real length changes the page height (about 53.1 screens against the default 53.7), so `?p=` values for a picture differ from `buildTimeline(CHAPTERS)`'s; take them from the page's own timeline.
