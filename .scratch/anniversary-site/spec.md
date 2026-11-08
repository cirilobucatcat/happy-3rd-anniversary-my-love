# Spec: Happy 3rd Year, My Love

Status: draft v3, 2026-11-07 (adds the 3D sky detour: Clouds in depth, pink-framed Memories that pop out, Write-on text; work now 5 slices)
Supersedes `ARCHITECTURE.md` where they differ (3D Flyers, GSAP kept, Next.js, 4-minute target). Tickets are in `issues/`.

## Problem

The user wants a surprise for their girlfriend's 3rd anniversary: a website she opens on her iPhone 15 (and possibly a laptop) and experiences by scrolling. It should feel handmade, personal and romantic, not like a template.

## Solution

A single scroll-driven page. A pink 3D sky changes mood as she scrolls and is filled with Clouds at different depths. Their photos pop out from behind the Clouds in deep rose-pink frames, with handwritten Captions that draw themselves, and a 3D model of the two of them holding hands flies through the sky, banking, diving and looping, weaving in and out of the Clouds and turning around to face her before the Letter. It ends with a letter. One self-paced pass takes about 4 minutes (target range 2 to 5).

## Terms (proposed, not yet confirmed by the user)

- **Flyers**: the 3D model of the two of them holding hands. Replaces "silhouettes".
- **Memory**: one photo plus its caption.
- **Sky / Cloud**: the pink 3D world, filled with soft Clouds at different depths that Memories and the Flyers pass behind, in front of and into.
- **Cloud pass / Turn-around**: the Flyers fly into a Cloud and come out the other side (at each Chapter change); the Flyers U-turn to face her (just before the Letter).
- **Pop-out**: a Memory emerges from behind a Cloud with a small bounce, stays in front while read, and leaves behind another Cloud.
- **Write-on**: handwritten text that draws itself stroke by stroke as she scrolls, with no pen visible.
- **Wiggle**: a Memory's frame swings from its nearest corner when hovered (or tapped on a phone).
- **Chapter**: a group of Memories (How we met, Year 1, Year 2, Year 3).
- **Flight path**: the route the Flyers follow as she scrolls.
- **Day 1**: the day they became a couple. The Day counter is computed from the real dates, so the Anniversary lands on Day 1,096 (or 1,097 if a leap day falls between), not a fixed 1,095.

Full definitions live in `GLOSSARY.md`.

## Settled decisions

- Pink sky. Black accents on the handwritten text. The Flyers are shown in their own colours (changed from black on 2026-11-08) and leave their pink ribbon trail with Stardust in pinks and oranges around it. The Memory frames are deep rose-pink (about `#e0457b`) with a thin cream mat, bevelled with real thickness and a soft sheen (changed from black on 2026-11-07).
- **3D sky detour (2026-11-07):** fixed camera with a slight scroll drift for parallax; sprite-cluster Clouds in 3D tinted by Sky stage; Memories are textured planes in the same WebGL scene (ADR 0001); the Flyers are always in front of Memories and only Clouds veil them; three Cloud passes at the Chapter changes; one Turn-around before the Letter; Pop-out arrival; Wiggle on hover or tap; Write-on (stroke by stroke, scroll-driven, single-line cursive font replacing Caveat) for Captions, Chapter titles, and the Letter's greeting and Closing line, with the Letter body revealed line by line.
- Phone first (iPhone 15, Safari), must also work on a laptop.
- Self-paced scrolling, about 4 minutes. The Intro, Chapters and Memories take about 30 screen heights (raised from 25 to 30 on 2026-11-07 for longer Chapter title writing) and the Turn-around and Letter add about 7 more, so the page is about 38 screens long (agreed 2026-11-08). At a relaxed 6.5 seconds a screen that is about 4 minutes, with each Memory about 8 seconds and the Letter section about a minute. A longer Letter simply scrolls for longer (about 28 words a screen, within limits). `?debug` shows the estimate; the pace and the layout are `RELAXED_SECONDS_PER_SCREEN` and `SCREENS` in `lib/timeline.ts`.
- Placeholder photos (about 15 to 20) until real ones are supplied.
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
- The user writes the letter; Claude helps polish. Captions and letter language to be decided.
- The Flyers fly side by side, hands joined, leaning forward about 30 degrees. Her hair and dress trail behind her; he has short hair.
- The link is sent in an app that may open an in-app browser, so build for Safari first and add an "Open in Safari" hint.

