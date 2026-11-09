# Spec: Happy 3rd Year, My Love

Status: draft v4, 2026-11-09 (adds the Sea and the camera that follows the Flyers: one picture per Month, Year 2 skimming the Sea, Year 3 a face-on climb, Wiggle and Year Captions removed; work now 8 slices)
Supersedes `ARCHITECTURE.md` where they differ (3D Flyers, GSAP kept, Next.js, the length target). Tickets are in `issues/`.

## Problem

The user wants a surprise for their girlfriend's 3rd anniversary: a website she opens on her iPhone 15 (and possibly a laptop) and experiences by scrolling. It should feel handmade, personal and romantic, not like a template.

## Solution

A single scroll-driven page. A pink 3D sky changes mood with the Chapters and is filled with Clouds at different depths. A 3D model of the two of them holding hands flies through it, and their photos, one for every Month, are shown in deep rose-pink frames. The story has three flights:

1. **How we met and Year 1 (side-on):** the camera is fixed. The Flyers climb, arc over, loop once and dive, and each photo pops out from behind a Cloud with a handwritten line that draws itself (a Caption in How we met, a Month label in Year 1).
2. **Year 2 (the Sea):** the Flyers dive through a Cloud down to the Sea and skim it like Iron Man while the camera follows behind them (the Chase camera). Each Month's photo hangs beside their route, lost in a pink haze until they pass it, then comes clear and fades away behind them.
3. **Year 3 (the Face-on climb):** the Flyers pull up, swing round inside a Cloud and climb straight up facing her, with the camera in front of them. Pictures stream down past as they rise into a starry rose sky, and they stop face on below the Letter.

It ends with a letter. One self-paced pass takes about 5.8 minutes (was about 4 before the Months were added).

## Terms

- **Flyers**: the 3D model of the two of them holding hands.
- **Month / Month label**: one of the 36 one-month steps counted from Day 1, one Memory each; the handwritten label (such as "August 2024") that replaces the Caption on those Memories.
- **Memory / Caption**: one photo in its frame; the handwritten line under a How we met Memory (the only three Captions in the story).
- **Sky / Cloud / Sea**: the pink 3D world, soft Clouds at different depths, and the open rose-pink water the Flyers skim in Year 2.
- **Cloud pass / Turn-around**: the Flyers fly into a Cloud and come out the other side (at each Chapter change; the Year 1 to 2 pass is the dive); at the end of Year 2 they pull up out of the Sea and swing round inside a Cloud to face her.
- **Pop-out / Fly-by**: how a Memory arrives in How we met and Year 1 (emerges from a Cloud with a bounce); how it appears in Year 2 and Year 3 (hangs beside the route, in haze until the Flyers pass).
- **Chase camera / Face-on climb**: the camera behind the Flyers in Year 2; the straight climb in Year 3 with the camera in front.
- **Write-on**: handwritten text that draws itself stroke by stroke as she scrolls, with no pen visible.
- **Chapter**: a group of Memories (How we met, Year 1, Year 2, Year 3).
- **Flight path**: the route the Flyers follow as she scrolls.
- **Day 1**: the day they became a couple. The Day counter is computed from the real dates, so the Anniversary lands on Day 1,096 (or 1,097 if a leap day falls between), not a fixed 1,095.

Full definitions live in `GLOSSARY.md`.

## Settled decisions

