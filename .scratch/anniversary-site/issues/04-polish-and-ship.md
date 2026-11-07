# 04: Polish and ship

**What to build:** Music, graceful fallbacks, a real-iPhone verification pass, and a live private link the Creator can send on the Anniversary.

- Sound button that plays and pauses one song, starting only after a tap. If `SITE.song` is empty the button is hidden and the site works silently.
- Reduced motion: simple fades for Memories, no Flight path, no parallax. No WebGL: the full story works without the Flyers. WebGL context loss (for example after switching apps) recovers without a blank screen.
- Verification pass from the production build served from `out/`: headless screenshots at phone and laptop sizes at key `?p=` values; `dvh` layout with the Safari address bar, safe-area insets and the iOS keyboard on the gate; frame rate and memory on a real iPhone; an "Open in Safari for the best experience" hint for in-app browsers; total transfer size sane for mobile data.
- Optional: swap in the Creator's real `couple.glb`, checking the 2 MB and 30,000-triangle budget and adjusting scale, orientation, pivot and rim light.
- Deploy `out/` with Netlify drag-and-drop under an unguessable site name with `noindex`, with step-by-step instructions and a day-of checklist.

**Blocked by:** 03: Her story.

**Status:** ready-for-agent

**Needs from the Creator:** the song as an MP3 (about 3 to 4 MB), an iPhone for testing, the app the link will be sent through, and optionally `couple.glb`. Note that online photo-to-3D tools upload the Creator's photos to that service.

- [ ] On iPhone Safari, music starts after a tap and pauses on a second tap; nothing breaks with no song configured.
- [ ] With reduced motion on, the whole story is readable and nothing flies.
- [ ] With WebGL disabled there is no error and the Memories, counter and Letter all work.
- [ ] Returning to the tab after backgrounding restores the 3D canvas.
- [ ] Smooth scrolling and flight on a real iPhone, in Safari and in the app the link will be sent through.
- [ ] No horizontal scroll at any width from 360 px up; photos are about 1600 px and lazy-loaded.
- [ ] A short list of any remaining issues is written down.
- [ ] If provided, the real `couple.glb` flies the whole route without clipping, stays black matte with a readable rim light, and falls back to the placeholder if broken.
- [ ] The live link opens the gate, then the full experience, on iPhone Safari, and the page carries `noindex`.
- [ ] The Creator has a short day-of checklist: what to send and what to test one last time.