## Trade-off accepted

Next.js adds a build step, a `node_modules` folder and React lifecycle quirks to what is a single page. The user chose it anyway. The cost is managed by: static export (no server), plain Three.js and GSAP in client components with strict cleanup, and pinned exact versions.

## User stories

1. As the girlfriend, I open the link and, after answering the unlock question, see a pink sky and the Flyers on screen.
2. As the girlfriend, I scroll and the Flyers fly along a path that climbs, dives, turns and loops once.
3. As the girlfriend, I see each Memory pop out from behind a Cloud into a pink frame, and its handwritten Caption draws itself as I scroll.
3a. As the girlfriend, I can hover (or tap) a Memory and its frame wiggles from the corner.
3b. As the girlfriend, I see the Flyers fly into Clouds and out again at the Chapter changes, and turn to face me before the Letter.
4. As the girlfriend, I see a day counter climb from Day 1 up to the Anniversary's day number as I move through the Chapters.
5. As the girlfriend, I reach a letter on a cream card and a closing line.
6. As the girlfriend, I can tap a button to play or pause our song.
7. As the girlfriend, if my device cannot do 3D, or I use reduced motion, I still get a calm, working version.
8. As the site's creator, I change all content (photos, captions, dates, letter, song) in one file, `content/memories.ts`.
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
content/memories.ts         the only content file: SITE, CHAPTERS, letter, gate, song
public/photos  public/audio  public/models/couple.glb (optional)
scripts/resize-photos.mjs   resizes photos to about 1600 px
next.config.ts              output: 'export', images unoptimized
```

### Scroll and rendering

- ScrollTrigger scrub produces one progress value, 0 to 1, over the whole page.
- Every module is updated from that value inside one `gsap.ticker` callback. No other scroll listeners.
- Animate only `transform` and `opacity` in the DOM (the Memories now live in the WebGL scene). Use `svh` units for mobile browser bars.
- All animation code runs in `useGSAP` or effects with full cleanup, because React Strict Mode mounts effects twice in development. ScrollTrigger instances, the ticker callback, the WebGL renderer and its textures must all dispose cleanly.
- Browser-only code (`window`, WebGL, `?p=`) never runs during server render, which avoids hydration errors.
- The one listener outside the shared ticker that is about the screen's size and not the story's scrolling: the gate follows the `visualViewport` so the iPhone keyboard never covers its field (`components/Gate.tsx`). The page cannot scroll while the gate is up, and the listeners go when it does. (The Memories' hover and tap input in `components/SkyCanvas.tsx` is the other, and is pointer input.) The gate also sets its `top` and `height` from that viewport, which is a layout change, not an animation; nothing animates those.
- Photos use plain `<img loading="lazy">` (the Next image optimizer is not available with static export).

### Layers (back to front)

1. Sky gradients (fixed DOM, four layers cross-fading)
2. One fixed, transparent WebGL scene with a shared depth buffer holding, in depth order: Stars, Clouds (far to near), Memories (pink-framed planes), the Flyers with their pink trail and Stardust. The Flyers are always drawn in front of the Memories; Clouds can be in front of or behind either.
3. HUD, sound button, unlock gate, intro and the Letter card (DOM)
4. Invisible page sections that set the scroll length; a hidden list carries the Memories' alt text

(See `docs/adr/0001-memories-in-webgl.md`.)

### Flyers

- The model's own materials, each with a soft Fresnel pink rim (half the strength of the old black look). The placeholder couple built in code gets matching flat colours (skin, rose-pink dress, black suit and hair).
- Stardust (decided 2026-11-08) is scattered around the pink ribbon trail, which is kept unchanged. It is about 120 pieces: five-point stars, four-point sparkles and small glitter dots (about 1 star to 2 sparkles, plus a few dots). It uses the sky's colours, made strong enough to stand out against it, in the same order all the way through the story: hot pink at the Flyers, then coral and orange, to gold at the tail, with a slow shimmer along the length (changed from full rainbow on 2026-11-08). Colours are solid and saturated with a small white glow in each piece's centre (normal blending, so the pink sky does not wash them out). Each piece is dropped at a point on the Flight path and stays there, drifting out sideways as it ages, from the Flyers' own width to twice that. It shrinks and fades out about 2.4 screens back. It is scroll-driven and rewinds, with a time-based twinkle and slow spin so it still sparkles while she pauses. A small burst of pink and orange sparkles comes out when the Flyers spring up. The trail and Stardust are drawn with the Flyers, so Cloud passes veil all three together. When a Cloud pass veils them, the Clouds sit in front of the Flyers by depth.
- Static flying pose; the Flight path drives position, rotation, banking and left/right turns in 3D, so no flip trick is needed.
- Optional `public/models/couple.glb` replaces the built-in couple with no code change. Budget: 2 MB and 30,000 triangles.

### Flight path

- Built once from a list of turns (fly right, climb, arc over, dive, one loop, cruise), then fitted to the viewport on resize. It runs in depth, with three Cloud passes at the Chapter changes and one Turn-around before the Letter.
- Scroll progress selects the position along the path.

### Sky

| Progress | Mood |
|---|---|
| 0.00 | Dawn pink |
| 0.35 | Bright pink day |
| 0.70 | Sunset |
| 1.00 | Deep rose with stars (letter) |

Clouds are soft sprite clusters in 3D at several depths and are tinted by stage: white-pink at dawn, bright white by day, orange-pink at sunset, rose-tinted at the Letter.

### Content

- Each Chapter opens with a large title and date. Memories have deep rose-pink bevelled frames with a cream mat, a slight tilt, a handwritten Caption, and alternate left and right (about 70% width and staggered on phones).
- Write-on (stroke-by-stroke, scroll-driven) is used for Captions, Chapter titles, and the Letter's greeting and Closing line. The Letter body appears line by line in the same script. The Day counter stays plain digits. This needs a single-line cursive font replacing Caveat (open licence, for example the EMS script fonts; licence to be checked), or hand-drawn stroke data.
- The letter is on a cream paper card. The page ends with "Happy 3rd anniversary, my love."

### Accessibility and fallbacks

- Reduced motion and no WebGL: a plain stacked list of the Memories with the same pink frame and Captions, no Clouds, Flyers or bounce. The counter and Letter still work.
- Alt text for every Memory is in a hidden list for screen readers.

## Slices

Each slice is one ticket in `issues/`, in a linear chain (01 -> 02 -> 03 -> 04 -> 05). Each ends in something the user can open and judge on a phone. The earlier 14 finer-grained tickets are kept in `issues-granular/` for reference.

| Slice | Name | Tickets | You can see |
|---|---|---|---|
| 1 | Pink sky that scrolls | 01 | A Next.js app where a pink sky changes colour and framed placeholder photos float in as you scroll |
| 2 | The Flyers take flight | 02 | The black 3D couple flying a path of climbs, dives, turns and one loop as you scroll |
| 3 | The 3D sky | 03 | Clouds in depth, Cloud passes and a Turn-around, Memories popping out of Clouds in pink frames, Wiggle, Write-on text |
| 4 | Her story | 04 | Intro, chapters, day counter, about 4-minute pacing, unlock gate, Letter and Closing line |
| 5 | Polish and ship | 05 | Music, fallbacks, real iPhone testing, optional real couple model, and a live private link |

Slice 4 is the first one that needs your content (date, gate question, letter). Slices 1 to 3 need nothing from you.

## Testing

- `npm run dev` for development; `npm run build` and serve `out/` for production-like checks.
- Headless Edge screenshots at phone and laptop sizes.
- `?p=0.4` jumps to any scroll position.
- Final check on a real iPhone, in Safari and in the app the link will be sent through.

## Out of scope

- Editing the content in a browser (no CMS).
- Real security for the unlock gate.
- Making the real `couple.glb` (the user obtains it separately).
- Backend, analytics, accounts, server-side Next.js features.

## Needs from the user

The real date they became a couple (the placeholder is Feb 14, 2024), unlock question and answer, real photos with dates and captions, song MP3, letter text and language, optional `couple.glb`, and the app the link will be sent through.
