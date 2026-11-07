# 01: Pink sky that scrolls

**What to build:** A Next.js app where the Sky changes colour as the Recipient scrolls and framed placeholder Memories float into view. This is the shell everything else plugs into: one scroll source, one ticker, one content file.

- App created with the latest Next.js (App Router, TypeScript, npm, plain CSS), static export, images unoptimized. If `create-next-app` refuses because the folder already holds `ARCHITECTURE.md` and `.scratch/`, scaffold in a temporary folder and move the files in; do not delete either.
- `gsap`, `@gsap/react` and `three` installed with exact pinned versions; nothing loads from a CDN.
- One ScrollTrigger scrub (progress 0 to 1 over the whole page) and one `gsap.ticker` callback, exposed through a `subscribe` function that every module uses. All setup is cleaned up so React Strict Mode's double mount leaves exactly one of each.
- `?p=0.4` opens the page at that progress (read in an effect, never during server render). `?debug` shows live progress.
- Sky: four fixed gradient layers (dawn pink at 0.00, bright pink day at 0.35, sunset at 0.70, deep rose with stars at 1.00) cross-fading by opacity, clouds on 2 or 3 parallax depths, stars fading in near the end. Final colours stay light enough for black Flyers to read.
- Memories: about 15 to 20 generated placeholder photos over the Chapters, driven by a typed `content/memories.ts`. Thick black frames, slight tilt, handwritten Caption, alternating left and right (about 70% width and staggered on phones). Each fades, tilts and drifts in with scroll. Plain `<img loading="lazy">`. A resize script scales dropped-in photos to about 1600 px.
- Handwriting font bundled locally; no external font request.
- Short README: `npm run dev`, `npm run build`, how to serve `out/`.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `npm run dev` shows a scrolling page; `npm run build` completes and produces `out/`.
- [x] No hydration warnings in the console.
- [x] After a hot reload, `?debug` still shows exactly one ScrollTrigger and one ticker callback.
- [x] No scroll listeners exist outside ScrollTrigger.
- [x] Dependency versions are pinned exactly; nothing loads from a CDN.
- [x] `?p=0`, `?p=0.35`, `?p=0.7` and `?p=1` match the Sky table in the spec.
- [x] Only `transform` and `opacity` are animated; clouds drift at different speeds by depth.
- [x] Editing only `content/memories.ts` adds, removes or reorders Memories and Captions.
- [x] Phone (about 390 px) and laptop screenshots both look right.
- [x] Handwriting font is bundled locally.

**Notes:** Font choice depends on the Caption language, which the Creator has not yet decided.