- Pink sky. Black accents on the handwritten text. The Flyers are shown in their own colours (changed from black on 2026-11-08) and leave their pink ribbon trail with Stardust in pinks and oranges around it. The Memory frames are deep rose-pink (about `#e0457b`) with a thin cream mat, bevelled with real thickness and a soft sheen (changed from black on 2026-11-07).
- **3D sky detour (2026-11-07):** fixed camera with a slight scroll drift for parallax; sprite-cluster Clouds in 3D tinted by Sky stage; Memories are textured planes in the same WebGL scene (ADR 0001); the Flyers are always in front of Memories and only Clouds veil them; three Cloud passes at the Chapter changes; Pop-out arrival; Write-on (stroke by stroke, scroll-driven, single-line cursive font replacing Caveat) for handwritten text, and the Letter's body revealed line by line. Changed on 2026-11-09 (see the next bullet): the camera is fixed and the Flyers are always in front of Memories only up to the end of Year 1; the Turn-around and the Wiggle are gone from before the Letter and from the whole site.
- **The Sea and the moving camera (2026-11-09, grilled with the Creator, ADR 0002):**
  - One picture per **Month**, counted from Day 1: 12 per Year, 36 in all, plus the 3 of How we met. Month labels are worked out from `DAY_ONE` (a short month clamps to its last day). Year Memories have a Month label instead of a Caption; How we met keeps its 3 Captions.
  - How we met and Year 1 stay as built (side-on, fixed camera, Pop-out). The one loop moves into Year 1.
  - After Year 1 the Flyers dive through the Cloud pass down to the Sea and the camera swings behind them inside the Cloud. Year 2 is level flight low over the open, made-up Sea with a gentle S-weave, swoops and banking; the camera tilts a few degrees with them. The Flyers sit low in the middle of the screen. They leave a wake of ripples and spray, a spray burst at the end of the dive, and a dim reflection. The ribbon trail and Stardust stay.
  - Years 2 and 3 use **Fly-by**: each picture hangs upright beside the route, facing the camera, lost in a pink haze while far away, fully clear as the Flyers pass, hazy again after, with no bounce. In Year 2 it hangs just above the water with a reflection. The Flyers ease slower beside each picture. Pictures sit in the upper left or right and never cover the Flyers.
  - The **Turn-around** moves to the end of Year 2 (pull up out of the Sea, swing round inside a Cloud); the one before the Letter is removed. Year 3 is a straight **Face-on climb** with a slight sway and the camera in front, ending with the Flyers stopped face on below the Letter. The Letter section is unchanged.
  - Sky moods follow the Chapters: dawn pink (How we met), bright day (Year 1), day turning to sunset over the Sea (Year 2), sunset into starry deep rose (Year 3, stars arriving during the climb).
  - The **Wiggle is removed everywhere**. Year titles and dates write during the dive and the Turn-around.
- Phone first (iPhone 15, Safari), must also work on a laptop.
- Self-paced scrolling, about 5.8 minutes (agreed 2026-11-09, up from about 4). Layout: Intro 0.7 screens, four Chapter titles 2.0 each (8.0), How we met 3 Memories and Year 1 12 Memories at 1.2 screens each (18.0), Year 2 and Year 3 24 Fly-by Memories at 0.8 each (19.2), and the Letter section about 7.8, so the page is about 54 screens long. At a relaxed 6.5 seconds a screen that is about 5.8 minutes, with each Pop-out Memory about 8 seconds, each Fly-by about 5, and the Letter section about a minute. A longer Letter simply scrolls for longer (about 28 words a screen, within limits). `?debug` shows the estimate; the pace and the layout are `RELAXED_SECONDS_PER_SCREEN` and `SCREENS` in `lib/timeline.ts`. (Before 2026-11-09 the page was about 38 screens, about 4 minutes, with 18 Memories at 1.2 screens.)
- Placeholder photos until real ones are supplied: 39 (3 for How we met, 12 for each Year).
- Placeholder dates: Day 1 is 2024-02-14 and the Anniversary is 2027-02-14, which is Day 1,097 (it spans the 2024-02-29 leap day). The user said "Feb 14 for now" without a year; the years are inferred because Feb 14, 2026 has already passed. From 2026-11-07 the Anniversary is 99 days away. Day 1 is the day they became a couple, confirmed by the user.
- GSAP + ScrollTrigger are kept.
- Flyers are a 3D model: a simple low-poly couple built in code for now, replaceable by `couple.glb` later. Shown in the model's own colours (her rose-pink dress and skin, his black suit and black hair) with a pink rim light at half its earlier strength (changed from all-black on 2026-11-08).
- **Next.js, latest version** (16.4.5 on 2026-11-07, React 19), replacing the earlier "plain HTML, no build step" plan.
- Model budget: 2 MB and 30,000 triangles.

## Assumed defaults (recommended, user has not confirmed)

