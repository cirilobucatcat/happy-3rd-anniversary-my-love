# Happy 3rd Year, My Love: Architecture

A scroll-driven anniversary website for my girlfriend. As she scrolls, two black silhouettes holding hands fly through a pink sky, changing direction, while our photos float past as memories.

**Status:** historical first plan. The current design is in `.scratch/anniversary-site/spec.md` (Next.js, 3D Flyers, and the 2026-11-07 3D sky detour) and `docs/adr/`. Where this file disagrees (plain HTML, silhouettes, black frames, flat clouds, DOM Memories), the spec wins. The sections below on layers, frames, clouds and the Flight path have been updated for the 3D sky.

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Concept | Scrolling reveals our photos as "memories" in a pink sky, with motion design |
| Colors | Pink sky (she loves pink), black accents (I love black): pink photo frames, black Flyers, black handwritten text |
| Flyer | Two black silhouettes holding hands ("the two of us") that climb, dive, loop and turn as she scrolls |
| Devices | Phone **and** laptop. Mobile-first, must work on both |
| Stack | Plain HTML, CSS and JavaScript, plus GSAP and ScrollTrigger. No build step |
| Hosting | Free static hosting (Netlify or GitHub Pages), then send her one link |
| Story | Intro, How we met, Year 1, Year 2, Year 3, Letter (recommended, not yet confirmed) |

---

## 2. File structure

```
happy-3rd-year-my-love/
├─ index.html          page shell with empty containers
├─ memories.js         THE ONLY FILE TO EDIT: chapters, photos, captions, letter, song
├─ photos/             real pictures (placeholders until they are added)
├─ audio/              optional song
├─ css/
│  └─ styles.css       colors, photo frames, fonts, responsive rules
├─ js/
│  ├─ main.js          boot + the single animation loop
│  ├─ content.js       builds chapters and photos from memories.js
│  ├─ route.js         the flight path (turns, climbs, dives, one loop)
│  ├─ flyers.js        the silhouettes: position, tilt, turning around, trail
│  ├─ sky.js           sky color changes, clouds, stars
│  ├─ reveal.js        photos fading, tilting and drifting in
│  └─ audio.js         music toggle
└─ vendor/             gsap + ScrollTrigger (stored locally, no CDN dependency)
```

### `memories.js` shape (draft)

```js
export const SITE = {
  title: "Our 3 Years",
  anniversary: "YYYY-MM-DD",       // used for the day counter
  song: "audio/our-song.mp3",      // optional, leave "" for none
  letter: "…the letter text…",
  finale: "Happy 3rd anniversary, my love."
};

export const CHAPTERS = [
  {
    id: "met",
    title: "How we met",
    date: "YYYY-MM-DD",
    photos: [
      { src: "photos/01.jpg", caption: "Our first date", side: "left" },
      // …
    ]
  },
  // Year 1, Year 2, Year 3
];
```

---

## 3. How the pieces fit together

```
scroll ──► main.js  (one requestAnimationFrame loop, smoothed progress 0 → 1)
              ├─► sky.js      sky color; clouds drift opposite to the flight direction
              ├─► flyers.js   position, tilt and flip along the route from route.js
              ├─► reveal.js   photo entrances + parallax
              └─► HUD         "Day 1 … Day 1,095" counter
```

**Rule:** only `main.js` listens to scrolling. Every other module is updated from its loop. This keeps motion smooth on phones.

### Layers (back to front)

1. Sky gradients (fixed, DOM)
2. One transparent WebGL scene with a shared depth buffer: stars, Clouds at several depths, Memories as pink-framed planes, and the Flyers with their trail. The Flyers always draw in front of the Memories; Clouds can veil either (see `docs/adr/0001-memories-in-webgl.md`)
3. HUD: day counter, sound button, intro screen, Letter card (DOM)

---

## 4. Key design choices

