# 05: Polish and ship

**What to build:** Music, graceful fallbacks, a real-iPhone verification pass, and a live private link the Creator can send on the Anniversary.

- Sound button that plays and pauses one song, starting only after a tap. (Ticket 04's gate already starts the page's audio context on her first tap: `unlockAudio()` in `lib/audio.ts`; the song itself and the button are here.) If `SITE.song` is empty the button is hidden and the site works silently.
- Reduced motion and no WebGL: the plain stacked Memory list built in ticket 03 (no Clouds, Flyers, bounce or parallax) carries the whole story, including counter and Letter. (Ticket 04 already put the Intro, each Chapter's date and day number, and the finished Letter in that list; it has no HUD, progress cue or Day counter that climbs, which this ticket may add.) WebGL context loss (for example after switching apps) recovers without a blank screen.
- Verification pass from the production build served from `out/`: headless screenshots at phone and laptop sizes at key `?p=` values; `svh` layout with the Safari address bar, safe-area insets and the iOS keyboard on the gate (ticket 04 built the gate for it and checked a simulated shrunken viewport, but not a real keyboard); frame rate and memory on a real iPhone; an "Open in Safari for the best experience" hint for in-app browsers; total transfer size sane for mobile data.
- Optional: swap in the Creator's real `couple.glb`, checking the 2 MB and 30,000-triangle budget and adjusting scale, orientation, pivot and rim light.
- Deploy `out/` with Netlify drag-and-drop under an unguessable site name with `noindex`, with step-by-step instructions and a day-of checklist.

**Blocked by:** 04: Her story.

**Status:** built and checked in headless Edge against the production build; open boxes below need the Creator (song, iPhone, Netlify). See `DEPLOY.md` for the steps, the day-of checklist and the known issues.

**Needs from the Creator:** the song as an MP3 (about 3 to 4 MB), an iPhone for testing, the app the link will be sent through, and optionally `couple.glb`. Note that online photo-to-3D tools upload the Creator's photos to that service.

- [ ] On iPhone Safari, music starts after a tap and pauses on a second tap; nothing breaks with no song configured. _(Works in desktop Edge with a test tone, loops, and nothing breaks with no song; not yet tried on an iPhone.)_
- [x] With reduced motion on, the whole story is readable and nothing flies. _(Phone and laptop; switching it on while the page is open also swaps to the list. The list ends with the Anniversary's day number above the Letter.)_
- [x] With WebGL disabled there is no error and the Memories, counter and Letter all work.
- [ ] Returning to the tab after backgrounding restores the 3D canvas. _(Built and tested by forcing the browser to drop the 3D layer: it comes back in place, or a fresh canvas is built, or the plain list takes over. Not yet tried by really switching apps on an iPhone.)_
- [ ] Smooth scrolling and flight on a real iPhone, in Safari and in the app the link will be sent through.
- [x] No horizontal scroll at any width from 360 px up; photos are about 1600 px and lazy-loaded. _(Checked at 360, 375, 390, 414, 768, 1024 and 1440 px in the gate, the Sky and the list. Photos: `npm run resize-photos` makes them 1600 px; they are lazy in the list and loaded as textures only near the scroll position in the Sky.)_
- [x] A short list of any remaining issues is written down. _(`DEPLOY.md`, "Known issues".)_
- [x] If provided, the real `couple.glb` flies the whole route without clipping, keeps its own colours with a readable rim light, and falls back to the placeholder if broken. _(402 KB, and 20,520 triangles (about 25,000 counting repeated parts), both under the 2 MB and 30,000 budget; screenshots at 12 points on a phone and a laptop; fallback covered by `lib/flyers.test.ts`. This ticket did not change the model, its scale or its rim light.)_
- [ ] The live link opens the gate, then the full experience, on iPhone Safari, and the page carries `noindex`. _(`noindex` is in the page and in `public/_headers`, and is tested; the live link needs the Creator's Netlify account.)_
- [x] The Creator has a short day-of checklist: what to send and what to test one last time. _(`DEPLOY.md`.)_