- ScrollTrigger scrub is the only scroll source. One shared `gsap.ticker` callback renders the 3D scene.
- Plain Three.js inside client components, not React Three Fiber. Keeps one render loop and one scroll source.
- TypeScript, App Router, npm, plain CSS (no Tailwind).
- Static export (`output: 'export'`), so the built `out/` folder can be dragged onto Netlify. No Next.js server features are used.
- Chapters: Intro, How we met, Year 1, Year 2, Year 3, Letter (the Letter and the Closing line end the story).
- An unlock question only she can answer opens the site (a soft gate, not real security), plus an unguessable URL. Case, spaces, punctuation and accents are ignored; wrong answers get kind messages that never reveal the answer. The gate hides the site and stops it scrolling; her first tap there also starts the page's audio context for iOS. `?p=`, `?debug` and `?open` skip the gate, and so does a tab that is already unlocked (this tab only, via sessionStorage).
- One song, supplied by the user, played and paused by the Sound button. It starts only when she taps the button (the gate's first tap only unlocks the page's audio context). It plays in a plain `<audio>` element, so the iPhone's silent switch does not mute it, and it is not downloaded until the tap. `SITE.song` empty means no button.
- The user writes the letter; Claude helps polish. Letter language to be decided.
- The Flyers fly side by side, hands joined, leaning forward about 30 degrees. Her hair and dress trail behind her; he has short hair.
- The link is sent in an app that may open an in-app browser, so build for Safari first and add an "Open in Safari" hint.
- **For the Sea change (2026-11-09):** the Month label sits under the frame where a Caption would, one short line, and the room kept under frames shrinks so frames can be slightly bigger; alt text defaults to the label. The loop moves from Year 2 into Year 1. The Sea is light (a shaded surface, a few ripple and spray sprites, a mirrored copy of the Flyers at low opacity), not a water simulation. The Day counter keeps counting as built; with 12 equally spaced pictures per Year it lands near each Month's own day number at that picture, without being forced to. The plain fallback list shows the Month labels.

## Trade-off accepted

Next.js adds a build step, a `node_modules` folder and React lifecycle quirks to what is a single page. The user chose it anyway. The cost is managed by: static export (no server), plain Three.js and GSAP in client components with strict cleanup, and pinned exact versions.

A moving camera (ADR 0002) means the Flight path is no longer one route fitted to the screen. The cost is a second kind of route part in world units for Years 2 and 3, and Clouds and the Sea placed along it. The camera switches happen inside Cloud passes so no jump shows.

## User stories

1. As the girlfriend, I open the link and, after answering the unlock question, see a pink sky and the Flyers on screen.
2. As the girlfriend, I scroll and the Flyers fly along a path that climbs, dives, turns and loops once.
3. As the girlfriend, in How we met and Year 1 I see each Memory pop out from behind a Cloud into a pink frame, and its handwritten Caption (How we met) or Month label (Year 1) draws itself as I scroll.
3a. As the girlfriend, after Year 1 I see the Flyers dive through a Cloud down to the Sea, and in Year 2 I follow them from behind as they skim the water, each Month's picture coming clear as they pass it and fading away behind them.
3b. As the girlfriend, at the end of Year 2 I see the Flyers pull up out of the Sea and turn to face me inside a Cloud.
3c. As the girlfriend, in Year 3 I see the Flyers climb straight up facing me into a starry sky, with each Month's picture coming clear as they pass it, and they stop below the Letter.
4. As the girlfriend, I see a day counter climb from Day 1 up to the Anniversary's day number as I move through the Chapters.
5. As the girlfriend, I reach a letter on a cream card and a closing line.
6. As the girlfriend, I can tap a button to play or pause our song.
7. As the girlfriend, if my device cannot do 3D, or I use reduced motion, I still get a calm, working version.
8. As the site's creator, I change all content (photos, Captions for How we met, dates, letter, song) in one file, `content/memories.ts`; the Month labels come from Day 1.
9. As the site's creator, I can jump to any point in the scroll with `?p=0.4` to check it without scrolling.

## Implementation decisions

### Structure

