# 03: The 3D sky

**What to build:** Turn the flat Sky into a real 3D one. Clouds sit at different depths, the Flyers weave in and out of them and make a Turn-around, and each Memory pops out from behind a Cloud in a pink frame whose handwritten Caption writes itself. This reworks parts of tickets 01 and 02; it keeps the scroll engine, the Sky colour stages and the route builder. See ADR 0001 for why the Memories move into WebGL.

- **Clouds:** soft sprite clusters placed in 3D at several depths, in the same WebGL scene as the Flyers. The camera stays fixed and drifts a few degrees with scroll so the Clouds show real parallax. The flat CSS cloud layers are removed. Each Cloud is tinted by the Sky stage: white-pink at dawn, bright white by day, orange-pink at sunset, rose-tinted at the Letter.
- **Flight path in depth:** the existing climbs, dives and loop stay. Add three Cloud passes, one at each Chapter change (How we met to Year 1, Year 1 to Year 2, Year 2 to Year 3): the Flyers fly into a Cloud, are veiled, and come out clear as the next Chapter begins. Add one Turn-around just before the Letter, ending face-on to the Recipient. The Flyers are always drawn in front of the Memories; only a Cloud can veil them.
- **Memories in WebGL:** each Memory is a textured plane in the same scene (ADR 0001). Page sections that are invisible set the scroll length; alt text lives in a hidden list for screen readers. Photo textures load lazily and are released when far away, to protect iPhone memory.
- **Frame:** a deep rose-pink (about `#e0457b`) bevelled frame with real thickness, a thin cream mat between frame and photo, and a soft glossy sheen. Black stays on the Flyers and the Captions.
- **Pop-out:** a Memory emerges from behind a Cloud and springs forward with a small bounce and a settle from a tilt into place; it stays in front of the Clouds while it is read; it leaves behind another Cloud.
- **Wiggle:** hovering over a Memory that is in front of the Clouds, or tapping it on a phone, swings the frame around the corner nearest the pointer and settles it with a spring. Memories still arriving or leaving do not react. A tap does nothing else.
- **Write-on:** each Caption, each Chapter title, and the Letter's greeting and Closing line draw themselves stroke by stroke as she scrolls (and undraw as she scrolls back), with no pen visible. The Caption finishes by the time its Memory has settled in front. This needs a single-line cursive font, which replaces Caveat for handwritten text; use an open-licence one (for example the EMS script fonts) after checking its licence. If no font looks good enough, hand-draw the stroke data for the short texts. The Letter's body is not stroke-written: it appears line by line in the same script. The Day counter stays plain digits. (The Letter and Closing line themselves land in ticket 04; this ticket delivers the Write-on for Captions and Chapter-title text and a reusable piece the Letter can use.)
- **Fallback:** with no WebGL, or with reduced motion on, show a plain stacked list of the Memories with the same pink frame and Captions: no Clouds, no Flyers, no bounce. This replaces the earlier idea that the page simply works without the Flyers.

**Blocked by:** 02: The Flyers take flight.

**Status:** done (real-iPhone frame rate and memory still to be measured in ticket 05)

**Needs from the Creator:** nothing new. Placeholder photos and Captions are used until the real ones arrive.

- [x] Clouds sit at visibly different depths and show parallax as the camera drifts; there is no flat CSS cloud layer left.
- [x] Cloud tint follows the Sky stages, and the Flyers still read against them.
- [x] At each of the three Chapter changes the Flyers fly into a Cloud and come out the other side; scrolling back reverses it.
- [x] Before the Letter the Flyers make a Turn-around and end face-on to the camera.
- [x] The Flyers are never hidden by a Memory, and never overlap the Caption or Letter text in a way that blocks reading.
- [x] A Memory arrives from behind a Cloud, is in front of every Cloud while settled, and leaves behind a different Cloud.
- [x] The frame reads as pink with visible thickness and a cream mat on both a dawn and a sunset Sky.
- [x] Hover (laptop) or tap (phone) on a settled Memory wiggles it from the nearest corner and it settles; arriving or leaving Memories ignore it.
- [x] Captions and Chapter titles draw stroke by stroke with scroll and undraw in reverse, and a Caption is complete once its Memory is settled.
- [x] With WebGL disabled, or reduced motion on, every Memory still shows in the plain list with its frame and Caption, with no errors.
- [x] Alt text for every Memory is available to screen readers.
- [~] Smooth on a real iPhone 15 (frame rate and memory checked in ticket 05); photo textures are loaded lazily and not all held at once. (Lazy loading, at most 4 photos held, and release are done and tested; the iPhone measurement is ticket 05.)
- [x] After a hot reload there is exactly one canvas and one WebGL context; Memory textures are disposed.
- [x] Tests cover the new seams: Cloud placement, route (Cloud passes and Turn-around), Pop-out timing, and Write-on progress.
