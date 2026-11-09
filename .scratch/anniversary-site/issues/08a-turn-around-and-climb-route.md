# 08a: Turn-around and climb route

Slice 1 of 6 of [08: Year 3 face-on climb](08-year-3-face-on-climb.md). Read that ticket and ADR 0002 first.

**What to build:** The Flyers' flight from the end of Year 2 to the Letter. They pull up out of the Sea and swing round inside the Year 2 to Year 3 Cloud pass (the Turn-around), then climb straight up with their chests towards +z (where the face-on camera will be) and a slight sway through Year 3, and slow to a stop under the Letter. This replaces the Year 3 stand-in that keeps skimming the Sea. Only the Flyers' path changes in this slice; the camera, the Sea, the Clouds and the pictures are the next slices.

- **Sea leg ends with Year 2:** `buildSeaLeg` (`lib/sea-route.ts`) is given only Year 2's 12 pictures, and no longer eases to a rest at the end. Everything after that is a new leg.
- **Climb leg:** a new pure `lib/climb-route.ts`, built like the Sea leg (evenly spaced poses plus anchors from scroll progress to pose), joined on after it in `routeForAspect`. It holds: the pull-up out of the water, the swing round (the Flyers end facing +z, the side the face-on camera will take in 08b), a straight climb with a slight sway, and a slow-down to rest at `restAt`.
- **The swing is hidden:** the big turn of the Flyers' pose happens inside the Year 2 to Year 3 Cloud pass (`timeline.passes[2]`). Outside that pass the pose changes smoothly. If the yaw, pitch and roll maths for "climbing straight up, chest towards the camera" gets awkward (pitch near 90 degrees), do a short throwaway prototype of the swing first.
- **Year 3 pictures are not drawn in this slice.** Their scroll room stays, so the page is still about 54 screens. 08d brings them back.
- **Camera stays the Chase camera for now.** From below and behind the climb looks odd; 08b fixes that. Do not polish the view in this slice.
- **Names:** `timeline.turnAround` and `SCREENS.turnAroundFrom` / `turnAroundTo` only time where the Flyers come to rest (ticket 07's stand-in). Rename them (for example `rest`) so "Turn-around" means the real one, which is the third Cloud pass. `Schedule.restAt` keeps its meaning.

**Blocked by:** 07: Year 2 over the Sea.

**Status:** done (branch `ticket-08a-08b`, not merged)

**Needs from the Creator:** nothing.

- [ ] At the end of Year 2 the Flyers pull up out of the water and swing round inside the Cloud pass; there is no jump in position or pose anywhere along the route, and scrolling back retraces it.
- [ ] After the pass the Flyers climb straight up with a slight sway (bounded sideways drift), facing +z, at a steady pace through Year 3.
- [ ] The Flyers slow to a stop at `restAt`, below where the Letter card will be, on a phone (portrait) and a laptop.
- [ ] The Sea leg ends at the end of Year 2 (no weave, slow zone or rest in Year 3), and Year 2's route and pacing are exactly as ticket 07 left them.
- [ ] Nothing named "Turn-around" times anything but the real Turn-around.
- [ ] Tests cover the seams: the climb leg (starts where the Sea leg ends, straight with a bounded sway, ends facing +z, comes to rest), the pose rate outside the Cloud pass, the joined route in `lib/route.test.ts`, and the timeline spans in `lib/timeline.test.ts`.