```
app/layout.tsx, page.tsx, globals.css
components/Experience.tsx   client; owns ScrollTrigger + the one ticker; mounts everything below
components/Sky.tsx  Memories.tsx  Hud.tsx  Gate.tsx  Letter.tsx  SoundButton.tsx
components/FlyersCanvas.tsx loaded with next/dynamic, ssr: false
lib/scroll.ts               progress value + subscribe(fn(progress, dt))
lib/scene.ts  lib/flyers.ts  lib/route.ts
lib/camera-rig.ts           the camera for every mode (fixed, Chase camera, face-on) and its blends   [new]
lib/sea.ts                  the Sea, its horizon, wake, spray and reflection                         [new]
lib/fly-by.ts               how clear a Fly-by picture is, from its distance to the Flyers          [new]
content/memories.ts         the only content file: SITE, CHAPTERS, letter, gate, song
public/photos  public/audio  public/models/couple.glb (optional)
scripts/resize-photos.mjs   resizes photos to about 1600 px
next.config.ts              output: 'export', images unoptimized
```

`lib/days.ts` gains `addMonths` and `monthLabel`. `lib/wiggle.ts` is deleted.

### Content shape

```ts
// How we met: Captions, no Months.
type MetMemory = { src: string; caption: string; ratio?: number; alt?: string };
// Year 1, 2 and 3: exactly 12 each, one per Month; the Month label is derived from DAY_ONE.
type YearMemory = { src: string; ratio?: number; alt?: string };
```

A content test checks that each Year has 12 Memories and How we met has its Captions.

### Scroll and rendering