### Flight path (`route.js`)
- Defined as a list of turns, similar to turtle graphics: fly right, climb, arc over, dive, one loop-the-loop, cruise. It now runs in depth too, with three Cloud passes (into a Cloud and out the other side) at the Chapter changes and one Turn-around (U-turn to face her) just before the Letter.
- The path is built once, then fitted to the current screen size on resize, so it uses the whole screen on both phone and laptop.
- Scroll progress picks the position along the path.

### Silhouettes (`flyers.js`)
- One inline SVG of two figures holding hands, drawn facing right. The girl has flowing hair and a dress, and the boy has short hair.
- They tilt to follow the path.
- When they head left, the figure squash-flips horizontally so it stays upright. The flip happens while the figure is flat, so there is no visible pop.
- A fading trail stays anchored to the page as it scrolls.
- A soft light glow keeps the black readable over dark photos.

### Sky (`sky.js`)
Four fixed gradient layers cross-fade as she scrolls (opacity only, which is cheap on phones):

| Progress | Mood |
|---|---|
| 0.00 | Dawn pink |
| 0.35 | Bright pink day |
| 0.70 | Sunset |
| 1.00 | Deep rose with stars (the letter). Light enough for black silhouettes to show |

Clouds are soft sprite clusters placed in 3D at several depths, tinted by Sky stage (white-pink dawn, white day, orange-pink sunset, rose at the Letter). The camera is fixed and drifts a few degrees with scroll for parallax.

### Story pages (`content.js` + `reveal.js`)
- Each chapter starts with a big title and date.
- Memories are textured planes in deep rose-pink bevelled frames with a cream mat, a slight tilt and a handwritten Caption. Each pops out from behind a Cloud, stays in front while read, and leaves behind another Cloud. Hover (or tap) makes the frame wiggle from its nearest corner.
- Captions, Chapter titles and the Letter's greeting and Closing line use the Write-on: strokes draw themselves as she scrolls, using a single-line cursive font (replacing Caveat). The Letter body appears line by line.
- They alternate left and right, and on phones are staggered at about 70% width.
- The letter appears on a cream paper card. The page ends with "Happy 3rd anniversary, my love."
- A day counter ticks up as she scrolls.

### Phone and performance rules
- Animate only `transform` and `opacity` in the DOM (one exception: the Write-on moves the SVG `stroke-dasharray` of a few dozen small paths, which is the only way to draw strokes in order, and only for the text on screen); keep the WebGL scene light (sprite Clouds, lazily loaded photo textures).
- Photos are lazy-loaded and resized to about 1600 px (a small helper script will do this).
- Use `dvh` units so mobile browser bars do not break the layout.
- If the device has reduced motion enabled, or no WebGL, fall back to a plain stacked list of the Memories with the same frame and Captions (no Clouds, Flyers or bounce).

### Audio (`audio.js`)
- Optional. A sound button toggles the song.
- Browsers block autoplay, so the music starts only after her first tap.

---

## 5. Testing plan

- Microsoft Edge is installed, so I can take headless screenshots at phone and laptop sizes.
- A hidden `?p=0.4` URL option jumps to any scroll position, so each moment can be checked without scrolling.
- Final check on a real phone before sending her the link.

---

## 6. Build order

| Milestone | Scope |
|---|---|
| **M1** | Sky, clouds, smooth scrolling, placeholder photo layout |
| **M2** | Silhouettes and flight path (hardest part, so you see it early) |
| **M3** | Chapters, day counter, letter finale |
| **M4** | Music, reduced-motion fallback, resizing, deploy steps |

---

## 7. Open questions

None of these block M1 or M2.

1. **Photos:** roughly how many, and do I know when each was taken?
2. **Dates:** anniversary date, plus chapter titles and big moments.
3. **Song:** do we have one that plays when she taps the sound button?
4. **Unlock question:** do we want an opening question only she can answer (a nickname or a date)?
5. **Letter:** will I write it myself, with help polishing it?
