# 08b: Face-on camera

Slice 2 of 6 of [08: Year 3 face-on climb](08-year-3-face-on-climb.md).

**What to build:** The camera swings from behind the Flyers to in front of them inside the Year 2 to Year 3 Cloud pass, then rises with them through Year 3, so she sees them face on. After this slice the Turn-around and the Face-on climb can be seen as the ticket describes them, though Year 3 still has no pictures and the world around the climb is bare.

- **Face-on mode in `lib/camera-rig.ts`:** `cameraAt` gains a third mode (`CameraState.mode` gets `"face-on"`). The camera sits in front of the Flyers on the +z side, looks at them, and rises with them. The Flyers stay at the same place on screen. Put them low in the middle (the lower third), as in the Chase camera: the Letter card takes the top at the end, and 08d's pictures come down from above.
- **Blend from the Chase camera:** across the Year 2 to Year 3 Cloud pass the camera moves from behind to in front without passing through the Flyers (an arc round them), pulling its aim towards them in the middle of the swing so they never leave the screen, as `SWING_PULL` does for the first switch. The Flyers' own swing (08a) and the camera's swing are the same moment; they only have to agree that it ends facing.
- **Slight sway shows as the world:** like the Chase camera, follow a smoothed heading (or smoothed position) so the climb's sway shows as the world swinging, not the Flyers sliding about the screen.
- **Scene wiring:** anything in `lib/scene.ts` that branches on the camera mode (the first check is `cam.mode === "fixed"`) treats the new mode correctly: the Flyers' reflection and wake only belong to the Sea (08c finishes this), and the Flyers' draw order against Clouds still works.
- **Ending frame:** at rest the Flyers are face on, low in the middle, with the whole Letter card clear above them on both shapes. The Letter itself is unchanged.
- **Portrait and landscape** both frame the climb well.

**Blocked by:** 08a: Turn-around and climb route.

**Status:** done (branch `ticket-08a-08b`, not merged)

**Needs from the Creator:** nothing.

- [ ] Inside the Year 2 to Year 3 Cloud pass the camera goes from behind to in front of the Flyers, with no visible jump, and they stay on screen all the way; scrolling back reverses it.
- [ ] Through Year 3 the Flyers stay at the same place on screen, face on, in the lower third, while the world moves past.
- [ ] At the end the Flyers stop face on below the Letter card, and the card never overlaps them, on a phone (portrait) and a laptop.
- [ ] The Year 1 to Year 2 dive and the Chase camera in Year 2 are exactly as before.
- [ ] Tests cover `cameraAt` in the new mode and the blend (position, aim, roll, Flyers always inside the view across the swing, equal values at both ends of the blend), on both screen shapes.
