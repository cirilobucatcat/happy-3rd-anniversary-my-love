# 08d: Year 3 pictures in the Sky

Slice 4 of 6 of [08: Year 3 face-on climb](08-year-3-face-on-climb.md).

**What to build:** Bring Year 3's 12 pictures back as Fly-bys hanging in the open Sky: lost in haze while far away, clear as the Flyers pass, haze after. No water, so no reflection. 0.8 screens each, and the Month labels write on.

- **Same rule as Year 2** (`lib/fly-by.ts`): `flyByClarity` and `labelProgress` work from how far ahead of the Flyers a picture is, so they carry over. The pictures alternate sides, carrying on from Year 2 (Year 2's last is on the right, so Year 3's first is on the left).
- **Placement is the real design question.** In Year 2 the picture hangs above the Flyers' heads while they are alongside it, so it never covers them. In the climb the camera rises with the Flyers and they stay put on screen, so pictures stream down from the top. At the moment of peak clarity a picture must be in the upper part of the screen, above the Flyers, at the same share of the screen as a Pop-out Memory (about 70% of the width on a phone and 40% on a laptop, less for a tall photo on a laptop). So "alongside" for Year 3 is not the same height as the Flyers: place each picture ahead of (above) the Flyers' position at the alongside moment, and keep `placeFlyBys` choosing from the camera at that moment, as it does for Year 2. Keep the Year 2 placement as it is.
- **No reflection in Year 3:** the flipped copy of a picture's meshes is only added for Year 2. Today `FLY_BY_CHAPTERS` in `lib/timeline.ts` marks both Years as Fly-by; keep that, and add whatever tells the scene which Fly-bys sit over water.
- **Draw order:** pictures are drawn by real depth against the Flyers and the Clouds (the `byDepth` flag), which must still hold with the face-on camera.
- **Memory textures:** at most 4 photo textures are held at once, as in ticket 05. Check that the hold-and-release still works for Year 3.
- **Year 3's title and date** write during the Turn-around (the third Cloud pass). Check the timing in the climb.

**Blocked by:** 08b: Face-on camera. Can be done alongside 08c.

**Status:** not started

**Needs from the Creator:** nothing yet. Later: the 12 real pictures for Year 3 (see ticket 06).

- [ ] Each Year 3 picture is invisible in haze while far away, clear when the Flyers pass it, hazy after, with no bounce, and it never covers the Flyers, on a phone (portrait) and a laptop.
- [ ] A Year 3 picture has no reflection; Year 2's pictures keep theirs.
- [ ] The Month label of each Year 3 picture writes on as it clears and is complete at the moment of peak clarity; scrolling back runs it in reverse.
- [ ] The 12 pictures alternate sides, continuing from Year 2, and each takes 0.8 screens.
- [ ] No more than 4 photo textures are held at once through Year 3.
- [ ] Tests cover the seams: Year 3 placement (a sweep over the whole fly-by checks the Flyers are never inside a picture's frame while it is more than faintly visible, as ticket 07 did for Year 2), the side alternation across Years, no reflection for Year 3, and draw order with the face-on camera.
