# 07: Year 2 over the Sea

**What to build:** After Year 1 the Flyers dive through a Cloud pass down to the Sea, the camera swings behind them (the Chase camera), and they skim the water through Year 2 while each Month's picture comes clear as they pass it (Fly-by). See ADR 0002 for why the camera moves.

- **Dive and camera switch:** the Year 1 to Year 2 Cloud pass becomes a steep dive into the Clouds. While the Clouds veil the Flyers, the camera moves from the fixed side view to behind them, so they come out below the Clouds, level, already in the Chase camera. Scrolling back reverses it. The old loop moves into Year 1 (Year 2 no longer has one).
- **Camera rig:** a pure `cameraAt(progress)` in a new `lib/camera-rig.ts` returns the camera for every mode (fixed with drift, Chase camera, and later the face-on one) and blends between them inside Cloud passes. The Flyers sit low in the middle of the screen (the lower third) so their backs show with the Sea and Sky ahead. The camera tilts a few degrees into each bank. Works the same in portrait and landscape.
- **Flight path over the Sea:** Year 2 is a part of the route in world units (not fitted to the screen): low flight with a gentle S-weave toward each picture on alternating sides, slight swoops up and down, and banking into each turn. The Flyers ease slower as they come alongside a picture and speed up between pictures.
- **The Sea:** a new `lib/sea.ts`. Shiny rose-pink water that mirrors the Sky, a glowing horizon, no land. The Flyers leave a soft wake of ripples and light pink-white spray, there is a burst of spray where the dive pulls out, and a dim reflection of the Flyers moves on the water. The pink ribbon trail and the Stardust stay. Keep it light for an iPhone 15 (no real water simulation).
- **Clouds along the route:** Clouds are placed along the Year 2 route so they stream past above and ahead, giving the sense of speed. They tint by the Sky mood.
- **Fly-by:** a new `lib/fly-by.ts` turns the distance between the Flyers and a picture into how clear it is. A picture hangs upright just above the water on its side, faces the camera, is lost in a pink haze while far away, is fully clear while the Flyers are alongside, and fades back into the haze after they pass. Nothing bounces. Its reflection shows on the water. It sits in the upper left or right, at the same share of the screen as a Pop-out Memory (about 70% of the width on a phone and 40% on a laptop), so the Flyers in the lower third are never covered. Drawn by real depth against the Flyers. The Month label writes on as the picture clears. A scroll back runs it in reverse.
- **Pacing:** a Fly-by Memory takes 0.8 screens (`SCREENS.flyByMemory` in `lib/timeline.ts`). Year 2's title and date write during the dive.
- **Sky moods follow the Chapters** (`lib/sky.ts`): dawn pink for How we met, bright day for Year 1, day turning to sunset over the Sea in Year 2, sunset into deep rose in Year 3 (the stars arrive in ticket 08). Moods blend across each Chapter change inside the Cloud pass.

**Blocked by:** 06: Months and Month labels.

**Status:** not started

**Needs from the Creator:** nothing new. Placeholder pictures are used.

- [ ] After Year 1 the Flyers dive into a Cloud and come out below it, level over the Sea, with no visible camera jump; scrolling back reverses it.
- [ ] In Year 2 the camera is behind the Flyers, they sit low in the middle, weave, swoop and bank, and the camera tilts slightly with them.
- [ ] The Sea reads as shiny rose-pink water with a glowing horizon; the wake, the spray burst at the dive and the Flyers' reflection are visible.
- [ ] Each Year 2 picture is invisible in haze while far away, clear when the Flyers are alongside, hazy again after, with no bounce, and it never covers the Flyers.
- [ ] The Month label of a Year 2 picture writes on as it clears and is complete when the Flyers are alongside.
- [ ] Year 2 takes about 9.6 screens for its 12 pictures; the Flyers slow beside each picture.
- [ ] The Sky mood follows the Chapters, and Year 2 ends in sunset.
- [ ] Phone (portrait) and laptop both frame the Flyers and the pictures well; no horizontal scroll.
- [ ] Tests cover the new seams: `cameraAt` (modes and blends), Fly-by clarity, the Year 2 route and its easing at pictures, and the timeline for the 0.8-screen pace.
