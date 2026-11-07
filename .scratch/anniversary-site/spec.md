# Spec: Happy 3rd Year, My Love

Status: draft v2, 2026-11-07 (stack changed to Next.js; work cut into 4 slices)
Supersedes `ARCHITECTURE.md` where they differ (3D Flyers, GSAP kept, Next.js, 4-minute target). Tickets are in `issues/`.

## Problem

The user wants a surprise for their girlfriend's 3rd anniversary: a website she opens on her iPhone 15 (and possibly a laptop) and experiences by scrolling. It should feel handmade, personal and romantic, not like a template.

## Solution

A single scroll-driven page. A pink sky changes mood as she scrolls, their photos float past as memories in thick black frames, and a 3D model of the two of them holding hands flies through the sky, banking, diving and looping as she scrolls. It ends with a letter. One self-paced pass takes about 4 minutes (target range 2 to 5).

## Terms (proposed, not yet confirmed by the user)

- **Flyers**: the 3D model of the two of them holding hands. Replaces "silhouettes".
- **Memory**: one photo plus its caption.
- **Chapter**: a group of Memories (How we met, Year 1, Year 2, Year 3).
- **Flight path**: the route the Flyers follow as she scrolls.
- **Day 1**: the day they became a couple. The Day counter is computed from the real dates, so the Anniversary lands on Day 1,096 (or 1,097 if a leap day falls between), not a fixed 1,095.

Full definitions live in `GLOSSARY.md`.

## Settled decisions

- Pink sky, black accents (frames, Flyers, handwritten text).
- Phone first (iPhone 15, Safari), must also work on a laptop.
- Self-paced scrolling, about 4 minutes, roughly 25 to 30 screen heights.
- Placeholder photos (about 15 to 20) until real ones are supplied.
- Placeholder dates: Day 1 is 2024-02-14 and the Anniversary is 2027-02-14, which is Day 1,097 (it spans the 2024-02-29 leap day). The user said "Feb 14 for now" without a year; the years are inferred because Feb 14, 2026 has already passed. From 2026-11-07 the Anniversary is 99 days away. Day 1 is the day they became a couple, confirmed by the user.
- GSAP + ScrollTrigger are kept.
- Flyers are a 3D model: a simple low-poly couple built in code for now, replaceable by `couple.glb` later. Rendered black matte with a pink rim light.
- **Next.js, latest version** (16.4.5 on 2026-11-07, React 19), replacing the earlier "plain HTML, no build step" plan.
- Model budget: 2 MB and 30,000 triangles.

## Assumed defaults (recommended, user has not confirmed)

- ScrollTrigger scrub is the only scroll source. One shared `gsap.ticker` callback renders the 3D scene.
- Plain Three.js inside client components, not React Three Fiber. Keeps one render loop and one scroll source.
- TypeScript, App Router, npm, plain CSS (no Tailwind).
- Static export (`output: 'export'`), so the built `out/` folder can be dragged onto Netlify. No Next.js server features are used.
- Chapters: Intro, How we met, Year 1, Year 2, Year 3, Letter (the Letter and the Closing line end the story).
- An unlock question only she can answer opens the site (a soft gate, not real security), plus an unguessable URL.
- One song, supplied by the user, played after her first tap.
- The user writes the letter; Claude helps polish. Captions and letter language to be decided.
- The Flyers fly side by side, hands joined, leaning forward about 30 degrees. Her hair and dress trail behind her; he has short hair.
- The link is sent in an app that may open an in-app browser, so build for Safari first and add an "Open in Safari" hint.

## Trade-off accepted

Next.js adds a build step, a `node_modules` folder and React lifecycle quirks to what is a single page. The user chose it anyway. The cost is managed by: static export (no server), plain Three.js and GSAP in client components with strict cleanup, and pinned exact versions.

## User stories

1. As the girlfriend, I open the link and, after answering the unlock question, see a pink sky and the Flyers on screen.
2. As the girlfriend, I scroll and the Flyers fly along a path that climbs, dives, turns and loops once.
3. As the girlfriend, I see each Memory fade, tilt and drift into place in a black frame with a handwritten caption.
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
- Animate only `transform` and `opacity` in the DOM. Use `dvh` units for mobile browser bars.
- All animation code runs in `useGSAP` or effects with full cleanup, because React Strict Mode mounts effects twice in development. ScrollTrigger instances, the ticker callback, the WebGL renderer and its textures must all dispose cleanly.
- Browser-only code (`window`, WebGL, `?p=`) never runs during server render, which avoids hydration errors.
- Photos use plain `<img loading="lazy">` (the Next image optimizer is not available with static export).

### Layers (back to front)

1. Sky gradients (fixed, four layers cross-fading)
2. Stars and far clouds
3. Memories in black frames (normal page flow)
4. Three.js canvas with the Flyers and a fading trail (fixed, transparent, `pointer-events: none`)
5. A few near cloud wisps
6. HUD, sound button, unlock gate, intro

### Flyers

- Black matte material, pink rim light (back light or Fresnel, whichever reads better on the pink sky).
- Static flying pose; the Flight path drives position, rotation, banking and left/right turns in 3D, so no flip trick is needed.
- Optional `public/models/couple.glb` replaces the built-in couple with no code change. Budget: 2 MB and 30,000 triangles.

### Flight path

- Built once from a list of turns (fly right, climb, arc over, dive, one loop, cruise), then fitted to the viewport on resize.
- Scroll progress selects the position along the path.

### Sky

| Progress | Mood |
|---|---|
| 0.00 | Dawn pink |
| 0.35 | Bright pink day |
| 0.70 | Sunset |
| 1.00 | Deep rose with stars (letter); light enough for black Flyers to read |

### Content

- Each Chapter opens with a large title and date. Memories have thick black frames, a slight tilt, a handwritten caption, and alternate left and right (about 70% width and staggered on phones).
- The letter is on a cream paper card. The page ends with "Happy 3rd anniversary, my love."

### Accessibility and fallbacks

- Reduced motion: simple fades, no Flight path.
- No WebGL: the page still works without the Flyers.

## Slices

Each slice is one ticket in `issues/`, in a linear chain (01 -> 02 -> 03 -> 04). Each ends in something the user can open and judge on a phone. The earlier 14 finer-grained tickets are kept in `issues-granular/` for reference.

| Slice | Name | Tickets | You can see |
|---|---|---|---|
| 1 | Pink sky that scrolls | 01 | A Next.js app where a pink sky changes colour and framed placeholder photos float in as you scroll |
| 2 | The Flyers take flight | 02 | The black 3D couple flying a path of climbs, dives, turns and one loop as you scroll |
| 3 | Her story | 03 | Intro, chapters, day counter, about 4-minute pacing, unlock gate, Letter and Closing line |
| 4 | Polish and ship | 04 | Music, fallbacks, real iPhone testing, optional real couple model, and a live private link |

Slice 3 is the first one that needs your content (date, gate question, letter). Slices 1 and 2 need nothing from you.

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