- ScrollTrigger scrub produces one progress value, 0 to 1, over the whole page.
- Every module is updated from that value inside one `gsap.ticker` callback. No other scroll listeners.
- Animate only `transform` and `opacity` in the DOM (the Memories now live in the WebGL scene). Use `svh` units for mobile browser bars.
- All animation code runs in `useGSAP` or effects with full cleanup, because React Strict Mode mounts effects twice in development. ScrollTrigger instances, the ticker callback, the WebGL renderer and its textures must all dispose cleanly.
- Browser-only code (`window`, WebGL, `?p=`) never runs during server render, which avoids hydration errors.
- The one listener outside the shared ticker that is about the screen's size and not the story's scrolling: the gate follows the `visualViewport` so the iPhone keyboard never covers its field (`components/Gate.tsx`). The page cannot scroll while the gate is up, and the listeners go when it does. The gate also sets its `top` and `height` from that viewport, which is a layout change, not an animation; nothing animates those. (The Memories' hover and tap input is gone with the Wiggle, so the Sky layer takes no pointer input.)
- Photos use plain `<img loading="lazy">` (the Next image optimizer is not available with static export).

### Layers (back to front)

1. Sky gradients (fixed DOM, four layers cross-fading, following the Chapters)
2. One fixed, transparent WebGL scene holding, in depth order: Stars, Clouds (far to near), the Sea (Year 2), Memories (pink-framed planes), the Flyers with their pink trail and Stardust. Up to the end of Year 1 the Flyers are always drawn in front of the Memories; in Years 2 and 3 everything, Fly-by Memories included, is ordered by real depth. Clouds can be in front of or behind any of them.
3. HUD, sound button, unlock gate, intro and the Letter card (DOM)
4. Invisible page sections that set the scroll length; a hidden list carries the Memories' alt text

(See `docs/adr/0001-memories-in-webgl.md` and `docs/adr/0002-camera-follows-the-flyers-in-years-2-and-3.md`.)

### Camera

- `cameraAt(progress)` (`lib/camera-rig.ts`) is a pure lookup, like `poseAt`, so scrolling back retraces it. Modes: **fixed** (with the slight scroll drift) up to the end of Year 1; **Chase camera** behind the Flyers in Year 2, tilting a few degrees into each bank, with the Flyers in the lower third of the screen; **face-on** in front of the Flyers in Year 3, rising with them.
- The switches (fixed to Chase camera in the dive, Chase camera to face-on in the Turn-around) happen inside Cloud passes, where the Flyers are veiled, so no jump shows.
- Works in portrait and landscape; the phone route variant (`PORTRAIT_TURNS`) applies only to the fitted, side-on part.

### Flyers

- The model's own materials, each with a soft Fresnel pink rim (half the strength of the old black look). The placeholder couple built in code gets matching flat colours (skin, rose-pink dress, black suit and hair).
- Stardust (decided 2026-11-08) is scattered around the pink ribbon trail, which is kept unchanged. It is about 120 pieces: five-point stars, four-point sparkles and small glitter dots (about 1 star to 2 sparkles, plus a few dots). It uses the sky's colours, made strong enough to stand out against it, in the same order all the way through the story: hot pink at the Flyers, then coral and orange, to gold at the tail, with a slow shimmer along the length (changed from full rainbow on 2026-11-08). Colours are solid and saturated with a small white glow in each piece's centre (normal blending, so the pink sky does not wash them out). Each piece is dropped at a point on the Flight path and stays there, drifting out sideways as it ages, from the Flyers' own width to twice that. It shrinks and fades out about 2.4 screens back. It is scroll-driven and rewinds, with a time-based twinkle and slow spin so it still sparkles while she pauses. A small burst of pink and orange sparkles comes out when the Flyers spring up. The trail and Stardust are drawn with the Flyers, so Cloud passes veil all three together. When a Cloud pass veils them, the Clouds sit in front of the Flyers by depth.
- Static flying pose; the Flight path drives position, rotation, banking and left/right turns in 3D, so no flip trick is needed.
- Optional `public/models/couple.glb` replaces the built-in couple with no code change. Budget: 2 MB and 30,000 triangles.
- In Year 2 they also leave a wake of ripples and light pink-white spray on the Sea, with a spray burst where the dive pulls out, and a dim reflection on the water.

### Flight path

- One lookup, `poseAt(progress)`, over three parts that join inside Cloud passes:
  1. **Up to the end of Year 1** (How we met and Year 1): as built, side-on and fitted to the viewport on resize: fly right, climb, arc over, the one loop (moved here from Year 2), then a steep dive that becomes the Year 1 to Year 2 Cloud pass. A Cloud pass sits at the How we met to Year 1 change.
  2. **Year 2** (the Sea): in world units, followed by the Chase camera. Level flight just above the water with a gentle S-weave toward each picture on alternating sides, slight swoops, and banking into each turn. The Flyers ease slower as they come alongside a picture and speed up between pictures.
  3. **Year 3** (the Face-on climb): in world units, followed by the face-on camera. It starts with the Turn-around (pull up out of the Sea, swing round inside the Year 2 to Year 3 Cloud pass), then climbs straight up with a slight sway, and slows to a stop face on below the Letter card.
- Scroll progress selects the position along the path.

### Fly-by

- A picture hangs still beside the route (upright, facing the camera, alternating sides, in the upper left or right of the screen at the same share of the screen as a Pop-out Memory: about 70% of the width on a phone, 40% on a laptop). In Year 2 it is just above the water, with a reflection; in Year 3 it hangs in the open Sky.
- `lib/fly-by.ts` turns the distance between the Flyers and the picture into how clear it is: lost in a pink haze while far away, fully clear while the Flyers are alongside, hazy again once they have passed. Nothing bounces or scales in. It depends only on that distance, so scrolling back retraces it.
- The Month label writes on as the picture clears and is complete when the Flyers are alongside.
- The Flyers sit in the lower third of the screen, so a picture in the upper part never covers them. Drawn by real depth.
- A Fly-by Memory takes 0.8 screens of scroll (`SCREENS.flyByMemory`). The Chapter opener of Year 2 writes during the dive and Year 3's during the Turn-around, and fades before the Year's first picture.

### Sky

The mood follows the Chapters, not fixed scroll positions, and blends across each Chapter change inside the Cloud pass:

| Chapter | Mood |
|---|---|
| How we met | Dawn pink |
| Year 1 | Bright pink day |
| Year 2 | Day turning to sunset over the Sea |
| Year 3 | Sunset into deep rose with stars (stars arrive during the climb, full by the Letter) |

Clouds are soft sprite clusters in 3D at several depths and are tinted by stage: white-pink at dawn, bright white by day, orange-pink at sunset, rose-tinted at the Letter. In Years 2 and 3 they are placed along the route and stream past the camera.

### The Sea

Open, made-up, shiny rose-pink water that mirrors the Sky above it, with a glowing horizon and no land, trees, boats or houses. It appears under the Flyers as they come out of the dive and falls away below as they climb into Year 3. It stays light for an iPhone: a shaded surface, a few ripple and spray sprites, and a mirrored copy of the Flyers at low opacity, not a water simulation.

### Content

- Each Chapter opens with a large title and date. Memories have deep rose-pink bevelled frames with a cream mat, a slight tilt in Pop-out, a handwritten line under them (a Caption in How we met, a Month label in each Year), and alternate left and right (about 70% width and staggered on phones).
- Write-on (stroke-by-stroke, scroll-driven) is used for Captions, Month labels, Chapter titles, and the Letter's greeting and Closing line. The Letter body appears line by line in the same script. The Day counter stays plain digits. The single-line cursive font is the EMS Allure stroke font built in ticket 03.
- The letter is on a cream paper card. The page ends with "Happy 3rd anniversary, my love."

### Accessibility and fallbacks

- Reduced motion and no WebGL: a plain stacked list of the Memories with the same pink frame and Captions or Month labels, no Clouds, Flyers, Sea or bounce. The counter and Letter still work.
- Alt text for every Memory is in a hidden list for screen readers.

## Slices

Each slice is one ticket in `issues/`, in a linear chain (01 -> 02 -> ... -> 08). Each ends in something the user can open and judge on a phone. The earlier 14 finer-grained tickets are kept in `issues-granular/` for reference.

| Slice | Name | Tickets | You can see |
|---|---|---|---|
| 1 | Pink sky that scrolls | 01 | A Next.js app where a pink sky changes colour and framed placeholder photos float in as you scroll |
| 2 | The Flyers take flight | 02 | The black 3D couple flying a path of climbs, dives, turns and one loop as you scroll |
| 3 | The 3D sky | 03 | Clouds in depth, Cloud passes and a Turn-around, Memories popping out of Clouds in pink frames, Wiggle, Write-on text |
| 4 | Her story | 04 | Intro, chapters, day counter, about 4-minute pacing, unlock gate, Letter and Closing line |
| 5 | Polish and ship | 05 | Music, fallbacks, real iPhone testing, optional real couple model, and a live private link |
| 6 | Months and Month labels | 06 | 12 pictures a Year with a Month label in place of Captions, 39 placeholders, the Wiggle gone |
| 7 | Year 2 over the Sea | 07 | The dive to the Sea, the camera behind the Flyers, wake and reflection, pictures coming clear as they pass, Sky moods by Chapter |
| 8 | Year 3 face-on climb | 08 | The Turn-around at the end of Year 2, the climb facing her into the stars, and the whole story at about 5.8 minutes |

Slices 1 to 3 need nothing from you. Slice 4 is the first one that needs your content (date, gate question, letter). Slices 6 to 8 need nothing new; real pictures for each Month come at the end.

## Testing

- `npm run dev` for development; `npm run build` and serve `out/` for production-like checks.
- Headless Edge screenshots at phone and laptop sizes.
- `?p=0.4` jumps to any scroll position.
- Final check on a real iPhone, in Safari and in the app the link will be sent through. Slices 7 and 8 add a moving camera, the Sea and 36 pictures, so the real-device frame rate and memory pass from ticket 05 must be done again after them.

## Out of scope

- Editing the content in a browser (no CMS).
- Real security for the unlock gate.
- Making the real `couple.glb` (the user obtains it separately).
- Backend, analytics, accounts, server-side Next.js features.
- Real water simulation, land, boats or other scenery around the Sea.

## Needs from the user

The real date they became a couple (the placeholder is Feb 14, 2024), unlock question and answer, one real photo for each of the 36 Months and 3 for How we met (with a Caption for each of those 3), song MP3, letter text and language, optional `couple.glb`, and the app the link will be sent through.
